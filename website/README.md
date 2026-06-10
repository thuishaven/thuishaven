# Thuishaven website

Static Astro site for [thuishaven.dev](https://thuishaven.dev). Reads the canonical pattern markdown straight from [`../patterns/`](../patterns/) via Astro content collections — zero content duplication; the repo is the CMS.

## Stack

- **Astro 6** (static output, no SSR adapter) with content collections; the zod schema in [`src/content.config.ts`](src/content.config.ts) mirrors [`../schema/pattern.schema.json`](../schema/pattern.schema.json) — keep them in sync.
- **Tailwind CSS 4** via the Vite plugin, CSS-first config in [`src/styles/global.css`](src/styles/global.css). System fonts only.
- Dark mode by default, light toggle, stored in `localStorage` (`data-theme` attribute).
- The only client-side JavaScript: the theme toggle and the pattern-list filters. No framework, no analytics, no cookies, no external requests.
- OpenGraph tags, sitemap (`/sitemap-index.xml`), RSS (`/rss.xml`).
- A small remark plugin ([`plugins/remark-repo-links.mjs`](plugins/remark-repo-links.mjs)) rewrites the repo-relative links inside pattern/CONTRIBUTING markdown to site routes or GitHub URLs.

## Pages

| Route | Purpose |
|---|---|
| `/` | Landing: value prop, what-this-is/isn't, pattern cards, CTAs |
| `/patterns/` | Filterable index (category, status, tag) |
| `/patterns/[id]/` | Rendered pattern with frontmatter sidebar |
| `/mcp/` | Connecting Claude Code/Desktop to the hosted or self-hosted MCP |
| `/contributing/` | Rendered `../CONTRIBUTING.md` |

## Local development

Requires Node 22+.

```bash
cd website
npm install
npm run dev       # dev server on :4321, hot-reloads on pattern edits
npm run build     # static build to dist/
npm run preview   # serve the built dist/
npm run check     # astro check (types + templates)
```

Note: edits to `../patterns/*.md` hot-reload; changes to the collection *schema* need a dev-server restart.

## Deployment

Built as static assets and served by a Cloudflare Worker ([`wrangler.jsonc`](wrangler.jsonc), assets-only — no server code). Cloudflare recommends Workers static assets over Pages for new projects, and static asset requests are free. Deploy is manual until Phase 4 wires up CI:

```bash
npm run build && npx wrangler deploy
```
