/**
 * Node HTTP entry point for Docker / self-hosting.
 *
 * Loads and validates patterns from the filesystem at startup (PATTERNS_DIR
 * env var overrides the default ../patterns), then serves the same
 * web-standard MCP handler the Workers entry uses, via a minimal
 * IncomingMessage <-> Request bridge. No framework dependency.
 */

import { createServer as createHttpServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleMcpRequest } from "./http-handler.js";
import { loadPatternsFromFs, resolvePatternsDir } from "./node/load-from-fs.js";

const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = process.env["HOST"] ?? "0.0.0.0";

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const url = `http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) for (const v of value) headers.append(key, v);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks);
  return new Request(url, {
    method: req.method ?? "GET",
    headers,
    body: body.length > 0 ? body : null,
  });
}

async function writeWebResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (response.body !== null) {
    for await (const chunk of response.body) {
      res.write(chunk);
    }
  }
  res.end();
}

const patternsDir = resolvePatternsDir();
const patterns = loadPatternsFromFs(patternsDir);
console.log(`Loaded ${patterns.length} pattern(s) from ${patternsDir}`);

const server = createHttpServer((req, res) => {
  void (async () => {
    try {
      if (req.url === "/health") {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, patterns: patterns.length }));
        return;
      }
      const response = await handleMcpRequest(await toWebRequest(req), patterns);
      await writeWebResponse(res, response);
    } catch (err) {
      console.error("Request handling failed:", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          }),
        );
      } else {
        res.end();
      }
    }
  })();
});

server.listen(PORT, HOST, () => {
  console.log(`Thuishaven MCP server listening on http://${HOST}:${PORT}`);
});
