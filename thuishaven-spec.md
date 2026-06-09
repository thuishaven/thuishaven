# Thuishaven — Project Specification

> Thuishaven (Dutch for “home port”) — a community-driven library of opinionated, agent-readable best practices for self-hosting. The goal: someone has a server and wants to host useful apps without reinventing every wheel. Existing tools (Dokploy, Tailscale, Cloudflare Tunnel, awesome-selfhosted) already do their part well — Thuishaven provides the **opinionated glue** that ties them together into actionable patterns.

**Name**: Thuishaven, pronounced *toys-HAH-ven*. The metaphor: a home port is where you safely dock the things that matter. Patterns, deployments, family services. Self-hosting is your fleet; Thuishaven is the harbor master’s playbook.
**Domain**: thuishaven.dev
**License**: MIT
**Stack**: Cloudflare Workers (MCP) + Cloudflare Pages (site) + GitHub (patterns repo)

-----

## 1. Vision and Why

### The problem

Self-hosting today requires assembling knowledge from many sources: awesome-selfhosted for app discovery, app-specific READMEs for setup, Coolify/Dokploy docs for deployment, Tailscale/Cloudflare docs for exposure, and a lot of forum threads to fill the gaps. Each piece works, but stitching them together for a specific use case (“I want a date picker my friends can use via my domain”) still requires hours of figuring out.

For agentic workflows (Claude Code, Cursor, etc.) this is even worse. Agents do well with structured, opinionated information and poorly with ten conflicting forum opinions. They make small mistakes — wrong env var format, outdated config, poorly chosen exposure model — that humans catch but agents don’t.

### What this project is

An MCP server that serves **patterns**: opinionated, end-to-end recipes for common self-hosting use cases. Each pattern names a recommended app, a recommended deploy target (Dokploy by default), a recommended exposure model, and gives exact step-by-step instructions plus known gotchas.

Not a catalog. Not a database of every app. Not a replacement for awesome-selfhosted. A **playbook** — opinionated, agent-readable, community-curated.

### What this project is NOT

- Not a hosting platform. We don’t run anyone’s containers.
- Not an app registry. We don’t index every self-hostable app — that’s awesome-selfhosted’s job.
- Not a replacement for Dokploy/Coolify. We tell agents how to use them.
- Not for-profit. No paid tier, no enterprise, no upsells. MIT licensed, donations optional later.
- Not for beginners who don’t have a server yet. Target audience already has, or is willing to set up, a Linux server.

### Differentiation

Existing alternatives:

- **awesome-selfhosted**: neutral list of links, not opinionated, not agent-friendly, no deploy guidance.
- **Coolify/Dokploy templates**: opinionated but tied to one platform, no exposure guidance, no broader workflow.
- **Cloud one-click installs (Pikapods, Linuxserver.io)**: take away your control, often paid.
- **Generic LLMs without context**: hallucinate config, choose stale forks, mix versions.

This project sits in the gap: opinionated like Coolify templates, broad like awesome-selfhosted, structured for agents, and self-host-respecting.

### Target users

1. **Hidde and people like Hidde**: technical professionals who use agentic workflows daily, want to self-host but not spend the weekend on config.
1. **Homelab enthusiasts adopting AI tooling**: already comfortable with Docker, want to stop reinventing setup recipes.
1. **Agents themselves** (Claude Code etc.) acting on behalf of users.

Explicit non-targets: pure GUI users (Coolify is better for them), enterprise IT, people without a server.

-----

## 2. Architecture Overview

### Four components

1. **Patterns repository** — a Git repo containing markdown files (one per pattern) with YAML frontmatter. Source of truth, contributed via PR.
1. **MCP server** — reads the pattern files, exposes them via Model Context Protocol tools. Stateless. Can run anywhere.
1. **Static website** — Astro-based docs site reading the same markdown files. Browsable for humans, indexable by search engines.
1. **CI/validation** — GitHub Actions that validate frontmatter schema and run lint checks on every PR. Also builds and deploys the static site and the MCP container image.

