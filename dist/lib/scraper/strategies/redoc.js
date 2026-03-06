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
exports.RedocStrategy = void 0;
const playwright_1 = require("playwright");
const cheerio = __importStar(require("cheerio"));
class RedocStrategy {
    detect(pageContent, _url) {
        const htmlLower = pageContent.toLowerCase();
        return htmlLower.includes('<redoc') || htmlLower.includes('id="redoc-container"');
    }
    async scrape(url) {
        const browser = await playwright_1.chromium.launch({ headless: true });
        const page = await browser.newPage();
        try {
            await page.goto(url, { waitUntil: 'networkidle' });
            // Wait for Redoc to render operations
            await page.waitForSelector('.operation-type', { timeout: 15000 }).catch(() => { });
            const html = await page.content();
            const $ = cheerio.load(html);
            const title = $('h1').first().text().trim().replace(/1\.\d+\.\d+$/, '') || 'Redoc API';
            const versionMatch = $('h1').first().text().match(/(\d+\.\d+\.\d+)$/);
            const version = versionMatch ? versionMatch[1] : '1.0.0';
            const description = $('.api-info p').first().text().trim() || '';
            const servers = [];
            $('span[class^="ServerUrl"]').each((_, el) => {
                const url = $(el).text().trim();
                if (url)
                    servers.push({ url, description: '' });
            });
            const endpoints = [];
            // Loop through each operation section
            $('[data-section-id]').each((_, opElement) => {
                const sectionId = $(opElement).attr('data-section-id');
                if (!sectionId || !sectionId.includes('operation/'))
                    return;
                const httpVerbEl = $(opElement).find('.http-verb, .operation-type').first();
                if (httpVerbEl.length === 0)
                    return;
                const method = httpVerbEl.text().trim().toUpperCase() || '';
                let path = '';
                if (httpVerbEl.hasClass('http-verb')) {
                    const siblingSpan = httpVerbEl.next();
                    if (siblingSpan.length > 0) {
                        path = siblingSpan.text().trim() || '';
                    }
                }
                else {
                    const pathContainer = $(opElement).find('.operation-endpoints span:not(.operation-type)').first();
                    if (pathContainer.length > 0) {
                        const fullText = pathContainer.parent().text() || '';
                        path = fullText.replace(httpVerbEl.text() || '', '').trim();
                    }
                }
                if (!method || !path)
                    return;
                const summary = $(opElement).find('h2').first().text().trim() || '';
                const parameters = [];
                // Find parameters (query, header, path) by looking at h5 like "header Parameters", "query Parameters"
                $(opElement).find('h5').each((_, h5El) => {
                    const h5Text = $(h5El).text().toLowerCase();
                    if (h5Text.includes('parameters')) {
                        let inType = 'query';
                        if (h5Text.includes('header'))
                            inType = 'header';
                        if (h5Text.includes('path'))
                            inType = 'path';
                        if (h5Text.includes('cookie'))
                            inType = 'cookie';
                        const table = $(h5El).nextAll('table').first();
                        table.find('tbody tr').each((_, row) => {
                            const nameCell = $(row).find('td').first();
                            const name = nameCell.find('.property-name').text().trim() || nameCell.text().trim().replace(/required/i, '');
                            const required = nameCell.text().toLowerCase().includes('required');
                            const typeCell = $(row).find('td').eq(1);
                            const type = typeCell.find('div > div > span').last().text().trim() || 'string';
                            const desc = typeCell.find('p').text().trim();
                            if (name) {
                                parameters.push({ name, in: inType, required, description: desc, schema: { type } });
                            }
                        });
                    }
                });
                // Request Body Extraction
                let requestBody = undefined;
                let reqBodyH5 = null;
                $(opElement).find('h5').each((_, el) => {
                    if ($(el).text().includes('Request Body schema')) {
                        reqBodyH5 = $(el);
                    }
                });
                if (reqBodyH5) {
                    const contentType = $(reqBodyH5).find('span').text().trim() || 'application/json';
                    const properties = {};
                    const table = $(reqBodyH5).nextAll('table').first();
                    table.find('tbody tr').each((_, row) => {
                        const nameCell = $(row).find('td').first();
                        const name = nameCell.find('.property-name').text().trim();
                        const _required = nameCell.text().toLowerCase().includes('required');
                        const typeCell = $(row).find('td').eq(1);
                        const type = typeCell.find('div > div > span').last().text().trim() || 'string';
                        const desc = typeCell.find('p').text().trim();
                        if (name) {
                            properties[name] = { type, description: desc };
                        }
                    });
                    requestBody = {
                        contentType,
                        description: 'Request Body',
                        schema: {
                            type: 'object',
                            properties
                        }
                    };
                }
                // Responses Extraction
                const responses = [];
                $(opElement).find('h3').filter((_, el) => $(el).text().trim() === 'Responses')
                    .nextAll('div').first().find('button').each((_, resBtn) => {
                    const statusCode = $(resBtn).find('strong').text().trim();
                    const desc = $(resBtn).find('div[html] p').text().trim() || $(resBtn).text().replace(statusCode, '').trim();
                    if (statusCode) {
                        responses.push({ statusCode, description: desc });
                    }
                });
                endpoints.push({
                    method,
                    path,
                    summary,
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
        }
        catch (error) {
            console.error("RedocStrategy Extraction Error:", error);
            throw error;
        }
        finally {
            await browser.close();
        }
    }
}
exports.RedocStrategy = RedocStrategy;
