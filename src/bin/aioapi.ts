#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { normalizeUrl, parseArgs } from "../lib/cli/aioapi-args";
import { readLlmConfig } from "../lib/llm/config";
import { runHybridPipeline, runLlmPipeline } from "../lib/llm/llm-pipeline";
import { runScrapePipeline } from "../lib/pipeline";
import { toYaml } from "../lib/utils/to-yaml";

async function main() {
  const {
    url,
    docsType,
    format,
    output,
    as,
    strategy,
    llmMaxPages,
    llmMaxChars,
    llmPromptPath,
  } = parseArgs(process.argv.slice(2));
  const normalizedUrl = normalizeUrl(url);

  if (!/^https?:\/\/.+/.test(normalizedUrl)) {
    console.error("Error: Invalid URL. Include https://");
    process.exit(1);
  }

  console.error(`[aioapi] Scraping ${normalizedUrl} (strategy: ${strategy})...`);
  if (docsType) {
    console.error(`[aioapi] Docs type: ${docsType}`);
  }

  const llmOpts = {
    startUrl: normalizedUrl,
    maxPages: llmMaxPages,
    maxTotalChars: llmMaxChars,
    promptPath: llmPromptPath,
    llmConfig: readLlmConfig(),
  };

  try {
    const result =
      strategy === "dom"
        ? await runScrapePipeline(normalizedUrl, docsType)
        : strategy === "llm"
          ? await runLlmPipeline(llmOpts)
          : await runHybridPipeline(normalizedUrl, docsType, llmOpts);

    const payload = format === "openapi" ? result.openapi : result.postman;

    const text =
      format === "openapi" && as === "yaml" ? toYaml(payload) : JSON.stringify(payload, null, 2);

    if (output) {
      writeFileSync(output, text, "utf-8");
      console.error(`[aioapi] Saved to ${output}`);
      console.error(
        `[aioapi] ${result.stats.title} v${result.stats.version} · ${result.stats.endpointsCount} endpoints`,
      );
    } else {
      process.stdout.write(text);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[aioapi] Error: ${message}`);
    process.exit(1);
  }
}

void main();
