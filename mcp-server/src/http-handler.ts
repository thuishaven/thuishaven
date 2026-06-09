/**
 * Web-standard HTTP handling for the MCP endpoint, shared by the Cloudflare
 * Workers entry and the Node HTTP entry.
 *
 * Stateless mode: every POST gets a fresh McpServer + transport (the SDK's
 * stateless transport is single-use by design), and responses are plain JSON
 * (no SSE). Per the Streamable HTTP spec a server may answer GET with 405
 * when it offers no server-initiated stream.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
import type { Pattern } from "./core/types.js";

const INFO_TEXT = `Thuishaven MCP server (${SERVER_NAME} v${SERVER_VERSION})

This is a Model Context Protocol endpoint, meant for MCP clients rather than
browsers. Connect it to Claude Code with:

  claude mcp add --transport http thuishaven <this URL>

Patterns and docs: https://thuishaven.dev
Source: https://github.com/thuishaven/thuishaven
`;

function jsonRpcError(status: number, code: number, message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }),
    { status, headers: { "content-type": "application/json" } },
  );
}

export async function handleMcpRequest(
  request: Request,
  patterns: Pattern[],
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";

  // Human-friendly info page for browsers hitting the bare endpoint.
  if (request.method === "GET" && path === "/" ) {
    return new Response(INFO_TEXT, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (path !== "/" && path !== "/mcp") {
    return jsonRpcError(404, -32000, "Not found. MCP endpoint is at / or /mcp.");
  }

  if (request.method !== "POST") {
    // Stateless server: no SSE stream, no sessions to DELETE.
    return jsonRpcError(405, -32000, "Method not allowed.");
  }

  const server = createServer(patterns);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
