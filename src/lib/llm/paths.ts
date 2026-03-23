import path from "node:path";

/** Repo / package root (works from `src` via tsx and from `dist` after tsc). */
export function getPackageRoot(): string {
  return path.resolve(__dirname, "../../..");
}

export function resolvePromptFile(customPath: string | undefined, defaultRelative = "prompts/prompt.md"): string {
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.resolve(process.cwd(), customPath);
  }
  return path.join(getPackageRoot(), defaultRelative);
}

export function resolveTemplateFile(name: "openapi-template.json" | "postman-template.json"): string {
  return path.join(getPackageRoot(), "templates", name);
}
