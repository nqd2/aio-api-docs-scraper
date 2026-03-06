import { runScrapePipeline } from "../pipeline";
import { completeJob, failJob, getJob, setJobProgress } from "./store";

export function startJob(jobId: string) {
  // Fire-and-forget background execution.
  // In serverless this is best-effort; locally it enables real-time UI.
  void runJob(jobId);
}

async function runJob(jobId: string) {
  const job = getJob(jobId);
  if (!job) return;

  try {
    setJobProgress(jobId, {
      status: "running",
      progress: { step: "detecting", percent: 5, message: "Detecting documentation type..." },
    });

    setJobProgress(jobId, {
      status: "running",
      progress: { step: "scraping", percent: 20, message: "Scraping documentation (rendering JS if needed)..." },
    });

    const result = await runScrapePipeline(job.url, job.forceDocsType);

    setJobProgress(jobId, {
      status: "running",
      progress: { step: "finalizing", percent: 95, message: "Finalizing result..." },
    });

    completeJob(jobId, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    failJob(jobId, message);
  }
}

