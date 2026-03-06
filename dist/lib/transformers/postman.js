"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostmanTransformer = void 0;
class PostmanTransformer {
    transform(doc) {
        const items = [];
        // Group endpoints by tags or first path segment
        const groupedEndpoints = {};
        doc.endpoints.forEach((ep) => {
            // Very basic grouping: use the first URL segment as a folder name
            const pathParts = ep.path.split('/').filter(p => p.length > 0);
            const tag = (ep.tags && ep.tags.length > 0) ? ep.tags[0] : (pathParts[0] || 'General');
            if (!groupedEndpoints[tag]) {
                groupedEndpoints[tag] = [];
            }
            groupedEndpoints[tag].push(ep);
        });
        for (const [folderName, endpoints] of Object.entries(groupedEndpoints)) {
            const folderItems = endpoints.map((ep) => {
                // Build URL
                const urlSegments = ep.path.split('/').filter((p) => p.length > 0).map((segment) => {
                    // Postman uses :varName for path variables instead of {varName} generally, 
                    // but keeping {{base_url}} as the host.
                    return segment.replace('{', ':').replace('}', '');
                });
                const query = ep.parameters
                    .filter((p) => p.in === 'query')
                    .map((p) => ({
                    key: p.name,
                    value: p.schema?.example || '',
                    description: p.description
                }));
                const header = ep.parameters
                    .filter((p) => p.in === 'header')
                    .map((p) => ({
                    key: p.name,
                    value: p.schema?.example || '',
                    description: p.description
                }));
                return {
                    name: ep.summary || ep.path,
                    request: {
                        method: ep.method,
                        header: header,
                        url: {
                            raw: `{{base_url}}${ep.path}`,
                            host: ['{{base_url}}'],
                            path: urlSegments,
                            query: query
                        },
                        description: ep.description,
                        body: ep.requestBody ? {
                            mode: 'raw',
                            raw: JSON.stringify(ep.requestBody.schema?.example || {}, null, 2),
                            options: {
                                raw: {
                                    language: 'json'
                                }
                            }
                        } : undefined
                    },
                    response: []
                };
            });
            items.push({
                name: folderName,
                item: folderItems
            });
        }
        return {
            info: {
                _postman_id: crypto.randomUUID(), // Assuming Node 19+ / Web Crypto
                name: doc.title,
                description: doc.description,
                schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            item: items,
            variable: [
                {
                    key: "base_url",
                    value: doc.servers?.[0]?.url || "https://api.example.com",
                    type: "string"
                }
            ]
        };
    }
}
exports.PostmanTransformer = PostmanTransformer;
