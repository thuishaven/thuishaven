---
name: thuishaven-self-hosting
description: >-
  Use when the user wants to self-host an app, deploy something to their own
  server or VPS, set up a home server, or move off a paid SaaS (1Password,
  Doodle, Calendly, etc.) to a self-hosted alternative. Fetches and follows
  vetted Thuishaven patterns via the Thuishaven MCP server — opinionated,
  end-to-end recipes that each name one app, one deploy target, and one exposure
  model. Covers server bootstrap (Dokploy + Tailscale), scheduling (Rallly),
  family password management (Vaultwarden), and the dogfood/contribution loop.
---

# Self-hosting with Thuishaven

Thuishaven is a library of opinionated, agent-readable self-hosting patterns.
Each pattern is an end-to-end recipe for one common use case: it names a single
recommended app, a single deploy target, a single exposure model, and gives
exact steps plus the gotchas that bite in practice. It is a *playbook*, not a
catalog — the value is the opinion and the order of operations, not a list of
options.

This skill assumes the **Thuishaven MCP server** is connected. If it isn't, ask
the user to add it:

```bash
claude mcp add --transport http thuishaven https://mcp.thuishaven.dev/mcp
```

The server exposes five tools — `list_patterns`, `get_pattern`,
`find_pattern_for_problem`, `list_categories`, `get_setup_guide` — and three
slash-command prompts (`/mcp__thuishaven__self_host`,
`/mcp__thuishaven__bootstrap_server`, `/mcp__thuishaven__contribute_pattern`).

## The workflow

1. **Match before improvising.** Call `find_pattern_for_problem` with the user's
   request in their own words. A matching pattern encodes a vetted choice —
   prefer it over assembling your own setup from first principles.
2. **Collect the inputs first.** If the pattern's frontmatter has an `inputs`
   list, gather every required value (or generate the ones with a `generate`
   command) before touching the server. Treat `secret` inputs as sensitive —
   don't echo them back. Steps reference them as `${NAME}`.
3. **Read the whole pattern, then follow it verbatim.** Use `get_pattern` (or
   `get_setup_guide` to bootstrap a server). Execute the steps in order on the
   user's real server. Don't skip the gotchas — they're the hard-won part.
   Prefer running an embedded script over retyping its output by hand.
4. **Verify with the assertions, don't just eyeball it.** If the pattern has an
   `assertions` list, run every `check` (each exits 0 when it holds) and report
   pass/fail per assertion; walk the user through any marked `manual`. Don't
   declare success until the scriptable assertions pass.
5. **Be honest about status.** Patterns are `experimental` until a maintainer
   has personally validated them end-to-end. If you're following an
   `experimental` pattern, say so — the user is helping prove it out. Note the
   pattern's `tested_against` version; if the user's app version differs, say so.
6. **Private first.** Keep admin surfaces on the tailnet (Tailscale) or
   local-only. Expose anything to the public internet only as a deliberate,
   clearly-named step the user agrees to.
7. **Every deviation is a pattern bug.** If you had to do something the pattern
   didn't mention — a missing dependency, a wrong port, an unclear instruction,
   an assertion that didn't match reality — that's a defect in the *pattern*,
   not a user error. Note it, and offer to open a PR. See "Contributing back".
8. **No match? Say so plainly.** Don't invent a pattern or pretend one exists.
   Use `list_categories` to suggest the nearest area, or offer to draft a new
   pattern for contribution.

## Bootstrapping a server first

Most app patterns assume a prepared server. If the user doesn't have one, run
the bootstrap pattern first via `get_setup_guide` (target `dokploy`).

⚠️ The Dokploy installer runs `docker swarm leave --force` unconditionally and
claims ports 80, 443, and 3000. **Never run it on a machine the user cares
about** (their daily laptop, an existing server). Use a fresh VPS or a throwaway
local VM (e.g. `multipass launch 24.04`). That also honestly matches the
pattern's "fresh Ubuntu server" premise.

## Current patterns

| Pattern (`id`) | Solves | Category | Status |
|---|---|---|---|
| `dokploy-bootstrap` | Prepare a fresh Ubuntu server for self-hosting | bootstrap | experimental |
| `scheduling-tool` | Date picker / poll to share with friends (Rallly) | collaboration | experimental |
| `vaultwarden-family` | Move a family off 1Password to Vaultwarden | security | experimental |

Always fetch the live list with `list_patterns` — this table can go stale.

## Contributing back

The contribution loop is what makes the library improve. When a pattern was
wrong or incomplete:

- Use `/mcp__thuishaven__contribute_pattern` (pass the `pattern_id` for a fix),
  or fetch the pattern with `get_pattern` to get its `source_url`.
- The bar: the contributor has personally run the pattern end-to-end and can
  justify the recommended app over its alternatives.
- Frontmatter must match the schema and the filename must equal the `id`. New
  patterns start `experimental` and become `stable` only after maintainer
  validation.
- Open the PR against the repo the `source_url` points to.

## What not to do

- Don't add telemetry, analytics, or "phone-home" steps to anything you set up.
  Thuishaven is zero-telemetry by principle; respect that in what you deploy.
- Don't expose admin panels publicly for convenience.
- Don't claim a pattern is validated when it's `experimental`.