### Why this shape

- **Markdown + YAML frontmatter**: humans read it, agents parse it, one file per pattern keeps it browsable on GitHub directly.
- **Git as the database**: no infrastructure to run, PR-based contribution model proven by awesome-selfhosted.
- **Stateless MCP**: any user can self-host an instance, no central database to maintain, no rate limiting headaches.
- **Astro static site sharing the same markdown**: zero content duplication, fast static delivery, free hosting on Cloudflare Pages.

### Hosting plan

The public infrastructure for Thuishaven runs entirely on Cloudflare. Hidde’s own Ubuntu server stays private (accessible only via Tailscale) and consumes the public MCP endpoint just like any other user — explicit dogfooding via the same path the community takes.

- **Domain**: `thuishaven.dev`, registered at Cloudflare Registrar.
- **Patterns repo**: GitHub, public, MIT license, from day 1, at `github.com/thuishaven/thuishaven` (or similar — final org name TBD).
- **Static website**: Cloudflare Pages at `thuishaven.dev`, auto-built from `main` branch via Cloudflare’s GitHub integration.
- **MCP server**: Cloudflare Workers at `mcp.thuishaven.dev`, deployed via `wrangler` from CI on `main`.
- **Container image**: still built and published to GHCR for users who prefer to run the MCP themselves with stdio transport (the standard local Claude Desktop / Claude Code setup) or in their own infrastructure.

### Why Cloudflare for the public infrastructure

- **Stateless MCP fits Workers natively**: patterns come from the Git repo, no database required.
- **Hidde’s home server stays private**: no public ingress to his Ubuntu box, no expanded attack surface to his Tailscale-internal tools.
- **Free tier covers all foreseeable usage**: Workers free tier is 100k requests/day; Pages free tier is unlimited static requests with a generous build minute allowance.
- **One provider, one DNS zone**: simpler operations, no juggling between providers.
- **Hands-off uptime**: no patches, no container restarts, no worrying about home internet outages affecting the public service.

### Mental model — three layers

This separation matters and should be reflected in how the project is described:

1. **Hidde’s home server** (Ubuntu + Dokploy + Tailscale): private workflows, family tools (Vaultwarden, Rallly via Cloudflare Tunnel), personal MCPs accessible only via tailnet. Consumes `mcp.thuishaven.dev` like everyone else.
1. **Cloudflare-hosted public Thuishaven** (Pages + Workers): the open source project’s public face. Site, hosted MCP endpoint, GHCR image distribution.
1. **Optional future**: a Hetzner VPS for publicly-hosted personal infrastructure if/when needed. Not part of MVP.

Self-hosters who want to run their own MCP do so via the Docker image; that path is fully supported and documented.

-----

## 3. Pattern Format

Every pattern is a single markdown file at `patterns/<pattern-id>.md`. Frontmatter is required and validated against `schema/pattern.schema.json`.

### Schema (frontmatter)

```yaml
---
id: scheduling-tool
title: "Date picker for sharing with friends"
version: 1
status: stable  # stable | experimental | deprecated
category: collaboration  # see allowed categories below
tags: [scheduling, polls, no-account-needed]
maintainer: hiddevdploeg

# What problem does this pattern solve?
problem: >
  You want to schedule a date with friends or family without using
  Doodle/Datumprikker SaaS. Tool should be free, simple, and shareable
  via a link.

# What does this pattern recommend?
recommendation:
  app: rallly
  app_source: https://github.com/lukevella/rallly
  deploy_target: dokploy  # dokploy | docker-compose | coolify | k8s
  exposure: public-domain  # public-domain | tailnet | cloudflare-tunnel | local-only

# Alternatives considered
alternatives:
  - name: dudle
    reason_not_chosen: "No active maintenance, dated UI"
  - name: when2meet (self-host)
    reason_not_chosen: "No official self-host distribution"

# Prerequisites — what does the user need before starting?
prerequisites:
  - dokploy-installed
  - public-domain-configured
  - postgres-or-sqlite-available

# Estimated time to follow this pattern from scratch
estimated_time_minutes: 15

# What can go wrong, and what to check
gotchas:
  - "NEXT_PUBLIC_BASE_URL must match the public URL exactly, including https://"
  - "SMTP is optional but magic-link login won't work without it"

# Related patterns (other things you might want next)
related: [vaultwarden-family, dokploy-bootstrap]
---

# Body: actual instructions in markdown
```

