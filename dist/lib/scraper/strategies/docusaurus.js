"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocusaurusStrategy = void 0;
const cheerio = __importStar(require("cheerio"));
const doc_fetch_1 = require("../../http/doc-fetch");
const redoc_1 = require("./redoc");
const MAX_PAGES = 220;
const MAX_QUEUE = 600;
function normalizeSameOriginLink(baseUrl, href) {
    try {
        const u = new URL(href, baseUrl);
        u.hash = '';
        return u.toString();
    }
    catch {
        return null;
    }
}
function getSectionPrefix(pathname) {
    const docsIdx = pathname.indexOf('/docs/');
    if (docsIdx < 0)
        return '/docs/';
    const rest = pathname.slice(docsIdx + 6); // after /docs/
    const first = rest.split('/').filter(Boolean)[0];
    return first ? `/docs/${first}/` : '/docs/';
}
function collectSameSectionLinks(params) {
    const $ = cheerio.load(params.html);
    const out = [];
    $('a[href]').each((_, a) => {
        const href = $(a).attr('href');
        if (!href)
            return;
        const abs = normalizeSameOriginLink(params.pageUrl, href);
        if (!abs)
            return;
        try {
            const u = new URL(abs);
            if (u.origin !== params.origin)
                return;
            if (!u.pathname.startsWith(params.prefix))
                return;
            out.push(u.toString());
        }
        catch {
            // ignore
        }
    });
    return out;
}
function extractEndpointsFromHtml(html) {
    const $ = cheerio.load(html);
    const endpoints = [];
    const seen = new Set();
    const serverOrigins = new Set();
    const addEndpointFromUrl = (methodRaw, href, summary) => {
        const method = methodRaw.trim().toUpperCase();
        if (!/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/.test(method))
            return;
        try {
            const u = new URL(href);
            const path = u.pathname || '/';
            const key = `${method} ${path}`;
            if (seen.has(key))
                return;
            seen.add(key);
            serverOrigins.add(u.origin);
            endpoints.push({
                method,
                path,
                summary,
                parameters: [],
                responses: [],
            });
        }
        catch {
            // ignore invalid url
        }
    };
    // Pattern used by many Docusaurus API docs themes/plugins:
    // <div class="api-endpoint"><span class="badge ...">POST</span><code><a href="https://api.example.com/path">...</a></code></div>
    $('.api-endpoint').each((_, el) => {
        const method = $(el).find('.badge').first().text().trim().toUpperCase();
        const href = $(el).find('a[href]').first().attr('href') ||
            $(el).find('code a[href]').first().attr('href') ||
            $(el).find('code').text().trim();
        if (!method || !href)
            return;
        if (!/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/i.test(method))
            return;
        const summary = $(el).prevAll('h1,h2,h3').first().text().trim() || undefined;
        addEndpointFromUrl(method, href, summary);
    });
    // Inline code patterns (common in Docusaurus Markdown):
    // POST`<https://api.1min.ai/api/features>` or POST <https://api.1min.ai/api/features>
    const htmlText = $('main').text().replace(/\s+/g, ' ');
    const urlMatches = Array.from(htmlText.matchAll(/\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b\s*<?\s*(https?:\/\/[^\s>]+)\s*>?/gi));
    for (const m of urlMatches) {
        addEndpointFromUrl(m[1], m[2]);
    }
    $('h1, h2, h3, h4').each((_, heading) => {
        const text = $(heading).text().trim();
        const methodMatch = text.match(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(.+)$/i);
        if (!methodMatch)
            return;
        const method = methodMatch[1].toUpperCase();
        const raw = methodMatch[2].trim();
        const pathToken = raw.split(/\s+/)[0] || '';
        // Avoid false positives like "POST Dzine" where token isn't a path/url.
        if (!pathToken.startsWith('/') && !pathToken.startsWith('http://') && !pathToken.startsWith('https://'))
            return;
        const path = pathToken.startsWith('/') ? pathToken : (() => {
            try {
                return new URL(pathToken).pathname || '/';
            }
            catch {
                return '/';
            }
        })();
        const key = `${method} ${path}`;
        if (seen.has(key))
            return;
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
class DocusaurusStrategy {
    async scrape(url) {
        const start = await (0, doc_fetch_1.fetchDocHtml)(url);
        if (start.status >= 400) {
            throw new Error(`Unable to load Docusaurus page: HTTP ${start.status}`);
        }
        // If the page embeds Redoc and we can’t extract endpoints via headings,
        // hand off to RedocStrategy (more likely to work for API reference pages).
        const hasEmbeddedRedoc = start.html.toLowerCase().includes('<redoc') ||
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
        const visited = new Set();
        const queue = [];
        const enqueue = (u) => {
            if (visited.has(u))
                return;
            if (queue.length + visited.size >= MAX_QUEUE)
                return;
            visited.add(u);
            queue.push(u);
        };
        enqueue(startUrl.toString());
        const endpointsByKey = new Map();
        const serverOrigins = new Set();
        let processed = 0;
        while (queue.length > 0 && processed < MAX_PAGES) {
            const pageUrl = queue.shift();
            processed += 1;
            try {
                const page = pageUrl === startUrl.toString() ? start : await (0, doc_fetch_1.fetchDocHtml)(pageUrl);
                if (page.status >= 400)
                    continue;
                const extracted = extractEndpointsFromHtml(page.html);
                for (const ep of extracted.endpoints)
                    endpointsByKey.set(`${ep.method} ${ep.path}`, ep);
                for (const o of extracted.serverOrigins)
                    serverOrigins.add(o);
                const links = collectSameSectionLinks({ html: page.html, pageUrl: page.url, origin, prefix });
                for (const l of links)
                    enqueue(l);
            }
            catch {
                // ignore per-page failures
            }
        }
        const endpoints = Array.from(endpointsByKey.values());
        if (endpoints.length === 0 && hasEmbeddedRedoc) {
            console.log('[DocusaurusStrategy] Found embedded Redoc. Falling back to RedocStrategy.');
            return await new redoc_1.RedocStrategy().scrape(url);
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
exports.DocusaurusStrategy = DocusaurusStrategy;
