import { readFileSync } from "node:fs";
import { z } from "zod";
import { crawlSameOriginText, pagesToLlmContext } from "../web/crawl-site";
import { assertLlmReady, readLlmConfig, type LlmRuntimeConfig } from "./config";
import { completeLlm } from "./client";
import { mergeOpenApiTemplate, mergePostmanTemplate } from "./merge-spec";
import { parseJsonFromLlmText } from "./parse-json-block";
import { resolvePromptFile, resolveTemplateFile } from "./paths";
import type { DocsType } from "../types";
import { runScrapePipeline, type PipelineResult } from "../pipeline";

const LlmBundleSchema = z.object({
  openapi: z.unknown(),
  postman: z.unknown(),
});

export type LlmPipelineOptions = {
  startUrl: string;
  maxPages: number;
  maxTotalChars: number;
  promptPath?: string;
  llmConfig?: LlmRuntimeConfig;
};

export function countOpenApiPathOperations(spec: unknown): number {
  const paths = (spec as { paths?: Record<string, Record<string, unknown>> })?.paths;
  if (!paths || typeof paths !== "object") return 0;
  const verbs = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
  let n = 0;
  for (const item of Object.values(paths)) {
    if (!item || typeof item !== "object") continue;
    for (const k of Object.keys(item)) {
      if (verbs.has(k.toLowerCase())) n++;
    }
  }
  return n;
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}

export async function runLlmPipeline(opts: LlmPipelineOptions): Promise<PipelineResult> {
  const cfg = opts.llmConfig ?? readLlmConfig();
  assertLlmReady(cfg);

  const promptPath = resolvePromptFile(opts.promptPath);
  const systemPrompt = readFileSync(promptPath, "utf-8");

  const openapiTemplate = readJsonFile(resolveTemplateFile("openapi-template.json"));
  const postmanTemplate = readJsonFile(resolveTemplateFile("postman-template.json"));

  console.error(`[aioapi] LLM crawl: ${opts.startUrl} (max ${opts.maxPages} pages, ~${opts.maxTotalChars} chars)`);
  const pages = await crawlSameOriginText({
    startUrl: opts.startUrl,
    maxPages: opts.maxPages,
    maxTotalChars: opts.maxTotalChars,
  });

  if (pages.length === 0) {
    throw new Error("LLM crawl: no HTML pages could be fetched. Check the URL and network.");
  }

  const context = pagesToLlmContext(pages);
  const userPrompt = [
    "Below is plain text extracted from crawled documentation pages. Produce the JSON object as specified in your instructions.",
    "",
    "Reference templates (structure hints only):",
    "",
    "openapi-template:",
    JSON.stringify(openapiTemplate, null, 2),
    "",
    "postman-template:",
    JSON.stringify(postmanTemplate, null, 2),
    "",
    "CRAWLED_CONTENT_START",
    context,
    "CRAWLED_CONTENT_END",
  ].join("\n");

  const raw = await completeLlm(cfg, systemPrompt, userPrompt);
  let parsed: unknown;
  try {
    parsed = parseJsonFromLlmText(raw);
  } catch (e) {
    throw new Error(
      `LLM returned non-JSON: ${e instanceof Error ? e.message : String(e)}. First 400 chars: ${raw.slice(0, 400)}`,
    );
  }

  const bundle = LlmBundleSchema.safeParse(parsed);
  if (!bundle.success) {
    throw new Error(`LLM JSON missing openapi/postman keys: ${bundle.error.message}`);
  }

  const openapi = mergeOpenApiTemplate(openapiTemplate, bundle.data.openapi);
  const postman = mergePostmanTemplate(postmanTemplate, bundle.data.postman);

  const o = openapi as { info?: { title?: string; version?: string } };
  const title = typeof o.info?.title === "string" ? o.info.title : "API";
  const version = typeof o.info?.version === "string" ? o.info.version : "1.0.0";
  const endpointsCount = countOpenApiPathOperations(openapi);

  return {
    openapi,
    postman,
    stats: {
      title,
      version,
      docsType: undefined,
      endpointsCount,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function runHybridPipeline(
  url: string,
  forceDocsType: DocsType | undefined,
  llmOpts: LlmPipelineOptions,
): Promise<PipelineResult> {
  try {
    const r = await runScrapePipeline(url, forceDocsType);
    if (r.stats.endpointsCount > 0) {
      return r;
    }
    console.error("[aioapi] DOM pipeline returned 0 endpoints; falling back to LLM crawl.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[aioapi] DOM pipeline failed (${msg}); falling back to LLM crawl.`);
  }
  return runLlmPipeline({ ...llmOpts, startUrl: url });
}
