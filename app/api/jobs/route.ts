import { NextResponse } from "next/server";
import { z } from "zod";
import type { DocsType } from "../../../lib/types";
import { createJob, listJobs } from "../../../lib/jobs/store";
import { startJob } from "../../../lib/jobs/runner";

export const dynamic = "force-dynamic";

const CreateJobSchema = z.object({
  url: z.string().min(1),
  forceDocsType: z
    .enum(["swagger", "redoc", "redocly", "docusaurus", "unknown"] as const)
    .optional()
    .transform((v) => (v === "unknown" ? undefined : v)),
});

function normalizeUrl(input: string) {
  const raw = input.trim();
  if (!raw) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "20");
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, limit)) : 20;
  const jobs = listJobs(safeLimit).map((j) => ({
    id: j.id,
    url: j.url,
    status: j.status,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
    progress: j.progress,
    docsType: j.docsType,
    forceDocsType: j.forceDocsType,
    stats: j.result?.stats,
    error: j.error,
  }));
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const url = normalizeUrl(parsed.data.url);
  const urlOk = z.string().url().safeParse(url).success;
  if (!urlOk) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const forceDocsType = parsed.data.forceDocsType as DocsType | undefined;
  const job = createJob({ url, forceDocsType });
  startJob(job.id);

  return NextResponse.json({ jobId: job.id });
}

