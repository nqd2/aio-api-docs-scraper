"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runScrapePipeline = runScrapePipeline;
const engine_1 = require("./scraper/engine");
const openapi_1 = require("./transformers/openapi");
const postman_1 = require("./transformers/postman");
async function runScrapePipeline(url, forceDocsType) {
    const engine = new engine_1.ScraperEngine();
    const doc = await engine.scrape(url, forceDocsType);
    const openapi = new openapi_1.OpenApiTransformer().transform(doc);
    const postman = new postman_1.PostmanTransformer().transform(doc);
    return {
        openapi,
        postman,
        stats: {
            title: doc.title,
            version: doc.version,
            docsType: forceDocsType,
            endpointsCount: doc.endpoints.length,
            generatedAt: new Date().toISOString(),
        },
    };
}
