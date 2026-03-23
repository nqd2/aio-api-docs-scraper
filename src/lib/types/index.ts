export type DocsType = 'swagger' | 'redoc' | 'redocly' | 'docusaurus' | 'unknown';

export interface ApiProperty {
  name?: string;
  type: string;
  description?: string;
  required?: boolean;
  format?: string;
  example?: unknown;
  items?: ApiProperty; // For arrays
  properties?: Record<string, ApiProperty>; // For objects
  enum?: unknown[];
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'body';
  description?: string;
  required?: boolean;
  schema?: ApiProperty;
}

export interface ApiRequestBody {
  contentType: string; // e.g. 'application/json'
  schema?: ApiProperty;
  description?: string;
  required?: boolean;
}

export interface ApiResponse {
  statusCode: string;
  description?: string;
  content?: Record<string, ApiRequestBody>; // e.g. { 'application/json': { schema: ... } }
}

export interface ApiEndpoint {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
}

export interface ApiDocument {
  title: string;
  version: string;
  description?: string;
  servers?: { url: string; description?: string }[];
  endpoints: ApiEndpoint[];
}

export interface ScraperStrategy {
  scrape(url: string, htmlContext?: string): Promise<ApiDocument>;
}

export interface FormatTransformer<T> {
  transform(doc: ApiDocument): T;
}
