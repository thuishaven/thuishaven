/**
 * Node stdio entry point for direct Claude Desktop / Claude Code integration.
 *
 * Loads and validates patterns from the filesystem at startup (PATTERNS_DIR
 * env var overrides the default ../patterns). Stdout carries MCP messages
 * only — all logging goes to stderr.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadPatternsFromFs, resolvePatternsDir } from "./node/load-from-fs.js";

const patternsDir = resolvePatternsDir();
const patterns = loadPatternsFromFs(patternsDir);
console.error(`Loaded ${patterns.length} pattern(s) from ${patternsDir}`);

const server = createServer(patterns);
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Thuishaven MCP server running on stdio");
