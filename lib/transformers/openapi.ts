import { ApiDocument, FormatTransformer } from '../types';

export type OpenApiSpec = {
  openapi: '3.0.0';
  info: { title: string; version: string; description?: string };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, unknown>>;
};

export class OpenApiTransformer implements FormatTransformer<OpenApiSpec> {
  transform(doc: ApiDocument): OpenApiSpec {
    const paths: Record<string, Record<string, unknown>> = {};

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

      const operation: Record<string, unknown> = {
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
        (operation as Record<string, unknown>).requestBody = {
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
