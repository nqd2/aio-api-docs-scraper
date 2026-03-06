import { ApiDocument, ApiEndpoint, FormatTransformer } from '../types';
// We use the postman-collection sdk or build it manually. Since building complex collections
// with variables and scripts requires specific structure, we'll build the JSON object manually
// for full V2.1.0 compatibility.

export type PostmanCollection = {
  info: {
    _postman_id: string;
    name: string;
    description?: string;
    schema: string;
  };
  item: Array<Record<string, unknown>>;
  variable: Array<{ key: string; value: string; type: string }>;
};

type JsonObject = Record<string, unknown>;

export class PostmanTransformer implements FormatTransformer<PostmanCollection> {
  transform(doc: ApiDocument): PostmanCollection {
    const items: JsonObject[] = [];
    
    // Group endpoints by tags or first path segment
    const groupedEndpoints: Record<string, ApiEndpoint[]> = {};

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
      const folderItems: JsonObject[] = endpoints.map((ep) => {
        
        // Build URL
        const urlSegments = ep.path.split('/').filter((p: string) => p.length > 0).map((segment: string) => {
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
        } satisfies JsonObject;
      });

      items.push({
        name: folderName,
        item: folderItems
      } satisfies JsonObject);
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
    } as PostmanCollection;
  }
}
