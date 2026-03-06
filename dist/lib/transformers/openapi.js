"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenApiTransformer = void 0;
class OpenApiTransformer {
    transform(doc) {
        const paths = {};
        doc.endpoints.forEach((ep) => {
            if (!paths[ep.path]) {
                paths[ep.path] = {};
            }
            const methodLower = ep.method.toLowerCase();
            const parameters = ep.parameters.map((p) => ({
                name: p.name,
                in: p.in,
                description: p.description,
                required: p.required,
                schema: p.schema || { type: 'string' }
            }));
            const operation = {
                summary: ep.summary,
                description: ep.description,
                operationId: ep.operationId || `${methodLower}${ep.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
                parameters: parameters.length > 0 ? parameters : undefined,
                responses: {
                    '200': {
                        description: 'Successful response'
                    }
                }
            };
            paths[ep.path][methodLower] = operation;
            if (ep.requestBody) {
                operation.requestBody = {
                    description: ep.requestBody.description,
                    content: {
                        [ep.requestBody.contentType]: {
                            schema: ep.requestBody.schema || { type: 'object' }
                        }
                    }
                };
            }
        });
        return {
            openapi: '3.0.0',
            info: {
                title: doc.title,
                version: doc.version,
                description: doc.description || `Scraped API Document`,
            },
            servers: doc.servers?.length ? doc.servers : [{ url: 'https://api.example.com' }],
            paths,
        };
    }
}
exports.OpenApiTransformer = OpenApiTransformer;
