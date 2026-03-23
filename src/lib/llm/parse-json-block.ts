/** Strip optional ```json fences and parse. */
export function parseJsonFromLlmText(raw: string): unknown {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im.exec(s);
  if (fence) {
    s = fence[1].trim();
  } else if (s.startsWith("```")) {
    s = s.replace(/^```[^\n]*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return JSON.parse(s) as unknown;
}
