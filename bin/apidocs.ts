#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { runScrapePipeline } from "../lib/pipeline";
import { toYaml } from "../lib/utils/to-yaml";
import type { DocsType } from "../lib/types";

const DOCS_TYPES = ["auto", "swagger", "redoc", "redocly", "docusaurus"] as const;
const FORMATS = ["openapi", "postman"] as const;
const AS_EXT = ["json", "yaml"] as const;

function parseArgs(): { url: string; docsType: DocsType | undefined; format: string; output: string | null; as: "json" | "yaml" } {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: apidocs <url> [options]");
    console.error("");
    console.error("Arguments:");
    console.error("  url                    API docs URL (required)");
    console.error("");
    console.error("Options:");
    console.error("  --docs-type, -t <type> Docs type: auto|swagger|redoc|redocly|docusaurus (default: auto)");
    console.error("  --format, -f <format> Output format: openapi|postman (default: openapi)");
    console.error("  --output, -o <file>   Output file (default: stdout)");
    console.error("  --as <ext>             For openapi: json|yaml (default: json)");
    process.exit(1);
  }

  let url = "";
  let docsType: DocsType | undefined;
  let format: string = "openapi";
  let output: string | null = null;
  let as: "json" | "yaml" = "json";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: apidocs <url> [options]");
      console.log("");
      console.log("Arguments:");
      console.log("  url                    API docs URL (required)");
      console.log("");
      console.log("Options:");
      console.log("  --docs-type, -t <type> Docs type: auto|swagger|redoc|redocly|docusaurus (default: auto)");
      console.log("  --format, -f <format> Output format: openapi|postman (default: openapi)");
      console.log("  --output, -o <file>   Output file (default: stdout)");
      console.log("  --as <ext>             For openapi: json|yaml (default: json)");
      process.exit(0);
    }
    if (arg === "--docs-type" || arg === "-t") {
      const val = args[++i];
      if (!val || !DOCS_TYPES.includes(val as (typeof DOCS_TYPES)[number])) {
        console.error(`Invalid --docs-type. Must be one of: ${DOCS_TYPES.join(", ")}`);
        process.exit(1);
      }
      docsType = val === "auto" ? undefined : (val as DocsType);
      continue;
    }
    if (arg === "--format" || arg === "-f") {
      const val = args[++i];
      if (!val || !FORMATS.includes(val as (typeof FORMATS)[number])) {
        console.error(`Invalid --format. Must be one of: ${FORMATS.join(", ")}`);
        process.exit(1);
      }
      format = val;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      output = args[++i] ?? null;
      if (!output) {
        console.error("--output requires a file path");
        process.exit(1);
      }
      continue;
    }
    if (arg === "--as") {
      const val = args[++i];
      if (!val || !AS_EXT.includes(val as (typeof AS_EXT)[number])) {
        console.error(`Invalid --as. Must be one of: ${AS_EXT.join(", ")}`);
        process.exit(1);
      }
      as = val as "json" | "yaml";
      continue;
    }
    if (!arg.startsWith("-") && !url) {
      url = arg;
    }
  }

  if (!url) {
    console.error("Error: URL is required");
    console.error("Usage: apidocs <url> [options]");
    process.exit(1);
  }

  return { url, docsType, format, output, as };
}

function normalizeUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

async function main() {
  const { url, docsType, format, output, as } = parseArgs();
  const normalizedUrl = normalizeUrl(url);

  if (!/^https?:\/\/.+/.test(normalizedUrl)) {
    console.error("Error: Invalid URL. Include https://");
    process.exit(1);
  }

  console.error(`[apidocs] Scraping ${normalizedUrl}...`);
  if (docsType) {
    console.error(`[apidocs] Docs type: ${docsType}`);
  }

  try {
    const result = await runScrapePipeline(normalizedUrl, docsType);

    const payload = format === "openapi" ? result.openapi : result.postman;

    let text: string;
    if (format === "openapi" && as === "yaml") {
      text = toYaml(payload);
    } else {
      text = JSON.stringify(payload, null, 2);
    }

    if (output) {
      writeFileSync(output, text, "utf-8");
      console.error(`[apidocs] Saved to ${output}`);
      console.error(`[apidocs] ${result.stats.title} v${result.stats.version} · ${result.stats.endpointsCount} endpoints`);
    } else {
      process.stdout.write(text);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[apidocs] Error: ${message}`);
    process.exit(1);
  }
}

main();
