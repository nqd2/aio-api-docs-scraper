import type { DocsType } from "../types";

export const DOCS_TYPES = ["auto", "swagger", "redoc", "redocly", "docusaurus"] as const;
export const FORMATS = ["openapi", "postman"] as const;
export const AS_EXT = ["json", "yaml"] as const;
export const STRATEGIES = ["dom", "llm", "hybrid"] as const;

export type CliOptions = {
  url: string;
  docsType: DocsType | undefined;
  format: string;
  output: string | null;
  as: "json" | "yaml";
  strategy: (typeof STRATEGIES)[number];
  llmMaxPages: number;
  llmMaxChars: number;
  llmPromptPath?: string;
};

const HELP_LINES = [
  "Usage: aioapi <url> [options]",
  "",
  "Arguments:",
  "  url                    API docs URL (required)",
  "",
  "Options:",
  "  --docs-type, -t <type> Docs type: auto|swagger|redoc|redocly|docusaurus (default: auto)",
  "  --format, -f <format> Output format: openapi|postman (default: openapi)",
  "  --output, -o <file>   Output file (default: stdout)",
  "  --as <ext>             For openapi: json|yaml (default: json)",
  "  --strategy, -S <mode> dom|llm|hybrid (default: dom). llm = crawl site + LLM. hybrid = DOM then LLM if empty/fail.",
  "  --llm-max-pages <n>   Max same-origin pages to crawl for LLM (default: 20)",
  "  --llm-max-chars <n>   Max total chars sent to LLM (default: 100000)",
  "  --llm-prompt <file>   Override prompts/prompt.md",
] as const;

export function printHelp(to: "stdout" | "stderr"): void {
  const log = to === "stdout" ? console.log : console.error;
  for (const line of HELP_LINES) {
    log(line);
  }
}

export function parseArgs(argv: string[]): CliOptions {
  if (argv.length === 0) {
    printHelp("stderr");
    process.exit(1);
  }

  let url = "";
  let docsType: DocsType | undefined;
  let format = "openapi";
  let output: string | null = null;
  let as: "json" | "yaml" = "json";
  let strategy: (typeof STRATEGIES)[number] = "dom";
  let llmMaxPages = 20;
  let llmMaxChars = 100_000;
  let llmPromptPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printHelp("stdout");
      process.exit(0);
    }
    if (arg === "--docs-type" || arg === "-t") {
      const val = argv[++i];
      if (!val || !DOCS_TYPES.includes(val as (typeof DOCS_TYPES)[number])) {
        console.error(`Invalid --docs-type. Must be one of: ${DOCS_TYPES.join(", ")}`);
        process.exit(1);
      }
      docsType = val === "auto" ? undefined : (val as DocsType);
      continue;
    }
    if (arg === "--format" || arg === "-f") {
      const val = argv[++i];
      if (!val || !FORMATS.includes(val as (typeof FORMATS)[number])) {
        console.error(`Invalid --format. Must be one of: ${FORMATS.join(", ")}`);
        process.exit(1);
      }
      format = val;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      output = argv[++i] ?? null;
      if (!output) {
        console.error("--output requires a file path");
        process.exit(1);
      }
      continue;
    }
    if (arg === "--as") {
      const val = argv[++i];
      if (!val || !AS_EXT.includes(val as (typeof AS_EXT)[number])) {
        console.error(`Invalid --as. Must be one of: ${AS_EXT.join(", ")}`);
        process.exit(1);
      }
      as = val as "json" | "yaml";
      continue;
    }
    if (arg === "--strategy" || arg === "-S") {
      const val = argv[++i];
      if (!val || !STRATEGIES.includes(val as (typeof STRATEGIES)[number])) {
        console.error(`Invalid --strategy. Must be one of: ${STRATEGIES.join(", ")}`);
        process.exit(1);
      }
      strategy = val as (typeof STRATEGIES)[number];
      continue;
    }
    if (arg === "--llm-max-pages") {
      const val = argv[++i];
      const n = val ? parseInt(val, 10) : NaN;
      if (!Number.isFinite(n) || n < 1) {
        console.error("--llm-max-pages requires a positive integer");
        process.exit(1);
      }
      llmMaxPages = n;
      continue;
    }
    if (arg === "--llm-max-chars") {
      const val = argv[++i];
      const n = val ? parseInt(val, 10) : NaN;
      if (!Number.isFinite(n) || n < 1000) {
        console.error("--llm-max-chars requires an integer >= 1000");
        process.exit(1);
      }
      llmMaxChars = n;
      continue;
    }
    if (arg === "--llm-prompt") {
      llmPromptPath = argv[++i];
      if (!llmPromptPath) {
        console.error("--llm-prompt requires a file path");
        process.exit(1);
      }
      continue;
    }
    if (!arg.startsWith("-") && !url) {
      url = arg;
    }
  }

  if (!url) {
    console.error("Error: URL is required");
    printHelp("stderr");
    process.exit(1);
  }

  return { url, docsType, format, output, as, strategy, llmMaxPages, llmMaxChars, llmPromptPath };
}

export function normalizeUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}
