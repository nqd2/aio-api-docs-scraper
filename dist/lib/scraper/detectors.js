"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDocsType = detectDocsType;
/**
 * Detects the type of API documentation from the HTML content or URL.
 */
function detectDocsType(htmlContent, _url) {
    const htmlLower = htmlContent.toLowerCase();
    // Swagger UI Detection
    if (htmlLower.includes('id="swagger-ui"') ||
        htmlLower.includes('class="swagger-ui"') ||
        htmlLower.includes('swaggerui-') ||
        htmlContent.includes('SwaggerUIBundle')) {
        return 'swagger';
    }
    // Redoc Detection
    if (htmlLower.includes('<redoc') ||
        htmlLower.includes('id="redoc-container"') ||
        htmlContent.includes('Redoc.init') ||
        htmlContent.includes('redoc-wrap')) {
        return 'redoc';
    }
    // Redocly Detection (Often similar to Redoc but check specific meta or elements if different)
    // For now, simple fallback
    if (htmlLower.includes('redocly')) {
        return 'redocly';
    }
    // Docusaurus Detection
    if (htmlLower.includes('name="generator" content="docusaurus"') ||
        htmlLower.includes('class="docusaurus"') ||
        htmlLower.includes('data-theme="') ||
        htmlLower.includes('__docusaurus')) {
        return 'docusaurus';
    }
    return 'unknown';
}
