#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Node launcher script, must use require */
const { spawnSync } = require("child_process");
const path = require("path");

const isWindows = process.platform === "win32";
const tsxBin = path.join(__dirname, "..", "node_modules", ".bin", isWindows ? "tsx.cmd" : "tsx");
const scriptPath = path.join(__dirname, "apidocs.ts");

const r = spawnSync(tsxBin, [scriptPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  windowsHide: true,
});

process.exit(r.status ?? (r.signal ? 1 : 0));
