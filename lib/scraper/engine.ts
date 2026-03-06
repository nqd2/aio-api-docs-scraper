import { ApiDocument, ScraperStrategy } from '../types';
import { detectDocsType } from './detectors';
import { SwaggerStrategy } from './strategies/swagger';
import { RedocStrategy } from './strategies/redoc';
import { DocusaurusStrategy } from './strategies/docusaurus';

export class ScraperEngine {
  private strategies: Map<string, ScraperStrategy> = new Map();

  constructor() {
    this.strategies.set('swagger', new SwaggerStrategy());
    this.strategies.set('redoc', new RedocStrategy());
    this.strategies.set('docusaurus', new DocusaurusStrategy());
    // Future: add Redocly, etc.
  }

  async scrape(url: string, forceDocsType?: 'swagger' | 'redoc' | 'redocly' | 'docusaurus' | 'unknown'): Promise<ApiDocument> {
    console.log(`[ScraperEngine] Fetching initial HTML from ${url}...`);
    
    // First, do a quick fetch to detect the document type
    let htmlContent = '';
    let resolvedUrl = url;
    try {
      const response = await fetch(url, {
          headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html'
          },
          redirect: 'follow'
      });
      htmlContent = await response.text();

      // If user pasted a "section root" that 404s (common in Docusaurus),
      // try to resolve to a concrete child route by looking at homepage links.
      if (response.status === 404) {
        try {
          const u = new URL(url);
          const prefix = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
          const homeRes = await fetch(u.origin, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html'
            },
            redirect: 'follow'
          });
          if (homeRes.ok) {
            const homeHtml = await homeRes.text();
            const hrefs = Array.from(homeHtml.matchAll(/href="([^"]+)"/g)).map((m) => m[1]);
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

            if (candidates.length > 0) {
              const best = candidates.sort((a, b) => a.length - b.length)[0];
              console.log(`[ScraperEngine] URL returned 404. Resolved to a child route: ${best}`);
              resolvedUrl = best;
              const res2 = await fetch(best, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'text/html'
                },
                redirect: 'follow'
              });
              if (res2.ok) {
                htmlContent = await res2.text();
              }
            }
          }
        } catch {
          // ignore best-effort resolution
        }
      }
    } catch (error) {
      console.warn(`[ScraperEngine] Failed to fetch raw HTML for detection, will default to Swagger. Error:`, error);
    }

    const docsType = forceDocsType || detectDocsType(htmlContent, resolvedUrl);
    console.log(`[ScraperEngine] Detected docs type: ${docsType}`);

    const strategy = this.strategies.get(docsType);
    if (strategy) {
      return await strategy.scrape(resolvedUrl);
    } else {
      console.log(`[ScraperEngine] Strategy for ${docsType} not fully implemented or unknown, trying Swagger strategy as fallback.`);
      // Fallback
      return await this.strategies.get('swagger')!.scrape(resolvedUrl);
    }
  }
}
