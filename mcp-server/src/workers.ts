/**
 * Cloudflare Workers entry point for the hosted MCP endpoint at
 * mcp.thuishaven.dev.
 *
 * Patterns come from src/patterns.bundle.json, generated and validated at
 * build time by scripts/build-patterns-bundle.ts (run `npm run build:bundle`
 * before `wrangler dev` / `wrangler deploy`). A deploy is the refresh: the
 * Worker holds patterns in memory and never does runtime I/O.
 */

import { patternsFromBundle } from "./core/loader.js";
import { handleMcpRequest } from "./http-handler.js";
import type { PatternsBundle } from "./core/types.js";
import bundle from "./patterns.bundle.json" with { type: "json" };

const patterns = patternsFromBundle(bundle as PatternsBundle);

export default {
  async fetch(request: Request): Promise<Response> {
    return handleMcpRequest(request, patterns);
  },
};