### Body structure (convention, not strictly enforced)

Every pattern body should follow this rough structure for predictability:

1. **Context** — one paragraph on when to use this pattern
1. **Decisions explained** — why this app, why this deploy target, why this exposure model
1. **Step-by-step** — numbered, copy-pasteable commands and configs
1. **Verification** — how to confirm it works
1. **Gotchas** — expanded version of frontmatter gotchas with explanations
1. **Maintenance notes** — backups, updates, what breaks over time

### Allowed categories (initial set, expandable via PR)

- `bootstrap` — server-level setup (Docker, Dokploy, Tailscale)
- `productivity` — notes, tasks, bookmarks
- `collaboration` — shared tools (date pickers, expense splitting)
- `media` — photos, music, video
- `security` — password managers, 2FA, secrets
- `monitoring` — uptime, logs, metrics
- `family` — opinionated multi-user setups for households

### Pattern statuses

- `experimental`: contributed but not yet validated by maintainer
- `stable`: validated, tested by maintainer at least once, recommended
- `deprecated`: better pattern exists, kept for archive

-----

## 4. MCP Server Specification

### Stack

- **Language**: TypeScript (Node 20+ for local dev, Workers runtime for production)
- **MCP SDK**: official `@modelcontextprotocol/sdk`
- **Transport**: HTTP for the hosted Workers endpoint, stdio for local self-host
- **Runtime targets**:
  - **Production**: Cloudflare Workers (Web standard APIs: Fetch, Web Streams)
  - **Self-host containerized**: Node 20 in a multi-stage Docker image, published to GHCR
  - **Self-host local**: stdio transport for direct Claude Desktop / Claude Code integration

The MCP server code must be runtime-agnostic where possible. Use Web standards APIs (Fetch, Web Streams, `URL`) instead of Node-specific APIs (`fs`, `http`) at the boundaries. For pattern loading, abstract the source: in Workers it loads from a baked-in JSON bundle (built at deploy time from the patterns directory); in Node/Docker it loads from the local filesystem.

### Tools exposed via MCP

All tools take JSON arguments and return structured JSON responses. Markdown bodies are returned as strings.

#### `list_patterns`

List all available patterns, optionally filtered.

```typescript
input: {
  category?: string,
  status?: 'stable' | 'experimental' | 'deprecated',
  tag?: string
}
output: {
  patterns: Array<{
    id: string,
    title: string,
    category: string,
    status: string,
    problem: string,  // short summary from frontmatter
    estimated_time_minutes: number
  }>
}
```

#### `get_pattern`

Get the full content of a pattern.

```typescript
input: {
  id: string
}
output: {
  frontmatter: PatternFrontmatter,  // typed object
  body: string,  // full markdown body
  source_url: string  // GitHub URL for reference
}
```

#### `find_pattern_for_problem`

Match a free-text problem description to relevant patterns. Implementation: fuzzy match against `problem` and `tags` fields. (Future: semantic search; for MVP, simple keyword overlap is fine.)

```typescript
input: {
  description: string,  // e.g. "I want to share a calendar with family"
  limit?: number  // default 3
}
output: {
  matches: Array<{
    id: string,
    title: string,
    relevance_score: number,  // 0-1
    why_matched: string  // human-readable explanation
  }>
}
```

#### `list_categories`

Static list of categories with counts of patterns in each.

```typescript
output: {
  categories: Array<{
    id: string,
    description: string,
    pattern_count: number
  }>
}
```

