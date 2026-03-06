import { ScraperEngine } from "./scraper/engine";
import { OpenApiTransformer } from "./transformers/openapi";
import { PostmanTransformer } from "./transformers/postman";
import type { DocsType } from "./types";

export type PipelineResult = {
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

export async function runScrapePipeline(
  url: string,
  forceDocsType?: DocsType,
): Promise<PipelineResult> {
  const engine = new ScraperEngine();
  const doc = await engine.scrape(url, forceDocsType);

  const openapi = new OpenApiTransformer().transform(doc);
  const postman = new PostmanTransformer().transform(doc);

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
