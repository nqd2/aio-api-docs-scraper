import * as cheerio from 'cheerio';
import { fetchDocHtml, type FetchedDoc } from '../../http/doc-fetch';
import { ApiDocument, ApiEndpoint, ScraperStrategy } from '../../types';
import { RedocStrategy } from './redoc';

const MAX_PAGES = 220;
const MAX_QUEUE = 600;

function normalizeSameOriginLink(baseUrl: string, href: string): string | null {
  try {
    const u = new URL(href, baseUrl);
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function getSectionPrefix(pathname: string): string {
  const docsIdx = pathname.indexOf('/docs/');
  if (docsIdx < 0) return '/docs/';
  const rest = pathname.slice(docsIdx + 6); // after /docs/
  const first = rest.split('/').filter(Boolean)[0];
  return first ? `/docs/${first}/` : '/docs/';
}

function collectSameSectionLinks(params: { html: string; pageUrl: string; origin: string; prefix: string }): string[] {
  const $ = cheerio.load(params.html);
  const out: string[] = [];
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href');
    if (!href) return;
    const abs = normalizeSameOriginLink(params.pageUrl, href);
    if (!abs) return;
    try {
      const u = new URL(abs);
      if (u.origin !== params.origin) return;
      if (!u.pathname.startsWith(params.prefix)) return;
      out.push(u.toString());
    } catch {
      // ignore
    }
  });
  return out;
}

function extractEndpointsFromHtml(html: string): { endpoints: ApiEndpoint[]; serverOrigins: string[] } {
  const $ = cheerio.load(html);
  const endpoints: ApiEndpoint[] = [];
  const seen = new Set<string>();
  const serverOrigins = new Set<string>();

  const addEndpointFromUrl = (methodRaw: string, href: string, summary?: string) => {
    const method = methodRaw.trim().toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/.test(method)) return;
    try {
      const u = new URL(href);
      const path = u.pathname || '/';
      const key = `${method} ${path}`;
      if (seen.has(key)) return;
      seen.add(key);
      serverOrigins.add(u.origin);

      endpoints.push({
        method,
        path,
        summary,
        parameters: [],
        responses: [],
      });
    } catch {
      // ignore invalid url
    }
  };

  // Pattern used by many Docusaurus API docs themes/plugins:
  // <div class="api-endpoint"><span class="badge ...">POST</span><code><a href="https://api.example.com/path">...</a></code></div>
  $('.api-endpoint').each((_, el) => {
    const method = $(el).find('.badge').first().text().trim().toUpperCase();
    const href =
      $(el).find('a[href]').first().attr('href') ||
      $(el).find('code a[href]').first().attr('href') ||
      $(el).find('code').text().trim();

    if (!method || !href) return;
    if (!/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/i.test(method)) return;

    const summary = $(el).prevAll('h1,h2,h3').first().text().trim() || undefined;
    addEndpointFromUrl(method, href, summary);
  });

  // Inline code patterns (common in Docusaurus Markdown):
  // POST`<https://api.1min.ai/api/features>` or POST <https://api.1min.ai/api/features>
  const htmlText = $('main').text().replace(/\s+/g, ' ');
  const urlMatches = Array.from(
    htmlText.matchAll(/\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b\s*<?\s*(https?:\/\/[^\s>]+)\s*>?/gi),
  );
  for (const m of urlMatches) {
    addEndpointFromUrl(m[1], m[2]);
  }

  $('h1, h2, h3, h4').each((_, heading) => {
    const text = $(heading).text().trim();
    const methodMatch = text.match(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(.+)$/i);
    if (!methodMatch) return;

    const method = methodMatch[1].toUpperCase();
    const raw = methodMatch[2].trim();
    const pathToken = raw.split(/\s+/)[0] || '';
    // Avoid false positives like "POST Dzine" where token isn't a path/url.
    if (!pathToken.startsWith('/') && !pathToken.startsWith('http://') && !pathToken.startsWith('https://')) return;
    const path = pathToken.startsWith('/') ? pathToken : (() => {
      try {
        return new URL(pathToken).pathname || '/';
      } catch {
        return '/';
      }
    })();

    const key = `${method} ${path}`;
    if (seen.has(key)) return;
    seen.add(key);

    const summaryText = text.replace(methodMatch[1], '').replace(pathToken, '').trim();
    const summary = summaryText || $(heading).next('p').text().trim() || undefined;

    endpoints.push({
      method,
      path,
      summary,
      parameters: [],
      responses: [],
    });
  });

  return { endpoints, serverOrigins: Array.from(serverOrigins) };
}

export class DocusaurusStrategy implements ScraperStrategy {
  async scrape(url: string): Promise<ApiDocument> {
    const start = await fetchDocHtml(url);
    if (start.status >= 400) {
      throw new Error(`Unable to load Docusaurus page: HTTP ${start.status}`);
    }

    // If the page embeds Redoc and we can’t extract endpoints via headings,
    // hand off to RedocStrategy (more likely to work for API reference pages).
    const hasEmbeddedRedoc =
      start.html.toLowerCase().includes('<redoc') ||
      start.html.toLowerCase().includes('id="redoc-container"') ||
      start.html.toLowerCase().includes('redoc-wrap');

    const $start = cheerio.load(start.html);
    const title = $start('h1').first().text().trim() || 'Docusaurus API';
    const description = $start('main p').first().text().trim() || '';

    // Crawl docs pages in the same /docs/<section>/ subtree (BFS),
    // collecting deeper links from each page (depth-safe).
    const startUrl = new URL(start.url);
    const origin = startUrl.origin;
    const prefix = getSectionPrefix(startUrl.pathname);

    const visited = new Set<string>();
    const queue: string[] = [];
    const enqueue = (u: string) => {
      if (visited.has(u)) return;
      if (queue.length + visited.size >= MAX_QUEUE) return;
      visited.add(u);
      queue.push(u);
    };

    enqueue(startUrl.toString());

    const endpointsByKey = new Map<string, ApiEndpoint>();

    const serverOrigins = new Set<string>();

    let processed = 0;
    while (queue.length > 0 && processed < MAX_PAGES) {
      const pageUrl = queue.shift()!;
      processed += 1;

      try {
        const page: FetchedDoc = pageUrl === startUrl.toString() ? start : await fetchDocHtml(pageUrl);
        if (page.status >= 400) continue;

        const extracted = extractEndpointsFromHtml(page.html);
        for (const ep of extracted.endpoints) endpointsByKey.set(`${ep.method} ${ep.path}`, ep);
        for (const o of extracted.serverOrigins) serverOrigins.add(o);

        const links = collectSameSectionLinks({ html: page.html, pageUrl: page.url, origin, prefix });
        for (const l of links) enqueue(l);
      } catch {
        // ignore per-page failures
      }
    }

    const endpoints = Array.from(endpointsByKey.values());

    if (endpoints.length === 0 && hasEmbeddedRedoc) {
      console.log('[DocusaurusStrategy] Found embedded Redoc. Falling back to RedocStrategy.');
      return await new RedocStrategy().scrape(url);
    }

    return {
      title,
      version: '1.0.0',
      description,
      servers: Array.from(serverOrigins).map((origin) => ({ url: origin })),
      endpoints,
    };
  }
}