#### `get_setup_guide`

Returns bootstrap instructions for getting a server ready (Dokploy install, Tailscale, etc.). These are themselves patterns under category `bootstrap`, but exposed as a convenience tool because they’re the most common entry point.

```typescript
input: {
  target: 'dokploy' | 'docker-compose' | 'tailscale-exit-node'
}
output: {
  pattern: PatternResponse  // same shape as get_pattern
}
```

### Pattern loading strategy

The MCP server has two pattern loading modes, chosen at build time:

**Workers production mode**: at deploy time, a build step reads all `./patterns/*.md`, parses and validates frontmatter, and emits a single `patterns.bundle.json` that is bundled into the Worker. At runtime the Worker holds patterns in memory; refresh happens on next deployment. This is simpler than runtime fetching and makes deploys atomic (a pattern goes live exactly when CI deploys).

**Node / Docker self-host mode**: scan `./patterns/*.md` at startup, parse frontmatter (use `gray-matter`), validate against schema (use `ajv`), hold in memory. Optionally support a watch mode that reloads on file changes for local development.

The same loader code path is used; only the source of patterns differs (bundled JSON vs filesystem).

### Self-host instructions in README

Include a section telling people:

1. **Use the hosted MCP**: easiest path — point Claude Desktop / Claude Code at `https://mcp.thuishaven.dev`. Copy-paste config snippet for both clients.
1. **Run the published Docker image**: `docker run -p 3000:3000 ghcr.io/thuishaven/thuishaven-mcp` for HTTP transport, or use the stdio variant for direct integration.
1. **Build from source**: `git clone && cd mcp-server && npm install && npm run start:stdio` (for direct Claude integration) or `npm run start:http` (for HTTP server mode).
1. **Fork and customize**: how to point an MCP instance at a custom patterns directory if someone wants to maintain their own variant.

-----

## 5. Repository Structure

```
thuishaven/
├── README.md                      # project overview, how to use, how to contribute
├── CONTRIBUTING.md                # contribution guidelines, PR template
├── LICENSE                        # MIT
├── patterns/                      # pattern markdown files
│   ├── dokploy-bootstrap.md
│   ├── scheduling-tool.md
│   └── vaultwarden-family.md
├── schema/
│   └── pattern.schema.json        # JSON Schema for frontmatter validation
├── mcp-server/
│   ├── package.json
│   ├── wrangler.toml              # Cloudflare Workers config
│   ├── Dockerfile                 # for self-host distribution via GHCR
│   ├── src/
│   │   ├── core/                  # runtime-agnostic MCP logic
│   │   │   ├── loader.ts          # parse and validate patterns (works on bundle or fs)
│   │   │   ├── tools/             # one file per MCP tool
│   │   │   └── types.ts
│   │   ├── workers.ts             # Cloudflare Workers entry point
│   │   ├── node-http.ts           # Node HTTP server entry (for Docker/self-host HTTP)
│   │   └── node-stdio.ts          # Node stdio entry (for local Claude integration)
│   ├── scripts/
│   │   └── build-patterns-bundle.ts  # builds patterns.bundle.json for Workers
│   └── tests/
├── website/                       # Astro static site
│   ├── astro.config.mjs
│   ├── package.json
│   ├── src/
│   │   ├── content/
│   │   │   └── config.ts          # content collections referencing ../patterns
│   │   ├── pages/
│   │   │   ├── index.astro        # landing page
│   │   │   ├── patterns/
│   │   │   │   ├── index.astro    # browseable list with filters
│   │   │   │   └── [id].astro     # individual pattern page
│   │   │   ├── mcp.astro          # how to connect MCP to Claude
│   │   │   └── contributing.astro
│   │   ├── components/
│   │   └── layouts/
│   └── public/
├── scripts/
│   └── validate-patterns.ts       # standalone CLI used by CI
└── .github/
    ├── workflows/
    │   ├── validate.yml           # runs schema validation + lint on PR
    │   ├── publish-image.yml      # builds and pushes Docker image on tag
    │   ├── deploy-mcp.yml         # deploys Worker via wrangler on main
    │   └── deploy-site.yml        # builds Astro and deploys to Cloudflare Pages on main
    ├── ISSUE_TEMPLATE/
    │   └── new-pattern.md
    └── PULL_REQUEST_TEMPLATE.md
```

