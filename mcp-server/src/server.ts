/**
 * Shared MCP server assembly: registers the five Thuishaven tools on an
 * McpServer. Used by all three entry points (Workers, Node HTTP, Node stdio).
 * Runtime-agnostic — no Node APIs, no ajv.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { findPatternForProblem } from "./core/tools/find-pattern-for-problem.js";
import { getPattern } from "./core/tools/get-pattern.js";
import { getSetupGuide } from "./core/tools/get-setup-guide.js";
import { listCategories } from "./core/tools/list-categories.js";
import { listPatterns } from "./core/tools/list-patterns.js";
import { ToolError, type Pattern } from "./core/types.js";

export const SERVER_NAME = "thuishaven";
export const SERVER_VERSION = "0.1.0";

/** Wrap a pure tool function: JSON result on success, isError on ToolError. */
function run(fn: () => unknown): CallToolResult {
  try {
    const output = fn() as Record<string, unknown>;
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  } catch (err) {
    if (err instanceof ToolError) {
      return {
        content: [{ type: "text", text: err.message }],
        isError: true,
      };
    }
    throw err;
  }
}

export function createServer(patterns: Pattern[]): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "list_patterns",
    {
      title: "List patterns",
      description:
        "List all available self-hosting patterns, optionally filtered by category, status, or tag.",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe("Filter by category, e.g. bootstrap, collaboration, security"),
        status: z.enum(["stable", "experimental", "deprecated"]).optional(),
        tag: z.string().optional().describe("Filter by a single tag"),
      },
    },
    async (input) => run(() => listPatterns(patterns, input)),
  );

  server.registerTool(
    "get_pattern",
    {
      title: "Get pattern",
      description:
        "Get the full content of a pattern: frontmatter, markdown body with step-by-step instructions, and source URL.",
      inputSchema: {
        id: z.string().describe("Pattern id, e.g. dokploy-bootstrap"),
      },
    },
    async (input) => run(() => getPattern(patterns, input)),
  );

  server.registerTool(
    "find_pattern_for_problem",
    {
      title: "Find pattern for problem",
      description:
        "Match a free-text problem description (e.g. 'I want to share a calendar with family') to relevant patterns, ranked by keyword relevance.",
      inputSchema: {
        description: z.string().describe("Free-text description of the problem"),
        limit: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Maximum number of matches to return (default 3)"),
      },
    },
    async (input) => run(() => findPatternForProblem(patterns, input)),
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description: "List all pattern categories with a description and pattern count for each.",
      inputSchema: {},
    },
    async () => run(() => listCategories(patterns)),
  );

  server.registerTool(
    "get_setup_guide",
    {
      title: "Get setup guide",
      description:
        "Get the bootstrap pattern for preparing a server (the most common entry point). Currently supports target 'dokploy'.",
      inputSchema: {
        target: z.enum(["dokploy", "docker-compose", "tailscale-exit-node"]),
      },
    },
    async (input) => run(() => getSetupGuide(patterns, input)),
  );

  return server;
}
