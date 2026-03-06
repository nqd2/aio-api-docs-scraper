"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { z } from "zod";
import { TablePreview } from "./table-preview";
import { DashboardHeader } from "./dashboard-header";
import { DashboardForm } from "./dashboard-form";

export type DocsType = "auto" | "swagger" | "redoc" | "redocly" | "docusaurus";

type JobSummary = {
  id: string;
  url: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  progress: { step: string; percent: number; message?: string };
  stats?: { title: string; version: string; endpointsCount: number; generatedAt: string };
  error?: { message: string };
};

type JobDetail = JobSummary & {
  docsType?: string;
  forceDocsType?: string;
  hasResult?: boolean;
};

const LOCAL_JOBS_KEY = "aio-api-scraper:jobs";

function readJobsFromStorage(): JobSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_JOBS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as JobSummary[];
  } catch {
    return [];
  }
}

function writeJobsToStorage(jobs: JobSummary[]) {
  if (typeof window === "undefined") return;
  try {
    const limited = [...jobs];
    if (limited.length > 50) limited.length = 50;
    window.localStorage.setItem(LOCAL_JOBS_KEY, JSON.stringify(limited));
  } catch {
    // ignore storage errors
  }
}

const UrlSchema = z.string().min(1);

function normalizeUrl(input: string) {
  const raw = input.trim();
  if (!raw) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US");
  } catch {
    return iso;
  }
}