-----

## 6. The Three Initial Patterns

Build these three patterns first. They prove the format works and cover the most common entry points.

### Pattern 1: `dokploy-bootstrap`

Title: “Set up a fresh Ubuntu server for self-hosting”

Covers: pre-flight checks, Dokploy install, Tailscale integration, Cloudflare DNS preparation, port conflict resolution, backup config. Essentially the install instruction we drafted earlier in this conversation, formalized into a pattern.

Category: `bootstrap`. Status: `stable` (Hidde validates by running it on his own server).

### Pattern 2: `scheduling-tool`

Title: “Date picker for sharing with friends”

App: Rallly. Deploy: Dokploy. Exposure: public domain via Cloudflare Tunnel. Includes Postgres setup, SMTP for magic links, optional anonymous polls, backup strategy.

Category: `collaboration`. Status: `experimental` until validated.

### Pattern 3: `vaultwarden-family`

Title: “Move your family off 1Password to self-hosted Vaultwarden”

App: Vaultwarden. Deploy: Dokploy. Exposure: public domain (required for browser extensions to work). Includes admin token setup, family organization, emergency access, automated backups to external storage, Bitwarden client config.

Category: `security` (also tagged `family`). Status: `experimental` until validated.

-----

## 7. Build Plan for Claude Code

Execute these phases in order. Stop and report at the end of each phase before continuing.

### Phase 1: Repo and pattern format

1. Create the repo structure as in section 5.
1. Write `schema/pattern.schema.json` matching the frontmatter spec in section 3.
1. Write `scripts/validate-patterns.ts` — a Node/TypeScript CLI that loads every `.md` in `patterns/`, parses frontmatter, validates against schema, exits non-zero on any failure with clear errors.
1. Write `.github/workflows/validate.yml` running the script on every PR.
1. Write the three initial patterns (section 6) with full content. Use the dokploy-bootstrap install instructions from this conversation as the basis for pattern 1.
1. Write `README.md`, `CONTRIBUTING.md`, `LICENSE` (MIT), PR template, issue template.
1. Commit, do NOT push yet — let Hidde review locally first.

### Phase 2: MCP server (multi-runtime)

1. Initialize `mcp-server/` with TypeScript, Node 20, the official MCP SDK, and `wrangler` for Workers tooling.
1. Implement `core/` first — runtime-agnostic logic:
- `loader.ts`: pure function that takes a pattern source (filesystem path OR pre-parsed bundle) and returns validated typed pattern objects. Use `gray-matter` for frontmatter parsing, `ajv` for schema validation.
- `tools/`: one file per MCP tool, all five tools from section 4. No I/O — they take a loaded pattern collection as input.
- `types.ts`: shared TypeScript types derived from the schema.
1. Implement runtime entry points:
- `workers.ts`: Cloudflare Workers fetch handler. Reads `patterns.bundle.json` from import (bundled at build time), wires up MCP HTTP transport.
- `node-http.ts`: Node HTTP server for Docker/self-host. Reads `../patterns/*.md` from filesystem.
- `node-stdio.ts`: Node stdio entry for direct Claude Desktop / Claude Code integration.
1. Implement `scripts/build-patterns-bundle.ts`: reads all patterns, produces `src/patterns.bundle.json` for Workers builds.
1. For `find_pattern_for_problem` use a simple keyword/tag overlap algorithm — no embeddings, no LLM calls. Score = (matched keywords / total keywords in description) weighted by tag matches.
1. Write unit tests for the loader and each tool. Tests run on Node, exercise the same `core/` code that Workers uses.
1. Write `wrangler.toml` for Workers deployment, with the route `mcp.thuishaven.dev/*`.
1. Write `Dockerfile` (multi-stage, alpine final image) for self-host distribution.
1. Document local setup and the three runtime modes in `mcp-server/README.md`.

