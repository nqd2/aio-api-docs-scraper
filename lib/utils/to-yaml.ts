export function toYaml(value: unknown, indent = ""): string {
  const nextIndent = `${indent}  `;

  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") {
    if (value === "" || /[:\-\?\[\]\{\},&\*#\!\|\>\<\n\r\t]/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
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
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, v]) => {
        const safeKey = /^[a-zA-Z0-9_\-]+$/.test(key) ? key : JSON.stringify(key);
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
