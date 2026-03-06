Turn API documentation websites (Swagger/Redoc/Docusaurus) into OpenAPI & Postman-ready formats.

## Getting Started

### Web app

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### CLI

Scrape API docs from the command line:

```bash
pnpm apidocs <url> [options]
```

Sau khi publish lên npm, dùng trực tiếp qua `npx`:

```bash
npx apidocs <url> [options]
```

**Arguments**

- `url` – API docs URL (required)

**Options** (giống bản web)

| Option | Mô tả |
|--------|-------|
| `--docs-type`, `-t` | Loại docs: `auto` \| `swagger` \| `redoc` \| `redocly` \| `docusaurus` (default: `auto`) |
| `--format`, `-f` | Output: `openapi` \| `postman` (default: `openapi`) |
| `--output`, `-o` | File output (default: stdout) |
| `--as` | Với openapi: `json` \| `yaml` (default: `json`) |

**Ví dụ**

```bash
# Xuất OpenAPI JSON ra stdout
pnpm apidocs https://petstore.swagger.io

# Xuất OpenAPI YAML ra file
pnpm apidocs https://example.com/api --format openapi --as yaml -o openapi.yaml

# Xuất Postman collection
pnpm apidocs https://example.com/api --format postman -o postman.json

# Chỉ định loại docs (Swagger/Redoc/Docusaurus)
pnpm apidocs https://example.com/docs -t swagger -o spec.json
```

Sau khi cài global (`pnpm add -g .`), có thể chạy trực tiếp: `apidocs <url>`

## Publish npm (GitHub Actions)

- Tạo secret `NPM_TOKEN` trong GitHub repo (token có quyền publish).
- Tăng version trong `package.json` (hoặc cứ tag theo version bạn muốn publish).
- Tạo tag dạng `vX.Y.Z` rồi push tag. Workflow `Publish to npm` sẽ chạy và publish.
