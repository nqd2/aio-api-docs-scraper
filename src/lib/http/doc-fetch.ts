/** Shared headers for fetching documentation HTML (engine + crawlers). */
export const HTML_DOC_HEADERS: HeadersInit = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "text/html",
};

export type FetchedDoc = {
  url: string;
  status: number;
  html: string;
};

export async function fetchDocHtml(url: string): Promise<FetchedDoc> {
  const res = await fetch(url, {
    headers: HTML_DOC_HEADERS,
    redirect: "follow",
  });
  const html = await res.text();
  return { url: res.url || url, status: res.status, html };
}

function isOkStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * Loads HTML for a docs URL. If the URL returns 404, tries same-origin homepage links
 * under the original pathname prefix (Docusaurus-style section roots).
 */
export async function fetchDocHtmlWith404Retry(initialUrl: string): Promise<{ resolvedUrl: string; html: string }> {
  let resolvedUrl = initialUrl;
  let html = "";

  try {
    const first = await fetchDocHtml(initialUrl);
    resolvedUrl = first.url;
    html = first.html;

    if (first.status !== 404) {
      return { resolvedUrl, html };
    }

    try {
      const u = new URL(initialUrl);
      const prefix = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
      const home = await fetchDocHtml(u.origin);
      if (!isOkStatus(home.status)) {
        return { resolvedUrl, html };
      }

      const hrefs = Array.from(home.html.matchAll(/href="([^"]+)"/g)).map((m) => m[1]);
      const candidates = hrefs
        .map((h) => {
          try {
            return new URL(h, u.origin).toString();
          } catch {
            return null;
          }
        })
        .filter((x): x is string => Boolean(x))
        .filter((abs) => {
          try {
            const au = new URL(abs);
            return au.origin === u.origin && au.pathname.startsWith(prefix);
          } catch {
            return false;
          }
        });

      if (candidates.length === 0) {
        return { resolvedUrl, html };
      }

      const best = candidates.sort((a, b) => a.length - b.length)[0];
      console.log(`[ScraperEngine] URL returned 404. Resolved to a child route: ${best}`);
      const second = await fetchDocHtml(best);
      if (isOkStatus(second.status)) {
        return { resolvedUrl: second.url, html: second.html };
      }
    } catch {
      // best-effort resolution
    }
  } catch (error) {
    console.warn(
      `[ScraperEngine] Failed to fetch raw HTML for detection, will default to Swagger. Error:`,
      error,
    );
  }

  return { resolvedUrl, html };
}
