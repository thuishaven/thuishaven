# Thuishaven

[![Validate](https://github.com/thuishaven/thuishaven/actions/workflows/validate.yml/badge.svg)](https://github.com/thuishaven/thuishaven/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Patterns](https://img.shields.io/badge/patterns-3-14b8a6.svg)](patterns/)
[![Website](https://img.shields.io/badge/website-thuishaven.dev-0f172a.svg)](https://thuishaven.dev)

Thuishaven (Dutch for "home port") is a community-driven library of opinionated, agent-readable patterns for self-hosting. Each pattern is an end-to-end recipe for a common use case — it names one recommended app, one deploy target, one exposure model, and gives exact steps plus known gotchas. Not a catalog of every self-hostable app (that's [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)'s job), but a playbook: opinionated glue that ties Dokploy, Tailscale, Cloudflare, and the apps themselves into something you — or your coding agent — can follow without spending the weekend on config.

- **Website**: [thuishaven.dev](https://thuishaven.dev) — browse patterns, human-friendly
- **Hosted MCP**: `https://mcp.thuishaven.dev/mcp` — the same patterns, agent-friendly
- **License**: MIT. No analytics, no telemetry, no paid tier.

> Status: pre-launch. The hosted endpoints go live after the patterns pass end-to-end validation ([docs/deployment.md](docs/deployment.md)).

## Quick start: use the hosted MCP

**Claude Code:**

```bash
claude mcp add --transport http thuishaven https://mcp.thuishaven.dev/mcp
```

Or commit it to a project's `.mcp.json`:

```json
{
  "mcpServers": {
    "thuishaven": { "type": "http", "url": "https://mcp.thuishaven.dev/mcp" }
  }
}
```

**Claude Desktop / claude.ai**: Settings → Connectors → **Add custom connector** → `https://mcp.thuishaven.dev/mcp`.

Then ask your agent things like *"find me a pattern for scheduling dates with friends, and follow it on my server."* Five tools are exposed: `list_patterns`, `get_pattern`, `find_pattern_for_problem`, `list_categories`, `get_setup_guide`.

The server also ships three **prompts** — user-invoked slash commands that carry the workflow, not just the data: `/mcp__thuishaven__self_host`, `/mcp__thuishaven__bootstrap_server`, and `/mcp__thuishaven__contribute_pattern`.

## Use it as a skill

For agents that should reach for Thuishaven *without being asked* — whenever the conversation turns to self-hosting — install the bundled [Agent Skill](skills/thuishaven-self-hosting/SKILL.md). It teaches the agent the workflow (match a pattern → follow it verbatim → treat every deviation as a pattern bug) and triggers automatically on relevant requests.

```bash
# Claude Code: drop it into your skills directory
cp -r skills/thuishaven-self-hosting ~/.claude/skills/
```

For Claude.ai, zip the `skills/thuishaven-self-hosting` folder and upload it under **Settings → Capabilities → Skills**. The skill expects the hosted MCP (above) to be connected.

## Quick start: self-host the MCP

Run the published image (HTTP on :3000, or stdio for direct Claude Desktop/Code integration):

```bash
docker run -p 3000:3000 ghcr.io/thuishaven/thuishaven-mcp
claude mcp add --transport http thuishaven http://localhost:3000/mcp
```

Or from source: `cd mcp-server && npm install && npm run start:stdio` (or `start:http`). You can point any self-hosted instance at your own patterns fork via `PATTERNS_DIR`. Details, including the stdio Docker variant and Claude Desktop config snippets: [mcp-server/README.md](mcp-server/README.md).

## Patterns

| Pattern | What it solves | Status |
|---|---|---|
| [dokploy-bootstrap](patterns/dokploy-bootstrap.md) | Set up a fresh Ubuntu server for self-hosting | stable |
| [scheduling-tool](patterns/scheduling-tool.md) | Date picker for sharing with friends | stable |
| [vaultwarden-family](patterns/vaultwarden-family.md) | Move your family off 1Password to self-hosted Vaultwarden | experimental |

`experimental` means the pattern is written but not yet validated end-to-end by a maintainer; `stable` means it has been. Patterns are plain markdown with structured frontmatter — readable here, rendered at [thuishaven.dev/patterns](https://thuishaven.dev/patterns/), served over MCP.

## Repository layout

```
patterns/    one markdown file per pattern, YAML frontmatter + body (the source of truth)
schema/      JSON Schema the frontmatter is validated against
scripts/     validate-patterns.ts — the CI validation CLI
mcp-server/  MCP server: Cloudflare Workers + Node HTTP (Docker) + Node stdio
website/     Astro static site reading ../patterns directly
skills/      Agent Skill that teaches an agent the self-hosting workflow
docs/        deployment runbook
```

Validate patterns locally:

```bash
npm install
npx tsx scripts/validate-patterns.ts
```

## Contributing

Patterns are contributed via pull request and reviewed by a maintainer. The bar: you have personally run the pattern end-to-end, and you can explain why you chose this app over the alternatives. New patterns start as `experimental` and become `stable` after maintainer validation. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full process, the quality criteria, and the recommendation philosophy.
