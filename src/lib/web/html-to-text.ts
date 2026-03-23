import * as cheerio from "cheerio";

/** Strip scripts/styles and collapse whitespace for LLM context. */
export function htmlToPlainText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  const title = $("title").first().text().trim();
  const h1 = $("h1").first().text().trim();
  $("body *")
    .contents()
    .filter(function () {
      return this.type === "comment";
    })
    .remove();
  const body = $("body").text() || $.root().text();
  const text = body.replace(/\s+/g, " ").trim();
  const head = [title && `Title: ${title}`, h1 && h1 !== title && `H1: ${h1}`].filter(Boolean).join("\n");
  return head ? `${head}\n\n${text}` : text;
}
