"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwaggerStrategy = void 0;
const playwright_1 = require("playwright");
class SwaggerStrategy {
    detect(pageContent, _url) {
        const htmlLower = pageContent.toLowerCase();
        return htmlLower.includes('id="swagger-ui"') || htmlLower.includes('class="swagger-ui"');
    }
    async scrape(url) {
        const browser = await playwright_1.chromium.launch({ headless: true });
        const page = await browser.newPage();
        try {
            await page.goto(url, { waitUntil: 'networkidle' });
            // Wait for Swagger UI to render fully
            await page.waitForSelector('.opblock-summary-method', { timeout: 15000 }).catch(() => { });
            // Execute script in page context to extract data
            const extractedDoc = await page.evaluate(() => {
                const title = document.querySelector('.title span')?.textContent?.trim() || 'Swagger API';
                const version = document.querySelector('.version-stamp .version')?.textContent?.trim() || '1.0.0';
                const description = document.querySelector('.info .markdown p')?.textContent?.trim() || '';
                const toParamIn = (raw) => {
                    const v = raw.toLowerCase();
                    if (v.includes('path'))
                        return 'path';
                    if (v.includes('header'))
                        return 'header';
                    if (v.includes('cookie'))
                        return 'cookie';
                    if (v.includes('body'))
                        return 'body';
                    return 'query';
                };
                const servers = [];
                const serverSelect = document.querySelector('.servers select');
                if (serverSelect) {
                    Array.from(serverSelect.options).forEach(opt => {
                        servers.push({ url: opt.value, description: opt.textContent?.trim() || '' });
                    });
                }
                const endpoints = [];
                // Loop through each operation block
                const opblocks = document.querySelectorAll('.opblock');
                opblocks.forEach((block) => {
                    const el = block;
                    const method = el.querySelector('.opblock-summary-method')?.textContent?.trim()?.toUpperCase() || '';
                    const path = el.querySelector('.opblock-summary-path')?.getAttribute('data-path') ||
                        el.querySelector('.opblock-summary-path')?.textContent?.trim() || '';
                    if (!method || !path)
                        return;
                    const summary = el.querySelector('.opblock-summary-description')?.textContent?.trim() || '';
                    const descriptionElem = el.querySelector('.opblock-description');
                    const opDescription = descriptionElem ? descriptionElem.textContent?.trim() : '';
                    // Parameters
                    const parameters = [];
                    const paramRows = el.querySelectorAll('.parameters tbody tr');
                    paramRows.forEach((row) => {
                        const rowEl = row;
                        const name = rowEl.querySelector('.parameter__name')?.textContent?.trim()?.split(/\s/)[0] || '';
                        const inTypeRaw = rowEl.querySelector('.parameter__in')?.textContent?.trim()?.replace('(', '')?.replace(')', '') || 'query';
                        const required = !!rowEl.querySelector('.required');
                        const desc = rowEl.querySelector('.parameter__extension')?.textContent?.trim() || '';
                        const type = rowEl.querySelector('.parameter__type')?.textContent?.trim() || 'string';
                        if (name) {
                            parameters.push({
                                name,
                                in: toParamIn(inTypeRaw),
                                required,
                                description: desc,
                                schema: { type }
                            });
                        }
                    });
                    // Request Body (Simplified extraction)
                    let requestBody = undefined;
                    const bodySection = el.querySelector('.opblock-body .opblock-section-request-body');
                    if (bodySection) {
                        const contentTypeSelect = bodySection.querySelector('.content-type');
                        const contentType = contentTypeSelect ? contentTypeSelect.value : 'application/json';
                        const bodyDesc = bodySection.querySelector('.markdown p')?.textContent?.trim();
                        requestBody = {
                            contentType,
                            description: bodyDesc
                        };
                        // Detailed schema extraction can be very complex in Swagger UI DOM, 
                        // often relying on React state. For a robust solution, we'd ideally
                        // intercept the `openapi.json` request if available. 
                    }
                    // Responses
                    const responses = [];
                    const responseRows = el.querySelectorAll('.responses-table tbody tr');
                    responseRows.forEach((row) => {
                        const rowEl = row;
                        const statusCode = rowEl.querySelector('.response-col_status')?.textContent?.trim() || '';
                        const desc = rowEl.querySelector('.response-col_description .markdown p')?.textContent?.trim() || '';
                        if (statusCode) {
                            responses.push({ statusCode, description: desc });
                        }
                    });
                    endpoints.push({
                        method,
                        path,
                        summary,
                        description: opDescription || undefined,
                        parameters,
                        requestBody,
                        responses
                    });
                });
                return {
                    title,
                    version,
                    description,
                    servers,
                    endpoints
                };
            });
            return extractedDoc;
        }
        catch (error) {
            console.error("SwaggerStrategy Extraction Error:", error);
            throw error;
        }
        finally {
            await browser.close();
        }
    }
}
exports.SwaggerStrategy = SwaggerStrategy;
