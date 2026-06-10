# Deployment

How a maintainer sets up the Thuishaven public infrastructure from scratch, and how routine deployments work afterwards. Written for the current maintainer and the next one.

Two deployables, both on Cloudflare Workers:

| What | Worker name | Domain | Config |
|---|---|---|---|
| MCP server | `thuishaven-mcp` | `mcp.thuishaven.dev` | `mcp-server/wrangler.jsonc` |
| Website (static assets) | `thuishaven-website` | `thuishaven.dev` | `website/wrangler.jsonc` |

Plus the self-host Docker image on GHCR (`ghcr.io/thuishaven/thuishaven-mcp`), published on version tags.

> **Why Workers for the website and not Pages?** The original plan said Cloudflare Pages, but Cloudflare now recommends Workers static assets for new projects and Astro's official deploy guide no longer covers Pages. Static asset requests on Workers are free, and we get one deploy tool (`wrangler`) for both deployables.

## 1. One-time Cloudflare setup (manual, done by a human)

1. **Account and zone.** Create/use a Cloudflare account. The `thuishaven.dev` domain is registered at Cloudflare Registrar, so its zone is already active on the account. Verify under **Account Home → thuishaven.dev** that the zone status is *Active*.
2. **Account ID.** Account Home → Workers & Pages → the **Account ID** is in the right-hand sidebar (also in any zone's Overview page). You'll need it twice below.
3. **API token.** [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → template **Edit Cloudflare Workers**. Scope it to this account, and to the `thuishaven.dev` zone where the template asks. This single token serves both Workers deploys.
4. **No DNS records needed by hand.** Both wrangler configs use `custom_domain: true`; on first deploy Cloudflare creates the DNS records and certificates itself. Constraint: a custom domain cannot be attached to a hostname that already has a conflicting DNS record — if `thuishaven.dev` or `mcp.thuishaven.dev` have leftover A/CNAME records, delete them first.

## 2. First deploys (local, before any CI)

Validate everything locally before automating. With the API token in hand:

```bash
export CLOUDFLARE_API_TOKEN=...   # or `npx wrangler login` for interactive OAuth
export CLOUDFLARE_ACCOUNT_ID=...
```

**MCP server:**

```bash
cd mcp-server
npm ci && npm run typecheck && npm test
npx wrangler deploy
```

**Website:**

```bash
cd website
npm ci && npm run check && npm run build
npx wrangler deploy
```

**Verify:**

```bash
curl https://mcp.thuishaven.dev/          # info text, HTTP 200
curl -s -X POST https://mcp.thuishaven.dev/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 300

claude mcp add --transport http thuishaven https://mcp.thuishaven.dev/mcp
# then in a Claude Code session: "find me a thuishaven pattern for sharing a calendar"

open https://thuishaven.dev               # all pages, dark/light toggle, /rss.xml
```

Certificates for fresh custom domains can take a few minutes on the very first deploy.

## 3. GitHub side

Repo: `github.com/thuishaven/thuishaven`. In **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from step 1.3 |
| `CLOUDFLARE_ACCOUNT_ID` | the account ID from step 1.2 |

## 4. Enabling CI deployments (deliberate switch)

The deploy workflows ship **manual-trigger only** (`workflow_dispatch`). Once local deploys are validated:

1. Test the workflows manually once: GitHub → Actions → "Deploy MCP server" → **Run workflow** (same for "Deploy website").
2. Then enable continuous deployment by uncommenting the `push:` trigger block at the top of `.github/workflows/deploy-mcp.yml` and `deploy-site.yml`. Each has a paths filter so only relevant changes deploy; pattern edits redeploy both (the MCP bundles patterns at build time, the site renders them).

After that, a merge to `main` is a deploy. The MCP workflow runs typecheck + tests before deploying; a red test blocks the deploy.

## 5. Docker image on GHCR

`.github/workflows/publish-image.yml` builds a multi-arch (amd64 + arm64) image and pushes to `ghcr.io/thuishaven/thuishaven-mcp` whenever a version tag is pushed:

```bash
git tag v0.1.0
git push origin v0.1.0
```

It authenticates with the workflow's own `GITHUB_TOKEN` — no extra secrets. One-time task after the first publish: on the package page (Organization → Packages → thuishaven-mcp), set visibility to **Public** so self-hosters can pull without auth.

## 6. Operations notes

- **Pattern updates go live on deploy, not on merge** (until CI is enabled — then they're the same thing). The Worker holds patterns in memory from the build-time bundle; there is no runtime fetching.
- **Rollback** = redeploy a previous commit: `git checkout <sha> && npx wrangler deploy` from the relevant directory. Workers deploys are atomic.
- **Free tier limits** (current): 100k requests/day, 10 ms CPU per invocation, 3 MB compressed Worker bundle. The bundle limit is the one to watch as the pattern count grows, since patterns ride inside the MCP Worker. Static asset requests for the website don't count against request limits.
- **Telemetry stance**: `observability.enabled = false` in both wrangler configs. Cloudflare's default aggregate request counts are visible in the dashboard; we add nothing on top, per the project's zero-telemetry rule.
- **Token hygiene**: the API token can deploy Workers on the account — treat it like a deploy key. Rotate it from the same API-tokens page if it ever leaks; CI picks up the new value from the GitHub secret.
