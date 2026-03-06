import { ScraperEngine } from "../scraper/engine";
import { OpenApiTransformer } from "../transformers/openapi";
import { PostmanTransformer } from "../transformers/postman";
import type { DocsType } from "../types";
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

    const engine = new ScraperEngine();

    setJobProgress(jobId, {
      status: "running",
      progress: { step: "scraping", percent: 20, message: "Scraping documentation (rendering JS if needed)..." },
    });

    const doc = await engine.scrape(job.url, job.forceDocsType as DocsType | undefined);

    setJobProgress(jobId, {
      status: "running",
      docsType: job.forceDocsType,
      progress: { step: "transforming_openapi", percent: 70, message: "Transforming to OpenAPI JSON..." },
    });
    const openapi = new OpenApiTransformer().transform(doc);

    setJobProgress(jobId, {
      status: "running",
      progress: { step: "transforming_postman", percent: 85, message: "Transforming to Postman collection..." },
    });
    const postman = new PostmanTransformer().transform(doc);

    setJobProgress(jobId, {
      status: "running",
      progress: { step: "finalizing", percent: 95, message: "Finalizing result..." },
    });

    completeJob(jobId, {
      openapi,
      postman,
      stats: {
        title: doc.title,
        version: doc.version,
        docsType: job.forceDocsType,
        endpointsCount: doc.endpoints.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    failJob(jobId, message);
  }
}

