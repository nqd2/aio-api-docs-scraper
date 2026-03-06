import { NextResponse } from "next/server";
import { getJob } from "../../../../lib/jobs/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({
    id: job.id,
    url: job.url,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    progress: job.progress,
    docsType: job.docsType,
    forceDocsType: job.forceDocsType,
    stats: job.result?.stats,
    hasResult: Boolean(job.result),
    error: job.error,
  });
}

