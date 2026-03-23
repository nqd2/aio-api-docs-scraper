"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toYaml = toYaml;
function toYaml(value, indent = "") {
    const nextIndent = `${indent}  `;
    if (value === null || value === undefined) {
        return "null";
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (typeof value === "string") {
        if (value === "" ||
            /[{}:?&,*#!|><\n\r\t-]/.test(value) ||
            value.includes("[") ||
            value.includes("]")) {
            return JSON.stringify(value);
        }
        return value;
    }
    if (Array.isArray(value)) {
        if (value.length === 0)
            return "[]";
        return value
            .map((item) => {
            const rendered = toYaml(item, nextIndent);
            const needsBlock = /\n/.test(rendered);
            if (needsBlock) {
                return `${indent}- ${rendered.replace(/\n/g, `\n${nextIndent}`)}`;
            }
            return `${indent}- ${rendered}`;
        })
            .join("\n");
    }
    if (typeof value === "object") {
        const entries = Object.entries(value);
        if (entries.length === 0)
            return "{}";
        return entries
            .map(([key, v]) => {
            const safeKey = /^[a-zA-Z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
            const rendered = toYaml(v, nextIndent);
            if (rendered.includes("\n")) {
                return `${indent}${safeKey}:\n${nextIndent}${rendered.replace(/\n/g, `\n${nextIndent}`)}`;
            }
            return `${indent}${safeKey}: ${rendered}`;
        })
            .join("\n");
    }
    return JSON.stringify(value);
}
