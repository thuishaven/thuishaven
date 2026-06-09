/**
 * Integration tests through the real MCP layer: an SDK Client connected to
 * our server over an in-memory transport pair. Verifies tool registration,
 * structured output, and error mapping — the same code path all three
 * runtime entries use.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { makeCollection } from "./helpers.js";

let client: Client;

beforeAll(async () => {
  const server = createServer(makeCollection());
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
});

describe("MCP server", () => {
  it("exposes exactly the five specified tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "find_pattern_for_problem",
      "get_pattern",
      "get_setup_guide",
      "list_categories",
      "list_patterns",
    ]);
  });

  it("list_patterns returns structured content", async () => {
    const result = await client.callTool({
      name: "list_patterns",
      arguments: { category: "security" },
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      patterns: Array<{ id: string }>;
    };
    expect(structured.patterns.map((p) => p.id)).toEqual(["vaultwarden-family"]);
  });

  it("get_pattern returns the full body and source_url", async () => {
    const result = await client.callTool({
      name: "get_pattern",
      arguments: { id: "scheduling-tool" },
    });
    const structured = result.structuredContent as {
      frontmatter: { id: string };
      body: string;
      source_url: string;
    };
    expect(structured.frontmatter.id).toBe("scheduling-tool");
    expect(structured.body.length).toBeGreaterThan(0);
    expect(structured.source_url).toContain("github.com/thuishaven/thuishaven");
  });

  it("maps ToolError to an isError result instead of a protocol error", async () => {
    const result = await client.callTool({
      name: "get_pattern",
      arguments: { id: "does-not-exist" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0];
    expect(text?.text).toContain("Unknown pattern id");
  });

  it("find_pattern_for_problem answers the spec's example query", async () => {
    const result = await client.callTool({
      name: "find_pattern_for_problem",
      arguments: { description: "I want to share a date picker with friends" },
    });
    const structured = result.structuredContent as {
      matches: Array<{ id: string; relevance_score: number }>;
    };
    expect(structured.matches[0]?.id).toBe("scheduling-tool");
  });

  it("get_setup_guide returns the dokploy bootstrap pattern", async () => {
    const result = await client.callTool({
      name: "get_setup_guide",
      arguments: { target: "dokploy" },
    });
    const structured = result.structuredContent as {
      pattern: { frontmatter: { id: string } };
    };
    expect(structured.pattern.frontmatter.id).toBe("dokploy-bootstrap");
  });

  it("rejects invalid tool input via schema validation", async () => {
    const result = await client.callTool({
      name: "get_setup_guide",
      arguments: { target: "heroku" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0];
    expect(text?.text).toContain("Invalid option");
  });
});
