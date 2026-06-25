/**
 * Thuishaven MCP prompts: user-invoked workflow templates.
 *
 * Where the five tools are passive data accessors, prompts carry the *opinion*
 * — the order of operations and the dogfood discipline that turn a pattern from
 * a document into a followed procedure. Clients surface these as slash commands
 * (e.g. /mcp__thuishaven__self_host). Per the MCP spec, prompts are
 * user-controlled: the user invokes them, the server returns the messages.
 *
 * Runtime-agnostic — no Node APIs, no ajv. Mirrors server.ts.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { findPatternForProblem } from "./tools/find-pattern-for-problem.js";
import { PATTERN_SOURCE_BASE_URL, type Pattern } from "./types.js";

/** A single user-role text message — the shape every prompt below returns. */
function userText(text: string): GetPromptResult {
  return {
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}

/**
 * The Thuishaven way of working, shared by every prompt. This is the part the
 * five tools can't express: a pattern is only useful if it's followed
 * faithfully and its gaps are fed back. Keep this in sync with the Agent Skill
 * at skills/thuishaven-self-hosting/SKILL.md.
 */
const WORKFLOW = `How to work with Thuishaven patterns:

1. **Match before improvising.** Call \`find_pattern_for_problem\` first. A
   matching pattern encodes a vetted, opinionated choice (one app, one deploy
   target, one exposure model) — prefer it over assembling your own setup.
2. **Collect the inputs first.** If the frontmatter has an \`inputs\` list,
   gather every required value (or generate the ones with a \`generate\` command)
   before touching the server. Treat \`secret\` inputs as sensitive — don't echo
   them back. Steps reference them as \`\${NAME}\`.
3. **Read the whole pattern, then follow it verbatim.** Use \`get_pattern\` (or
   \`get_setup_guide\` to bootstrap a server). Execute the steps in order on the
   user's real server; don't skip the gotchas. Prefer running an embedded script
   over retyping its output by hand. When a pattern describes deploy steps as
   Dokploy UI clicks but also gives an "Agent-executable deploy (Dokploy API)"
   recipe, drive the API yourself with the user's \`DOKPLOY_API_TOKEN\` instead of
   handing the user a list of buttons to press.
4. **Verify with the assertions, don't just eyeball it.** If the pattern has an
   \`assertions\` list, run every \`check\` (each exits 0 when it holds) and
   report pass/fail per assertion; walk the user through any marked \`manual\`.
   Don't declare success until the scriptable assertions pass.
5. **Be honest about status.** If the pattern is \`experimental\`, tell the user
   it hasn't been validated end-to-end yet — they're helping prove it out. Note
   its \`tested_against\` version; if the user's app version differs, say so.
6. **Private first.** Keep admin surfaces on the tailnet (Tailscale) or local;
   expose anything to the public internet only as a deliberate, named step.
7. **Every deviation is a pattern bug.** If you had to do something the pattern
   didn't mention — a missing dependency, a wrong port, an unclear step, an
   assertion that didn't match reality — note it and offer to open a PR against
   the pattern's source. The source URL is in the \`get_pattern\` result;
   patterns live at ${PATTERN_SOURCE_BASE_URL}.
8. **No match? Say so plainly.** Don't invent a pattern or pretend one exists.
   Offer to draft a new one for contribution instead.`;

export function registerPrompts(server: McpServer, patterns: Pattern[]): void {
  // self_host — the main entry point: user describes what they want to run.
  server.registerPrompt(
    "self_host",
    {
      title: "Self-host an app",
      description:
        "Find and follow a Thuishaven pattern to self-host something on your own server.",
      argsSchema: {
        problem: z
          .string()
          .describe(
            "What you want to self-host, in plain words — e.g. 'a password manager for my family'.",
          ),
      },
    },
    ({ problem }) => {
      const { matches } = findPatternForProblem(patterns, {
        description: problem,
      });
      const candidates =
        matches.length > 0
          ? `Candidate patterns for this request (from find_pattern_for_problem):\n${matches
              .map(
                (m) =>
                  `- ${m.id} (relevance ${m.relevance_score}) — ${m.title}: ${m.why_matched}`,
              )
              .join("\n")}`
          : `No pattern matched this request directly. Confirm with the user, then either suggest the closest category via list_categories or offer to draft a new pattern.`;

      return userText(
        `The user wants to self-host: "${problem}".\n\n${candidates}\n\nConfirm the best fit with the user, fetch it with get_pattern, and follow it on their server.\n\n${WORKFLOW}`,
      );
    },
  );

  // bootstrap_server — the near-universal prerequisite: a server to deploy onto.
  server.registerPrompt(
    "bootstrap_server",
    {
      title: "Bootstrap a self-hosting server",
      description:
        "Prepare a fresh server for self-hosting (Dokploy + Tailscale + Traefik) before deploying any apps.",
    },
    () =>
      userText(
        `The user wants to prepare a server for self-hosting. This is the prerequisite for most other patterns.\n\nCall get_setup_guide with target "dokploy" to fetch the bootstrap pattern, then follow it on a FRESH server (a throwaway VM or new VPS — the installer runs \`docker swarm leave --force\` and claims ports 80/443/3000, so never run it on a machine you care about). Verify each step before moving on.\n\n${WORKFLOW}`,
      ),
  );

  // contribute_pattern — close the loop: a dogfood deviation becomes a PR.
  server.registerPrompt(
    "contribute_pattern",
    {
      title: "Contribute or fix a pattern",
      description:
        "Turn something you learned while following a pattern into a fix or a new pattern PR.",
      argsSchema: {
        pattern_id: z
          .string()
          .optional()
          .describe(
            "The pattern you were following, if this is a fix rather than a brand-new pattern.",
          ),
      },
    },
    ({ pattern_id }) => {
      const target = pattern_id
        ? `You're improving an existing pattern: "${pattern_id}". Fetch it with get_pattern to get its current body and source_url, then propose a focused diff for the step that was wrong or missing.`
        : `You're drafting a new pattern. Read an existing one with get_pattern as a template for the frontmatter and structure, and check list_categories for where it belongs.`;

      return userText(
        `${target}\n\nThuishaven's contribution bar: the contributor has personally run the pattern end-to-end and can justify the recommended app over its alternatives. New patterns start as \`status: experimental\` and become \`stable\` only after a maintainer validates them. Frontmatter must match the schema (filename == id). Patterns live at ${PATTERN_SOURCE_BASE_URL}; open a PR against that repo.\n\n${WORKFLOW}`,
      );
    },
  );
}
