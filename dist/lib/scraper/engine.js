"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperEngine = void 0;
const doc_fetch_1 = require("../http/doc-fetch");
const detectors_1 = require("./detectors");
const swagger_1 = require("./strategies/swagger");
const redoc_1 = require("./strategies/redoc");
const docusaurus_1 = require("./strategies/docusaurus");
class ScraperEngine {
    constructor() {
        this.strategies = new Map();
        this.strategies.set("swagger", new swagger_1.SwaggerStrategy());
        this.strategies.set("redoc", new redoc_1.RedocStrategy());
        this.strategies.set("docusaurus", new docusaurus_1.DocusaurusStrategy());
    }
    async scrape(url, forceDocsType) {
        console.log(`[ScraperEngine] Fetching initial HTML from ${url}...`);
        const { resolvedUrl, html: htmlContent } = await (0, doc_fetch_1.fetchDocHtmlWith404Retry)(url);
        const docsType = forceDocsType || (0, detectors_1.detectDocsType)(htmlContent, resolvedUrl);
        console.log(`[ScraperEngine] Detected docs type: ${docsType}`);
        const strategy = this.strategies.get(docsType);
        if (strategy) {
            return await strategy.scrape(resolvedUrl);
        }
        console.log(`[ScraperEngine] Strategy for ${docsType} not fully implemented or unknown, trying Swagger strategy as fallback.`);
        return await this.strategies.get("swagger").scrape(resolvedUrl);
    }
}
exports.ScraperEngine = ScraperEngine;
