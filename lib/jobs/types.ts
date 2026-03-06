import type { DocsType } from "../types";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type JobProgressStep =
  | "queued"
  | "detecting"
  | "scraping"
  | "transforming_openapi"
  | "transforming_postman"
  | "finalizing"
  | "completed"
  | "failed";

export type JobProgress = {
  step: JobProgressStep;
  percent: number; // 0-100
  message?: string;
};

export type JobResult = {
  openapi: unknown;
  postman: unknown;
  stats: {
    title: string;
    version: string;
    docsType?: DocsType;
    endpointsCount: number;
    generatedAt: string;
  };
};

export type JobRecord = {
  id: string;
  url: string;
  forceDocsType?: DocsType;
  docsType?: DocsType;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  progress: JobProgress;
  result?: JobResult;
  error?: { message: string };
};

export type JobEvent =
  | { id: number; type: "snapshot"; data: JobRecord }
  | { id: number; type: "progress"; data: Pick<JobRecord, "status" | "progress" | "updatedAt" | "docsType"> }
  | { id: number; type: "completed"; data: Pick<JobRecord, "status" | "updatedAt"> }
  | { id: number; type: "failed"; data: { status: "failed"; updatedAt: string; error: { message: string } } };

