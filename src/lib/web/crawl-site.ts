import * as cheerio from "cheerio";
import { fetchDocHtml } from "../http/doc-fetch";
import { htmlToPlainText } from "./html-to-text";

export type CrawledPage = {
  url: string;
  title: string;
  text: string;
};

export type CrawlSiteOptions = {
  startUrl: string;
  maxPages: number;
  maxTotalChars: number;
};

function normalizeUrlKey(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    return x.toString();
  } catch {
    return u;
  }
}

function collectSameOriginLinks(html: string, pageUrl: string, origin: string): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) return;
    try {
      const abs = new URL(href, pageUrl);
      abs.hash = "";
      if (abs.origin !== origin) return;
      const ext = abs.pathname.toLowerCase();
      if (/\.(pdf|zip|tar|gz|png|jpe?g|gif|webp|ico|css|js|mjs|map)(\?|$)/i.test(ext)) return;
      out.push(abs.toString());
    } catch {
      // ignore
    }
  });
  return out;
}

/**
 * Breadth-first crawl of same-origin HTML pages; extracts plain text per page.
 */
export async function crawlSameOriginText(opts: CrawlSiteOptions): Promise<CrawledPage[]> {
  const origin = new URL(opts.startUrl).origin;
  const startKey = normalizeUrlKey(opts.startUrl);
  const visited = new Set<string>();
  const queue: string[] = [];
  const pages: CrawledPage[] = [];
  let totalChars = 0;

  const enqueue = (u: string) => {
    const k = normalizeUrlKey(u);
    if (visited.has(k)) return;
    const budget = Math.max(opts.maxPages * 12, 64);
    if (visited.size + queue.length >= budget) return;
    visited.add(k);
    queue.push(k);
  };

  enqueue(startKey);

  while (queue.length > 0 && pages.length < opts.maxPages) {
    const url = queue.shift()!;
    try {
      const { url: finalUrl, status, html } = await fetchDocHtml(url);
      if (status < 200 || status >= 400) continue;

      const text = htmlToPlainText(html);
      if (text.length === 0) continue;

      const title = cheerio.load(html)("title").first().text().trim() || url;
      const chunk = `### Page: ${finalUrl}\n\n${text}`;

      if (totalChars + chunk.length > opts.maxTotalChars) {
        const rest = opts.maxTotalChars - totalChars;
        if (rest > 500) {
          pages.push({ url: finalUrl, title, text: chunk.slice(0, rest) + "\n\n[truncated]" });
          totalChars = opts.maxTotalChars;
        }
        break;
      }

      totalChars += chunk.length;
      pages.push({ url: finalUrl, title, text: chunk });

      for (const link of collectSameOriginLinks(html, finalUrl, origin)) {
        if (pages.length + queue.length >= opts.maxPages) break;
        const lk = normalizeUrlKey(link);
        if (!visited.has(lk)) enqueue(link);
      }
    } catch {
      // skip bad page
    }
  }

  return pages;
}

export function pagesToLlmContext(pages: CrawledPage[]): string {
  return pages.map((p) => p.text).join("\n\n---\n\n");
}
