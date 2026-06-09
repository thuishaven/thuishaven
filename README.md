# Thuishaven

Thuishaven (Dutch for "home port") is a community-driven library of opinionated, agent-readable patterns for self-hosting. Each pattern is an end-to-end recipe for a common use case — it names one recommended app, one deploy target, one exposure model, and gives exact steps plus known gotchas. Not a catalog of every self-hostable app (that's [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)'s job), but a playbook: opinionated glue that ties Dokploy, Tailscale, Cloudflare, and the apps themselves into something you — or your coding agent — can follow without spending the weekend on config.

- **Website**: [thuishaven.dev](https://thuishaven.dev) *(coming soon)*
- **Hosted MCP**: `https://mcp.thuishaven.dev` *(coming soon)*
- **License**: MIT. No analytics, no telemetry, no paid tier.

## How you'll use it

There are two ways to consume the patterns; both serve the same markdown files in this repo.

**Hosted MCP (easiest).** Point Claude Code, Claude Desktop, or any MCP-capable agent at the hosted endpoint at `mcp.thuishaven.dev`. The agent can then list patterns, fetch full recipes, and match free-text problems ("I want a date picker my friends can use") to the right pattern. Stateless, free, nothing to run.

**Self-host the MCP.** Run the published Docker image on your own infrastructure, or run the server from source with stdio transport for direct Claude Desktop/Code integration. Same code, same patterns — you can even point it at a fork with your own private patterns.

Both paths ship after the MCP server lands (Phase 2). Right now this repo contains the patterns themselves, the frontmatter schema, and the validation tooling.

You can also just read the patterns: they're plain markdown in [`patterns/`](patterns/).

## Patterns

| Pattern | What it solves | Status |
|---|---|---|
| [dokploy-bootstrap](patterns/dokploy-bootstrap.md) | Set up a fresh Ubuntu server for self-hosting | experimental |
| [scheduling-tool](patterns/scheduling-tool.md) | Date picker for sharing with friends | experimental |
| [vaultwarden-family](patterns/vaultwarden-family.md) | Move your family off 1Password to self-hosted Vaultwarden | experimental |

`experimental` means the pattern is written but not yet validated end-to-end by a maintainer; `stable` means it has been. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full lifecycle.

## Repository layout

```
patterns/    one markdown file per pattern, YAML frontmatter + body
schema/      JSON Schema the frontmatter is validated against
scripts/     validate-patterns.ts — the CI validation CLI
mcp-server/  MCP server (Phase 2, not yet built)
website/     Astro static site (Phase 3, not yet built)
```

Validate locally:

```bash
npm install
npx tsx scripts/validate-patterns.ts
```

## Contributing

Patterns are contributed via pull request and reviewed by a maintainer. The bar: you have personally run the pattern end-to-end, and you can explain why you chose this app over the alternatives. See [CONTRIBUTING.md](CONTRIBUTING.md).