### Phase 3: Static website

1. Initialize `website/` with Astro using the latest stable version, TypeScript, and Tailwind for styling.
1. Configure Astro content collections to read from `../patterns/*.md`. Use Zod schema that mirrors `schema/pattern.schema.json` for type safety.
1. Build the following pages:
- **Landing (`/`)**: hero with one-line value prop, three “what this is / what this isn’t” columns, prominent “Browse patterns” and “Connect to MCP” CTAs, link to GitHub
- **Patterns index (`/patterns`)**: filterable list (by category, status, tag), each entry showing title, problem summary, estimated time, status badge
- **Pattern detail (`/patterns/[id]`)**: full rendered markdown body, frontmatter rendered as a sidebar with prerequisites, alternatives, related patterns, gotchas
- **MCP setup (`/mcp`)**: instructions for connecting hosted MCP and self-hosting it; copy-paste config snippets for Claude Desktop and Claude Code
- **Contributing (`/contributing`)**: rendered version of CONTRIBUTING.md
1. Design constraints: minimal, fast, no JavaScript bloat, dark mode by default with light toggle, mobile-readable, no analytics, no cookies, no external font CDN (system fonts or self-hosted).
1. Add OpenGraph tags, sitemap, and a basic RSS feed for new/updated patterns.
1. Write `.github/workflows/deploy-site.yml` for Cloudflare Pages deployment on push to main.
1. Document Astro local development in `website/README.md`.

Visual style guidance: think tailscale.com or astro.build’s docs — calm, content-first, no marketing fluff. Read the frontend-design skill at `/mnt/skills/public/frontend-design/SKILL.md` before designing.

### Phase 4: Hosted deployment (Cloudflare)

1. Write `.github/workflows/deploy-mcp.yml`: on push to `main`, builds the patterns bundle, runs tests, deploys the Worker via `wrangler deploy`. Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub secrets — Hidde sets these manually.
1. Write `.github/workflows/deploy-site.yml`: on push to `main`, builds Astro and deploys to Cloudflare Pages. Use Cloudflare Pages’ GitHub integration where possible (less config) — fall back to direct API deploy if needed.
1. Write `.github/workflows/publish-image.yml`: on tagged release, builds multi-arch Docker image and pushes to GHCR for self-host users.
1. Write `docs/deployment.md` documenting how Hidde (or a future maintainer) sets up the Cloudflare and GitHub side from scratch: account creation, DNS records, API tokens, secrets.
1. Do NOT trigger any deployments from CI yet — Hidde validates locally first, then enables CI deployments.

### Phase 5: Polish and document

1. Make sure top-level README includes:
- What this project is (one paragraph)
- Link to live website
- Quick-start: how to use the hosted MCP from Claude Desktop/Code
- Quick-start: how to self-host the MCP
- Contribution overview pointing to CONTRIBUTING.md
1. Make sure `CONTRIBUTING.md` covers: pattern submission process, what makes a good pattern, status lifecycle, how reviews work, the maintainer-review model.
1. Add badges to README: build status, license, “patterns: 3” (auto-updated by CI later), website link.

### Rules for Claude Code

- Use TypeScript strict mode throughout.
- Prefer well-known, maintained dependencies (`gray-matter`, `ajv`, `zod` for runtime types).
- Do not add any analytics, telemetry, or tracking.
- Do not invent additional MCP tools beyond the five specified — if you think one is missing, surface it as a question for Hidde.
- Use Conventional Commits for commit messages.
- All comments in code in English.
- All pattern markdown files can be in either English or Dutch — Hidde will choose; assume English by default for MVP.
- Stop and ask if any external service requires creating an account (GHCR, Cloudflare, etc.) — Hidde does that himself.
- If something in this spec is ambiguous or contradictory, surface it before guessing.

