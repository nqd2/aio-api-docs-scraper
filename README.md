Turn Swagger/Redoc/Docusaurus docs into OpenAPI and Postman collections.

## Install Playwright (first time)
The CLI renders docs with Chromium when it needs a DOM-based scrape.

```bash
pnpm exec playwright install chromium
```

## CLI

Run:

```bash
pnpm aioapi <url> [options]
```

After publishing:

```bash
npx aioapi <url> [options]
```

### Arguments

- `url`: API documentation URL (required)

### Options

| Option | Description |
|--------|-------------|
| `--docs-type`, `-t` | Docs type: `auto` \| `swagger` \| `redoc` \| `redocly` \| `docusaurus` (default: `auto`) |
| `--format`, `-f` | Output: `openapi` \| `postman` (default: `openapi`) |
| `--output`, `-o` | Write output to a file (default: stdout) |
| `--as` | For OpenAPI: `json` \| `yaml` (default: `json`) |
| `--strategy`, `-S` | `dom` (default): DOM-based scrape. `llm`: crawl same-origin HTML pages and ask an LLM to generate specs. `hybrid`: DOM first; if it fails or yields zero endpoints, fall back to LLM. |
| `--llm-max-pages` | Max same-origin HTML pages to crawl for LLM (default: 20) |
| `--llm-max-chars` | Max total characters sent to the LLM prompt (default: 100000) |
| `--llm-prompt` | Override [`prompts/prompt.md`](prompts/prompt.md) |

### LLM mode (crawl + model)

Set environment variables:

| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | `openai` / `groq` / `openrouter` / `ollama` / `custom` → OpenAI-compatible `/v1/chat/completions`. `anthropic` → Anthropic Messages API. `off` or unset disables LLM (valid only with `--strategy dom`). |
| `LLM_API_KEY` | API key (use `OPENAI_API_KEY` for OpenAI if set). If you use Anthropic, set `ANTHROPIC_API_KEY` when `LLM_API_KEY` is missing. |
| `LLM_MODEL` | Example: `gpt-4o-mini`, `claude-3-5-sonnet-20241022` |
| `LLM_BASE_URL` | Optional OpenAI-compatible base URL (e.g. Groq `https://api.groq.com/openai/v1`, Ollama `http://localhost:11434/v1`) |
| `LLM_JSON_MODE` | Set to `0`/`false` when your backend does not support `response_format: json_object` |

System prompt: [`prompts/prompt.md`](prompts/prompt.md). Template hints: [`templates/openapi-template.json`](templates/openapi-template.json) and [`templates/postman-template.json`](templates/postman-template.json).

### Examples

```bash
# DOM mode (default)
pnpm aioapi https://petstore.swagger.io

# OpenAPI YAML
pnpm aioapi https://example.com/api --format openapi --as yaml -o openapi.yaml

# Postman (DOM)
pnpm aioapi https://example.com/api --format postman -o postman.json

# LLM mode
set LLM_PROVIDER=openai
set LLM_API_KEY=sk-...
pnpm aioapi https://docs.example.com --strategy llm --format postman -o out.json

# Hybrid mode (DOM first, then LLM)
# (requires LLM env vars)
pnpm aioapi https://petstore.swagger.io --strategy hybrid -f openapi -o spec.json
```

After a global install (`pnpm add -g .`), run:

```bash
aioapi <url>
```

## Publish npm (GitHub Actions)

- Create `NPM_TOKEN` in the GitHub repo (token must have publish rights).
- Bump the version in `package.json` (or tag the version you want).
- Push a tag named `vX.Y.Z`; the workflow `Publish to npm` publishes the package.

**Note:** `aioapi` must be unclaimed on npm public. If the name is taken, switch to a scoped package and use `npx @scope/aioapi`.