function statusBadge(status: JobSummary["status"]) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "failed":
      return "bg-rose-500/20 text-rose-300 border-rose-500/30";
    case "running":
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function Dashboard() {
  const [url, setUrl] = useState("");
  const [docsType, setDocsType] = useState<DocsType>("auto");
  const [urlError, setUrlError] = useState<string | null>(null);

  const [currentJob, setCurrentJob] = useState<JobDetail | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>(() => {
    const fromStorage = readJobsFromStorage();
    if (fromStorage.length === 0) return [];
    const sorted = [...fromStorage].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sorted;
  });
  const [previewFormat, setPreviewFormat] = useState<"openapi" | "postman">("openapi");
  const [previewText, setPreviewText] = useState<string>("");
  const [previewMeta, setPreviewMeta] = useState<{ truncated: boolean } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewView, setPreviewView] = useState<"json" | "table">("json");
  const [previewDataFormat, setPreviewDataFormat] = useState<"openapi" | "postman" | null>(null);
  const [previewData, setPreviewData] = useState<unknown | null>(null);

  const [isPending, startTransition] = useTransition();
  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<number | null>(null);

  const canDownload = currentJob?.status === "completed";
  const progress = currentJob?.progress ?? { percent: 0, step: "idle", message: "Ready" };

  const validateUrl = useCallback((value: string) => {
    const parsed = UrlSchema.safeParse(value.trim());
    if (!parsed.success) return "Please enter a URL.";
    const normalized = normalizeUrl(value);
    const ok = z.string().url().safeParse(normalized).success;
    if (!ok) return "Invalid URL (tip: include https://).";
    return null;
  }, []);

  const refreshJobs = useCallback(() => {
    const fromStorage = readJobsFromStorage();
    if (fromStorage.length === 0) {
      setJobs([]);
      return;
    }
    const sorted = [...fromStorage].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setJobs(sorted);
  }, []);

  const upsertFromDetail = useCallback((job: JobDetail) => {
    setJobs((prev) => {
      const summary: JobSummary = {
        id: job.id,
        url: job.url,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        progress: job.progress,
        stats: job.stats,
        error: job.error,
      };
      const next = prev.filter((j) => j.id !== summary.id);
      next.push(summary);
      next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      writeJobsToStorage(next);
      return next;
    });
  }, []);

  const setCurrentJobWithHistory = useCallback(
    (job: JobDetail) => {
      setCurrentJob(job);
      upsertFromDetail(job);
    },
    [upsertFromDetail],
  );

  const stopRealtime = useCallback(() => {
    sseRef.current?.close();
    sseRef.current = null;
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchJob = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as JobDetail;
  }, []);

  const loadPreview = useCallback(async (jobId: string, format: "openapi" | "postman") => {
    setPreviewError(null);
    setPreviewMeta(null);
    setPreviewText("");
    setPreviewData(null);
    setPreviewDataFormat(null);

    const limit = 200_000;
    const res = await fetch(`/api/jobs/${jobId}/result?format=${format}&mode=preview&limit=${limit}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setPreviewError("Unable to load preview.");
      return;
    }
    const text = await res.text();
    setPreviewText(text);
    setPreviewMeta({ truncated: text.includes("/* ... truncated") });
  }, []);

  const connectSse = useCallback(
    (jobId: string) => {
      stopRealtime();

      const es = new EventSource(`/api/jobs/${jobId}/events`);
      sseRef.current = es;

      const onAnyUpdate = (patch: Partial<JobDetail>) => {
        setCurrentJob((prev) => {
          if (!prev) {
            return prev;
          }
          const next = { ...prev, ...patch } as JobDetail;
          upsertFromDetail(next);
          return next;
        });
      };

      es.addEventListener("snapshot", (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data) as JobDetail;
          setCurrentJobWithHistory(data);
        } catch {
          // ignore
        }
      });

      es.addEventListener("progress", (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data) as Pick<JobDetail, "status" | "progress" | "updatedAt" | "docsType">;
          onAnyUpdate(data);
        } catch {
          // ignore
        }
      });

      es.addEventListener("completed", () => {
        void loadPreview(jobId, previewFormat);
      });

      es.addEventListener("failed", (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data) as { error: { message: string } };
          onAnyUpdate({ status: "failed", error: data.error });
        } catch {
          onAnyUpdate({ status: "failed", error: { message: "Job failed" } });
        }
      });

      es.onerror = () => {
        es.close();
        sseRef.current = null;

        // Fallback polling
        pollRef.current = window.setInterval(async () => {
          const job = await fetchJob(jobId);
            if (job) setCurrentJobWithHistory(job);
          if (job?.status === "completed" || job?.status === "failed") {
            stopRealtime();
            if (job?.status === "completed") void loadPreview(jobId, previewFormat);
          }
        }, 1500);
      };
    },
    [fetchJob, loadPreview, previewFormat, setCurrentJobWithHistory, stopRealtime, upsertFromDetail],
  );

  const onSubmit = useCallback(async () => {
    const err = validateUrl(url);
    setUrlError(err);
    if (err) return;

    stopRealtime();
    setPreviewText("");
    setPreviewError(null);

    startTransition(async () => {
      const payload: Record<string, unknown> = { url: normalizeUrl(url) };
      if (docsType !== "auto") payload.forceDocsType = docsType;

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as { jobId?: string; error?: string } | null;
      if (!res.ok || !data?.jobId) {
        setCurrentJob({
          id: "local-error",
          url: normalizeUrl(url),
          status: "failed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          progress: { step: "failed", percent: 0, message: "Failed" },
          error: { message: data?.error ?? "Unable to create job" },
        });
        return;
      }

      const jobId = data.jobId;
      const job = await fetchJob(jobId);
      if (job) setCurrentJobWithHistory(job);
      connectSse(jobId);
    });
  }, [connectSse, docsType, fetchJob, setCurrentJobWithHistory, stopRealtime, url, validateUrl]);

  const downloadHref = useMemo(() => {
    if (!currentJob?.id || currentJob.status !== "completed") return null;
    const id = currentJob.id;
    return {
      openapiJson: `/api/jobs/${id}/result?format=openapi&mode=download&as=json`,
      openapiYaml: `/api/jobs/${id}/result?format=openapi&mode=download&as=yaml`,
      postmanJson: `/api/jobs/${id}/result?format=postman&mode=download&as=json`,
    };
  }, [currentJob]);

  useEffect(() => {
    return () => stopRealtime();
  }, [stopRealtime]);

  const ensureTableData = useCallback(
    async (jobId: string, format: "openapi" | "postman") => {
      if (previewData && previewDataFormat === format) return;
      try {
        const res = await fetch(`/api/jobs/${jobId}/result?format=${format}&mode=json`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as unknown;
        setPreviewData(json);
        setPreviewDataFormat(format);
      } catch {
        // ignore table data error, JSON preview still works
      }
    },
    [previewData, previewDataFormat],
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <DashboardHeader onRefresh={refreshJobs} />
      <DashboardForm
        url={url}
        docsType={docsType}
        urlError={urlError}
        isPending={isPending}
        setUrl={setUrl}
        setDocsType={setDocsType}
        setUrlError={setUrlError}
        validateUrl={validateUrl}
        onSubmit={onSubmit}
      />

      <section className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Step 2 · Scrape</p>
                <p className="text-sm font-semibold text-foreground">Progress</p>
                <p className="text-xs text-muted-foreground">{progress.message ?? progress.step}</p>
              </div>
              {currentJob ? (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge(
                    currentJob.status,
                  )}`}
                >
                  {currentJob.status}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No job yet</span>
              )}
            </div>

            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400 transition-[width] duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{progress.step}</span>
                <span>{Math.round(progress.percent)}%</span>
              </div>
            </div>

            {currentJob?.error?.message ? (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
                {currentJob.error.message}
              </div>
            ) : null}

            {currentJob?.stats ? (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Endpoints</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{currentJob.stats.endpointsCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Generated</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{formatTime(currentJob.stats.generatedAt)}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Step 4 · Download</p>
                <p className="text-sm font-semibold text-foreground">Download result</p>
              </div>
              <p className="text-xs text-muted-foreground">{canDownload ? "Ready" : "Waiting for job to finish"}</p>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">OpenAPI</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={downloadHref?.openapiJson ?? "#"}
                      aria-disabled={!downloadHref}
                      className={`inline-flex h-9 items-center justify-center rounded-xl bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-sm transition hover:opacity-95 ${
                        downloadHref ? "" : "cursor-not-allowed opacity-60"
                      }`}
                    >
                      JSON
                    </a>
                    <a
                      href={downloadHref?.openapiYaml ?? "#"}
                      aria-disabled={!downloadHref}
                      className={`inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted ${
                        downloadHref ? "" : "cursor-not-allowed opacity-60"
                      }`}
                    >
                      YAML
                    </a>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Postman</p>
                  <a
                    href={downloadHref?.postmanJson ?? "#"}
                    aria-disabled={!downloadHref}
                    className={`inline-flex h-9 items-center justify-center rounded-xl bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-sm transition hover:opacity-95 ${
                      downloadHref ? "" : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    JSON
                  </a>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Tip: Preview only shows a subset (to keep the UI responsive). The download is the full JSON.
            </p>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Step 3 · Preview</p>
                <p className="text-sm font-semibold text-foreground">JSON preview</p>
                <p className="text-xs text-muted-foreground">
                  {currentJob?.status === "completed"
                    ? `Job: ${currentJob.id} • ${currentJob.stats?.title ?? "Untitled"}`
                    : "Run a job to see the preview."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-border bg-background p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFormat("openapi");
                      setPreviewView("json");
                      if (currentJob?.id && currentJob.status === "completed") void loadPreview(currentJob.id, "openapi");
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      previewFormat === "openapi" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    OpenAPI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFormat("postman");
                      setPreviewView("json");
                      if (currentJob?.id && currentJob.status === "completed") void loadPreview(currentJob.id, "postman");
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      previewFormat === "postman" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Postman
                  </button>
                </div>
                <div className="inline-flex rounded-xl border border-border bg-background p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setPreviewView("json")}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      previewView === "json" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewView("table");
                      if (currentJob?.id && currentJob.status === "completed") {
                        void ensureTableData(currentJob.id, previewFormat);
                      }
                    }}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      previewView === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
              {previewError ? (
                <div className="p-4 text-sm text-rose-600 dark:text-rose-300">{previewError}</div>
              ) : previewView === "table" ? (
                <div className="p-4">
                  {previewData && previewDataFormat === previewFormat ? (
                    <TablePreview data={previewData} format={previewFormat} />
                  ) : currentJob?.status === "running" || currentJob?.status === "queued" ? (
                    <p className="text-sm text-muted-foreground">
                      Running... table view will appear when the job completes.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No structured data yet.</p>
                  )}
                </div>
              ) : previewText ? (
                <>
                  <div className="flex items-center justify-between border-b border-border px-4 py-2">
                    <p className="text-xs text-muted-foreground">
                      {previewMeta?.truncated ? "Showing truncated preview." : "Showing full preview."}
                    </p>
                    {currentJob?.id && canDownload ? (
                      <button
                        type="button"
                        onClick={() => void loadPreview(currentJob.id!, previewFormat)}
                        className="text-xs font-semibold text-accent hover:underline"
                      >
                        Refresh
                      </button>
                    ) : null}
                  </div>
                  <pre className="max-h-[520px] overflow-auto p-4 text-xs leading-5 text-foreground">
                    <code className="font-mono">{previewText}</code>
                  </pre>
                </>
              ) : (
                <div className="p-4 text-sm text-muted-foreground">
                  {currentJob?.status === "running" || currentJob?.status === "queued"
                    ? "Running... preview will appear when the job completes."
                    : "No preview data yet."}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Activity</p>
                <p className="text-sm font-semibold text-foreground">Job history</p>
              </div>
              <p className="text-xs text-muted-foreground">{jobs.length} items</p>
            </div>

            <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
              {jobs.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No jobs yet.</div>
              ) : (
                jobs.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => {
                      setCurrentJob(j);
                      connectSse(j.id);
                      if (j.status === "completed") void loadPreview(j.id, previewFormat);
                    }}
                    className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{j.stats?.title ?? j.url}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {j.id} • {formatTime(j.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge(j.status)}`}>
                        {j.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{Math.round(j.progress.percent)}%</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

