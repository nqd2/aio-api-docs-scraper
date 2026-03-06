#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const pipeline_1 = require("../lib/pipeline");
const to_yaml_1 = require("../lib/utils/to-yaml");
const DOCS_TYPES = ["auto", "swagger", "redoc", "redocly", "docusaurus"];
const FORMATS = ["openapi", "postman"];
const AS_EXT = ["json", "yaml"];
function parseArgs() {
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
    let docsType;
    let format = "openapi";
    let output = null;
    let as = "json";
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
            if (!val || !DOCS_TYPES.includes(val)) {
                console.error(`Invalid --docs-type. Must be one of: ${DOCS_TYPES.join(", ")}`);
                process.exit(1);
            }
            docsType = val === "auto" ? undefined : val;
            continue;
        }
        if (arg === "--format" || arg === "-f") {
            const val = args[++i];
            if (!val || !FORMATS.includes(val)) {
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
            if (!val || !AS_EXT.includes(val)) {
                console.error(`Invalid --as. Must be one of: ${AS_EXT.join(", ")}`);
                process.exit(1);
            }
            as = val;
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
function normalizeUrl(input) {
    const raw = input.trim();
    if (!raw)
        return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://"))
        return raw;
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
        const result = await (0, pipeline_1.runScrapePipeline)(normalizedUrl, docsType);
        const payload = format === "openapi" ? result.openapi : result.postman;
        let text;
        if (format === "openapi" && as === "yaml") {
            text = (0, to_yaml_1.toYaml)(payload);
        }
        else {
            text = JSON.stringify(payload, null, 2);
        }
        if (output) {
            (0, node_fs_1.writeFileSync)(output, text, "utf-8");
            console.error(`[apidocs] Saved to ${output}`);
            console.error(`[apidocs] ${result.stats.title} v${result.stats.version} · ${result.stats.endpointsCount} endpoints`);
        }
        else {
            process.stdout.write(text);
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[apidocs] Error: ${message}`);
        process.exit(1);
    }
}
main();
