"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJob = createJob;
exports.getJob = getJob;
exports.listJobs = listJobs;
exports.updateJob = updateJob;
exports.setJobProgress = setJobProgress;
exports.completeJob = completeJob;
exports.failJob = failJob;
exports.subscribe = subscribe;
function getStore() {
    const g = globalThis;
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
function createJob(params) {
    const store = getStore();
    const id = crypto.randomUUID();
    const createdAt = nowIso();
    const progress = { step: "queued", percent: 0, message: "Job created" };
    const job = {
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
function getJob(jobId) {
    return getStore().jobs.get(jobId);
}
function listJobs(limit = 20) {
    const jobs = Array.from(getStore().jobs.values());
    jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return jobs.slice(0, limit);
}
function updateJob(jobId, patch) {
    const store = getStore();
    const current = store.jobs.get(jobId);
    if (!current)
        return;
    const updated = { ...current, ...patch, updatedAt: nowIso() };
    store.jobs.set(jobId, updated);
    publish(jobId, { type: "snapshot", data: updated });
}
function setJobProgress(jobId, params) {
    const store = getStore();
    const current = store.jobs.get(jobId);
    if (!current)
        return;
    const updatedAt = nowIso();
    const updated = {
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
function completeJob(jobId, result) {
    const store = getStore();
    const current = store.jobs.get(jobId);
    if (!current)
        return;
    const updatedAt = nowIso();
    const updated = {
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
function failJob(jobId, message) {
    const store = getStore();
    const current = store.jobs.get(jobId);
    if (!current)
        return;
    const updatedAt = nowIso();
    const updated = {
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
function subscribe(jobId, listener) {
    const store = getStore();
    if (!store.listeners.has(jobId))
        store.listeners.set(jobId, new Set());
    store.listeners.get(jobId).add(listener);
    return () => {
        store.listeners.get(jobId)?.delete(listener);
    };
}
function publish(jobId, event) {
    const store = getStore();
    const next = store.nextEventId.get(jobId) ?? 1;
    store.nextEventId.set(jobId, next + 1);
    const payload = { ...event, id: next };
    const subs = store.listeners.get(jobId);
    if (!subs || subs.size === 0)
        return;
    for (const cb of subs)
        cb(payload);
}
