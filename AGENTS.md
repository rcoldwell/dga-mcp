# AGENTS.md

Guidance for AI agents working in the `dga-mcp` repository.

## Project Overview

A Model Context Protocol (MCP) server that exposes the Digital Guitar Archive API to AI assistants. Built with TypeScript and [FastMCP](https://github.com/jlowin/fastmcp), it provides tools, prompts, and a resource template for searching, browsing, and retrieving bibliographic guitar-music records.

The server is a stateless proxy to the live production API at `https://digitalguitararchive.com/archive/api`. It holds no database of its own.

## Tech Stack

- **Language:** TypeScript (`target: ES2020`, `module: commonjs`, `strict: true`)
- **Runtime:** Node.js 18+ (uses native `fetch` and `AbortController`)
- **MCP framework:** `fastmcp` v4 (transport: stdio)
- **Validation:** `zod` v4 (used for tool parameter schemas)
- **Env config:** `dotenv`
- **Build:** `tsc` (no bundler)

## Repository Layout

```
src/
  mcp-server.ts    Single-file server: helpers, tools, prompts, resource template, entrypoint
dist/              Build output (gitignored) — compiled mcp-server.js
tsconfig.json      TypeScript compiler config (strict mode)
package.json       Scripts, dependencies, package metadata
README.md          User-facing setup + Claude Desktop configuration docs
```

The entire implementation lives in `src/mcp-server.ts`. There are no submodules, tests, or lint config currently.

## Common Commands

```bash
npm install        # install dependencies
npm run build      # compile TypeScript -> dist/ (npx tsc)
npm start          # run the compiled server (node dist/mcp-server.js)
npx ts-node src/mcp-server.ts   # run from source for development
```

There is **no test suite** and **no linter** configured. After edits, verify with `npm run build` — a clean compile under `strict` mode is the primary correctness check.

## Architecture

`src/mcp-server.ts` is organized top-to-bottom as:

1. **Config** — reads `API_URL` and `REQUEST_TIMEOUT_MS` from env (with defaults).
2. **`apiCall(endpoint)`** — central fetch helper with `AbortController`-based timeout. All upstream calls go through here; it throws on non-OK responses.
3. **`formatRecordList(data, offset)`** — normalizes search/browse results into a human-readable text summary with pagination context.
4. **Tools** (registered via `mcp.addTool`):
   - `search_guitar_archive` — full-text + field filters, pagination (`limit` max 100, `offset`).
   - `browse_by_source` — scoped to a RISM sigla `source`; reuses the `/search` endpoint.
   - `get_record_details` — fetches `/record/{id}` and renders non-empty fields as `Label: value` lines.
   - `list_sources` — enumerates source libraries with record counts and locations.
   - `list_collections` — enumerates known `Local ID` → collection-name mappings; resolves non-library collections (private holdings, journals) that the `Source` RISM sigla alone does not describe.
5. **Prompt** — `research_library_collection`, a guided research workflow template.
6. **Resource template** — `archive://record/{id}` returns raw record JSON.
7. **`mcp.start({ transportType: "stdio" })`** — the server communicates over stdin/stdout only.

Tool parameters are validated with Zod schemas passed directly to `addTool`. Tool return values are plain strings (text content) or thrown errors.

## Conventions

- **Single source file.** Keep the implementation in `src/mcp-server.ts`. If it grows significantly, split into modules under `src/`.
- **No comments** unless explaining non-obvious intent; the existing code uses sparing section comments only.
- **Strict TypeScript.** Do not weaken `strict` mode. Avoid `any` where a type is feasible (the API helpers currently use `any` because the upstream schema is not formally typed).
- **Tool return values are strings.** Format data for human readability; throw `Error` on upstream failures so the MCP client surfaces them.
- **All upstream requests go through `apiCall`.** Do not call `fetch` directly elsewhere — the timeout and error handling are centralized there.
- **`COLLECTION_NAMES` maps `Local ID` → collection name.** Keep it in sync with the upstream Local ID mapping; `resolveCollectionName` is used in `formatRecordList`, `get_record_details`, and `list_collections`. Matching falls back to case-insensitive for DB variance.
- **Env over hardcoding.** New configurable values should read from `process.env` with a sensible default, and be documented in the README configuration table.

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `API_URL` | Base URL of the Digital Guitar Archive API | `https://digitalguitararchive.com/archive/api` |
| `REQUEST_TIMEOUT_MS` | Per-request timeout in milliseconds | `15000` |

## Upstream API Contract (observed)

The server assumes these endpoints and response shapes from the archive API:

- `GET /search?q=&title=&author=&source=&publisher=&limit=&offset=` → `{ total: number, results: [{ id, title, author, publish_date, source, local_ID? }] }`
- `GET /record/{id}` → a record object with many optional fields (title, author, publisher, opus, instruments, source, etc.), or `{ error: ... }` when missing.
- `GET /sources` → `{ total: number, sources: [{ source, name, country, record_count }] }`

If the upstream API changes shape, update the formatters in `formatRecordList`, `get_record_details`, and `list_sources` accordingly.

## Things to Avoid

- Do not add a database, caching layer, or persistent state without explicit request — the server is intentionally stateless.
- Do not introduce a bundler or transpiler beyond `tsc`.
- Do not commit `dist/`, `node_modules/`, or `.env` (see `.gitignore`).
- Do not commit secrets or API keys; the server requires none.
