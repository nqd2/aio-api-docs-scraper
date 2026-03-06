"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJob = startJob;
const pipeline_1 = require("../pipeline");
const store_1 = require("./store");
function startJob(jobId) {
    // Fire-and-forget background execution.
    // In serverless this is best-effort; locally it enables real-time UI.
    void runJob(jobId);
}
async function runJob(jobId) {
    const job = (0, store_1.getJob)(jobId);
    if (!job)
        return;
    try {
        (0, store_1.setJobProgress)(jobId, {
            status: "running",
            progress: { step: "detecting", percent: 5, message: "Detecting documentation type..." },
        });
        (0, store_1.setJobProgress)(jobId, {
            status: "running",
            progress: { step: "scraping", percent: 20, message: "Scraping documentation (rendering JS if needed)..." },
        });
        const result = await (0, pipeline_1.runScrapePipeline)(job.url, job.forceDocsType);
        (0, store_1.setJobProgress)(jobId, {
            status: "running",
            progress: { step: "finalizing", percent: 95, message: "Finalizing result..." },
        });
        (0, store_1.completeJob)(jobId, result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        (0, store_1.failJob)(jobId, message);
    }
}