-----

## 8. Open Questions Hidde Should Decide Before/During Build

Most major decisions are made. The remaining open items are flagged here.

1. **Project name and domain**: `thuishaven.dev` — registered at Cloudflare Registrar. Decided.
1. **GitHub org/repo name**: `github.com/thuishaven/thuishaven` is preferred but depends on org name availability. Fallback: `github.com/<hidde-username>/thuishaven` initially, transfer to a `thuishaven` org once registered. Decide before pushing to GitHub.
1. **Quality gate for contributions**: maintainer-review model — Hidde reviews every PR until natural co-maintainers emerge. Schema validation in CI catches mechanical errors before review. PR template forces contributors to declare: “I have personally run this pattern end-to-end” and “I have considered alternatives and documented why I chose this app.” Decided.
1. **Language for patterns**: English only for MVP. Add a `lang` field to frontmatter only if Dutch contributions arrive.
1. **License**: MIT. Decided.
1. **Versioning patterns**: how do we handle when an app’s recommended config changes? The frontmatter has `version: 1` — should we bump that on breaking changes and keep old versions? MVP default: only keep latest, use Git history for prior versions.
1. **Trademark/sponsor concerns**: opinionated recommendations could draw critique (“why Rallly and not Doodle?”). Document the criteria for “recommended” choices in CONTRIBUTING.md to forestall this.
1. **Telemetry**: zero telemetry, ever. Decided. This includes Cloudflare Workers analytics — Hidde may inspect aggregate request counts via Cloudflare dashboard but will not collect per-user, per-query, or per-pattern data, and will not add any custom metrics that go beyond what Cloudflare collects by default.
1. **Funding/sustainability**: explicitly no monetization in MVP. If it sticks, GitHub Sponsors for maintainers is the cleanest model. No paid tiers, no hosted SaaS.
1. **Visual identity**: Phase 3 includes a basic Astro site with Tailwind — but no logo or brand identity work in MVP. A wordmark in a clean sans-serif is enough. The maritime/harbor metaphor naturally suggests imagery (anchor, harbor, lighthouse, compass rose) but using these too eagerly will tip into kitsch. Stay restrained: maybe one subtle anchor or wave motif as a favicon/wordmark accent, no more. Logo can come later if community grows.

-----

## 9. Validation Plan (for after build)

Before announcing publicly:

1. Hidde runs through pattern 1 (dokploy-bootstrap) on a clean Ubuntu server. If it doesn’t work end-to-end without manual fixes, the pattern is wrong, not the user.
1. Hidde runs through pattern 2 (scheduling-tool) on the now-bootstrapped server. Same criterion.
1. Hidde runs through pattern 3 (vaultwarden-family) and actually moves at least his own credentials over. Real-world dogfood.
1. Each pattern that passes gets `status: stable` in frontmatter.
1. Hosted MCP at `mcp.thuishaven.dev` is live and tested with Claude Code from Hidde’s laptop: “find me a pattern for sharing a calendar” should return the scheduling pattern with high relevance.
1. Hidde tests the dogfood path: from his Dokploy instance, he asks Claude Code to use the Thuishaven MCP to find and deploy an app — reproducing the user journey end-to-end.
1. Static website is live at `thuishaven.dev`, all three patterns render correctly, MCP setup page works for both Claude Desktop and Claude Code with copy-pasteable config.
1. Self-host path is validated: pull the published Docker image, confirm it serves patterns correctly via HTTP, confirm stdio mode works when added to Claude Desktop config.

After all three patterns are stable, the MCP is hosted, and the site is live:

1. Post on Hacker News, r/selfhosted, r/homelab.
1. Submit to awesome-selfhosted as a meta-resource (under “Software” or a new “Resources” section).
1. Open issue templates for new pattern requests, see what people ask for.

The first month after launch is observation, not building. If patterns get used and PRs come in, expand. If silence, the experiment failed cheaply.
