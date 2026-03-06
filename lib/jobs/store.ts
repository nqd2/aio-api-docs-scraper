import { JobEvent, JobRecord, JobStatus, JobProgress, JobResult } from "./types";

type Listener = (event: JobEvent) => void;

type Store = {
  jobs: Map<string, JobRecord>;
  listeners: Map<string, Set<Listener>>;
  nextEventId: Map<string, number>;
};

function getStore(): Store {
  const g = globalThis as unknown as { __AIO_SCRAPE_STORE__?: Store };
  if (!g.__AIO_SCRAPE_STORE__) {
    g.__AIO_SCRAPE_STORE__ = {
      jobs: new Map(),
      listeners: new Map(),
      nextEventId: new Map(),
    };
  }
  return g.__AIO_SCRAPE_STORE__;
}

function nowIso() {
  return new Date().toISOString();
}

export function createJob(params: { url: string; forceDocsType?: JobRecord["forceDocsType"] }): JobRecord {
  const store = getStore();
  const id = crypto.randomUUID();
  const createdAt = nowIso();

  const progress: JobProgress = { step: "queued", percent: 0, message: "Job created" };
  const job: JobRecord = {
    id,
    url: params.url,
    forceDocsType: params.forceDocsType,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    progress,
  };

  store.jobs.set(id, job);
  store.nextEventId.set(id, 1);

  publish(id, { type: "snapshot", data: job });
  return job;
}

export function getJob(jobId: string): JobRecord | undefined {
  return getStore().jobs.get(jobId);
}

export function listJobs(limit = 20): JobRecord[] {
  const jobs = Array.from(getStore().jobs.values());
  jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return jobs.slice(0, limit);
}

export function updateJob(jobId: string, patch: Partial<JobRecord>) {
  const store = getStore();
  const current = store.jobs.get(jobId);
  if (!current) return;
  const updated: JobRecord = { ...current, ...patch, updatedAt: nowIso() };
  store.jobs.set(jobId, updated);
  publish(jobId, { type: "snapshot", data: updated });
}

export function setJobProgress(jobId: string, params: { status?: JobStatus; progress: JobProgress; docsType?: JobRecord["docsType"] }) {
  const store = getStore();
  const current = store.jobs.get(jobId);
  if (!current) return;
  const updatedAt = nowIso();

  const updated: JobRecord = {
    ...current,
    status: params.status ?? current.status,
    docsType: params.docsType ?? current.docsType,
    progress: params.progress,
    updatedAt,
  };
  store.jobs.set(jobId, updated);

  publish(jobId, {
    type: "progress",
    data: { status: updated.status, progress: updated.progress, updatedAt: updated.updatedAt, docsType: updated.docsType },
  });
}

export function completeJob(jobId: string, result: JobResult) {
  const store = getStore();
  const current = store.jobs.get(jobId);
  if (!current) return;
  const updatedAt = nowIso();

  const updated: JobRecord = {
    ...current,
    status: "completed",
    progress: { step: "completed", percent: 100, message: "Completed" },
    result,
    updatedAt,
  };
  store.jobs.set(jobId, updated);

  publish(jobId, { type: "completed", data: { status: updated.status, updatedAt } });
  publish(jobId, { type: "snapshot", data: updated });
}

export function failJob(jobId: string, message: string) {
  const store = getStore();
  const current = store.jobs.get(jobId);
  if (!current) return;
  const updatedAt = nowIso();

  const updated: JobRecord = {
    ...current,
    status: "failed",
    progress: { step: "failed", percent: current.progress.percent, message: "Failed" },
    error: { message },
    updatedAt,
  };
  store.jobs.set(jobId, updated);

  publish(jobId, { type: "failed", data: { status: "failed", updatedAt, error: { message } } });
  publish(jobId, { type: "snapshot", data: updated });
}

export function subscribe(jobId: string, listener: Listener) {
  const store = getStore();
  if (!store.listeners.has(jobId)) store.listeners.set(jobId, new Set());
  store.listeners.get(jobId)!.add(listener);
  return () => {
    store.listeners.get(jobId)?.delete(listener);
  };
}

function publish(jobId: string, event: Omit<JobEvent, "id">) {
  const store = getStore();
  const next = store.nextEventId.get(jobId) ?? 1;
  store.nextEventId.set(jobId, next + 1);

  const payload: JobEvent = { ...(event as JobEvent), id: next };
  const subs = store.listeners.get(jobId);
  if (!subs || subs.size === 0) return;
  for (const cb of subs) cb(payload);
}

