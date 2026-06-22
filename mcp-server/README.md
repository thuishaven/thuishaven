# Thuishaven MCP server

Exposes the patterns in [`../patterns/`](../patterns/) via the [Model Context Protocol](https://modelcontextprotocol.io). Stateless: patterns are loaded once (from the filesystem, or from a build-time bundle on Workers), every request gets a fresh server instance, nothing is stored, nothing is logged about you.

## Tools

| Tool | Purpose |
|---|---|
| `list_patterns` | List patterns, filterable by `category`, `status`, `tag` |
| `get_pattern` | Full pattern by `id`: frontmatter, markdown body, GitHub source URL |
| `find_pattern_for_problem` | Match a free-text problem description to patterns (keyword overlap, tag matches weigh double) |
| `list_categories` | All categories with descriptions and pattern counts |
| `get_setup_guide` | The bootstrap pattern for a `target` (currently `dokploy`) |

## Prompts

User-invoked slash commands (e.g. `/mcp__thuishaven__self_host` in Claude Code) that carry the *workflow* the tools can't express — match a pattern, follow it verbatim, treat every deviation as a pattern bug.

| Prompt | Purpose |
|---|---|
| `self_host` | Find and follow a pattern for what the user wants to run (arg: `problem`) |
| `bootstrap_server` | Prepare a fresh server before deploying apps |
| `contribute_pattern` | Turn a dogfood deviation into a fix or new-pattern PR (optional arg: `pattern_id`) |

The same opinion, auto-triggered rather than user-invoked, ships as an Agent Skill in [`../skills/`](../skills/).

## Architecture

```
src/
├── core/                 runtime-agnostic: types, loader, the five tools (pure functions)
│   ├── loader.ts         assemble validated patterns (no Node APIs, no ajv)
│   ├── validate.ts       gray-matter + ajv schema validation (Node-only contexts)
│   ├── tools/            one file per MCP tool
│   └── prompts.ts        the three workflow prompts (shared by all entries)
├── server.ts             registers the tools + prompts on an McpServer (shared by all entries)
├── http-handler.ts       web-standard Request -> Response MCP handling (shared)
├── workers.ts            Cloudflare Workers entry (imports patterns.bundle.json)
├── node-http.ts          Node HTTP entry for Docker/self-host (reads ../patterns)
└── node-stdio.ts         Node stdio entry for Claude Desktop/Code (reads ../patterns)
```

Validation runs where Node runs: the bundle build step, the Node entries, and CI. The Workers runtime trusts the build-time-validated bundle — ajv (which needs `new Function`) never enters the Worker bundle.

## Local development

```bash
cd mcp-server
npm install
npm test                # vitest: core, tools, and an in-memory MCP client round-trip
npm run typecheck       # node + workers tsconfigs (builds the patterns bundle first)
```

### Run the three modes

**stdio** (direct Claude integration):

```bash
npm run start:stdio
```

Add to Claude Code:

```bash
claude mcp add --transport stdio thuishaven -- npx -y tsx /path/to/thuishaven/mcp-server/src/node-stdio.ts
```

Or Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "thuishaven": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/thuishaven/mcp-server/src/node-stdio.ts"]
    }
  }
}
```

**HTTP** (what the Docker image runs):

```bash
npm run start:http      # listens on :3000, /health for liveness
claude mcp add --transport http thuishaven-local http://localhost:3000/mcp
```

**Workers** (what production runs):

```bash
npm run dev:workers     # builds the patterns bundle, then wrangler dev on :8787
```

## Self-hosting with Docker

Build from the **repo root** (the image bundles `patterns/` and `schema/`):

```bash
docker build -f mcp-server/Dockerfile -t thuishaven-mcp .
docker run -p 3000:3000 thuishaven-mcp                          # HTTP transport
docker run -i thuishaven-mcp node mcp-server/dist/node-stdio.js # stdio transport
```

Point an MCP instance at your own patterns directory (fork-and-customize):

```bash
docker run -p 3000:3000 -v /my/patterns:/app/patterns thuishaven-mcp
# or outside Docker:
PATTERNS_DIR=/my/patterns npm run start:http
```

Custom patterns must validate against [`../schema/pattern.schema.json`](../schema/pattern.schema.json) — the server refuses to start otherwise, which is the point.

## Deployment (production, Phase 4)

`wrangler deploy` publishes to Cloudflare Workers with the custom domain `mcp.thuishaven.dev` (configured in [`wrangler.jsonc`](wrangler.jsonc)). The deploy pipeline runs `npm run build:bundle` first; a deploy is the pattern refresh — no runtime fetching.

## Design notes

- **Stateless by construction.** The SDK's stateless Streamable HTTP transport is single-use; `http-handler.ts` builds a fresh `McpServer` + transport per POST. Responses are plain JSON (`enableJsonResponse`), GET returns 405 (no server-initiated streams), no sessions, no `MCP-Session-Id`.
- **One handler, three runtimes.** `workers.ts` passes the Workers `Request` straight to `handleMcpRequest`; `node-http.ts` bridges Node's `IncomingMessage`/`ServerResponse` to the same function. The MCP SDK's `WebStandardStreamableHTTPServerTransport` does the protocol work.
- **No telemetry.** No analytics, no logging of request contents, Workers observability explicitly disabled in `wrangler.jsonc`.
