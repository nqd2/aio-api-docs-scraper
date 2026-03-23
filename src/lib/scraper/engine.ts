import { ApiDocument, ScraperStrategy } from "../types";
import { fetchDocHtmlWith404Retry } from "../http/doc-fetch";
import { detectDocsType } from "./detectors";
import { SwaggerStrategy } from "./strategies/swagger";
import { RedocStrategy } from "./strategies/redoc";
import { DocusaurusStrategy } from "./strategies/docusaurus";

export class ScraperEngine {
  private strategies: Map<string, ScraperStrategy> = new Map();

  constructor() {
    this.strategies.set("swagger", new SwaggerStrategy());
    this.strategies.set("redoc", new RedocStrategy());
    this.strategies.set("docusaurus", new DocusaurusStrategy());
  }

  async scrape(
    url: string,
    forceDocsType?: "swagger" | "redoc" | "redocly" | "docusaurus" | "unknown",
  ): Promise<ApiDocument> {
    console.log(`[ScraperEngine] Fetching initial HTML from ${url}...`);

    const { resolvedUrl, html: htmlContent } = await fetchDocHtmlWith404Retry(url);

    const docsType = forceDocsType || detectDocsType(htmlContent, resolvedUrl);
    console.log(`[ScraperEngine] Detected docs type: ${docsType}`);

    const strategy = this.strategies.get(docsType);
    if (strategy) {
      return await strategy.scrape(resolvedUrl);
    }

    console.log(
      `[ScraperEngine] Strategy for ${docsType} not fully implemented or unknown, trying Swagger strategy as fallback.`,
    );
    return await this.strategies.get("swagger")!.scrape(resolvedUrl);
  }
}
