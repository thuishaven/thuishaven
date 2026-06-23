---
id: scheduling-tool
title: "Date picker for sharing with friends"
version: 2
status: experimental
category: collaboration
tags: [scheduling, polls, calendar, dates, no-account-needed, rallly]
maintainer: hiddevh

problem: >
  You want to schedule a date with friends or family without using
  Doodle/Datumprikker SaaS. Tool should be free, simple, and shareable
  via a link — people you invite must be able to vote without creating
  an account.

recommendation:
  app: rallly
  app_source: https://github.com/lukevella/rallly
  deploy_target: dokploy
  exposure: public-domain

alternatives:
  - name: dudle
    reason_not_chosen: "No active maintenance, dated UI"
  - name: Framadate
    reason_not_chosen: "Works, but dated UX and a PHP stack oriented at large public instances rather than a personal deployment"
  - name: when2meet (self-host)
    reason_not_chosen: "No official self-host distribution"

prerequisites:
  - dokploy-installed
  - public-domain-configured
  - smtp-credentials-available

estimated_time_minutes: 30

tested_against:
  app_version: "4.10"
  verified: "2026-06-22"
  upstream_docs: https://support.rallly.co/self-hosting

inputs:
  - name: DOMAIN
    description: "Public domain the poll site is served from"
    example: dates.example.com
    format: hostname
    required: true
  - name: SUPPORT_EMAIL
    description: "Your email — admin, sender fallback, and the only address allowed to register"
    example: you@example.com
    format: email
    required: true
  - name: SMTP_HOST
    description: "SMTP host for the passwordless login emails"
    example: smtp.resend.com
    required: true
  - name: SMTP_PORT
    description: "SMTP port (587 for STARTTLS, 465 for implicit TLS)"
    default: "587"
    format: integer
    required: false
  - name: SMTP_USER
    description: "SMTP username"
    required: true
  - name: SMTP_PWD
    description: "SMTP password — note the env var is SMTP_PWD, not SMTP_PASSWORD"
    secret: true
    required: true
  - name: DB_HOST
    description: "Internal hostname Dokploy shows for the rallly-db Postgres service"
    example: rallly-db
    required: true
  - name: DB_PASSWORD
    description: "Postgres password for the rallly user (avoid @ : / — they need URL-encoding)"
    generate: "openssl rand -hex 24"
    secret: true
    required: true
  - name: SECRET_PASSWORD
    description: "Session encryption key; Rallly refuses to start under 32 chars"
    generate: "openssl rand -hex 32"
    secret: true
    required: true

assertions:
  - id: site-reachable
    description: "https://${DOMAIN} loads with a valid TLS certificate"
    check: "curl -fsS --max-time 10 https://${DOMAIN} >/dev/null"
  - id: serving-rallly
    description: "The domain actually serves Rallly, not a default Traefik/404 page"
    check: "curl -fsS --max-time 10 https://${DOMAIN} | grep -qi rallly"
  - id: db-not-exposed
    description: "Postgres is not reachable on the public interface"
    check: "! nc -z -w3 ${DOMAIN} 5432"
  - id: login-email-delivers
    description: "A login attempt produces a magic-link/code email within a minute (check spam once)"
    manual: true
  - id: guest-can-vote
    description: "The participant link can be voted on from a private window, no login"
    manual: true
  - id: registration-locked
    description: "A second registration with a different email is refused (confirms ALLOWED_EMAILS)"
    manual: true
  - id: backup-test-passes
    description: "The Dokploy database backup test for rallly-db succeeds"
    manual: true

gotchas:
  - "NEXT_PUBLIC_BASE_URL must match the public URL exactly, including https:// — login callbacks break otherwise"
  - "SECRET_PASSWORD must be at least 32 characters or the app refuses to start"
  - "SUPPORT_EMAIL is required by the app's env validation, not optional"
  - "Login is passwordless (email magic links/codes), so SMTP is effectively required to sign in — guests can still vote on polls without it"
  - "The SMTP password variable is SMTP_PWD, not SMTP_PASSWORD"
  - "Rallly v4 license-gates multi-user workspaces; single registered user + unlimited guest voters is free and is exactly this use case"

related: [dokploy-bootstrap, vaultwarden-family]
---

# Date picker for sharing with friends

## Context

Use this pattern when you want a Doodle replacement: you create a poll with candidate dates, send one link, and friends or family pick what works for them — no accounts, no ads, no SaaS. Rallly is a polished Next.js app that does precisely this. You (the poll creator) get the one registered account; participants just click the link and vote.

Written against Rallly v4.10 and verified against the current self-hosting docs (June 2026). Status `experimental` until validated end-to-end.

## Decisions explained

**Why Rallly.** Actively maintained, modern UX that non-technical participants don't trip over, official Docker distribution, and guest voting with no account requirement — which is the core of the use case. The alternatives are either unmaintained (dudle), dated (Framadate), or have no official self-host path (when2meet).

**One honest caveat — licensing.** Rallly is AGPL and free for personal use, but since v4 the *multi-user* features ("Spaces": inviting other registered members into your workspace) require a paid license. That does not affect this pattern: scheduling with friends needs exactly one registered user (you) and unlimited anonymous guest voters, which is free. If you wanted several family members to each manage their own polls on one instance, you'd need a license (Plus, up to 5 users) — or each runs their own instance.

**Why a public domain.** The entire point is sending a link to people who don't have Tailscale and never will. The poll links are unguessable IDs; the only account that exists is yours, and registration gets locked to your email address below.

**Why Postgres via Dokploy.** Rallly requires Postgres (no SQLite option). Dokploy creates and manages it next to the app on the same internal network, unexposed.

**Direct image instead of Rallly's official installer.** The official self-host route is a CLI installer that brings its own Traefik and object storage. On a Dokploy server you already have Traefik and certificates; running the plain image keeps one routing layer. Trade-off: no avatar/image uploads (those need S3-compatible storage) — irrelevant for date polls. If you ever want them, add any S3-compatible bucket via the `S3_*` env vars.

## Step-by-step

Assumes a server bootstrapped with [dokploy-bootstrap](dokploy-bootstrap.md) and a DNS record for e.g. `dates.example.com` pointing at it.

### 1. Create the Postgres database

1. In Dokploy, create a project (e.g. `tools`), then add a **Database** service, type **Postgres**.
2. Name it `rallly-db`, database name `rallly`, user `rallly`, and generate a strong password (no `@`, `:` or `/` characters — they'd need URL-encoding in the connection string).
3. Use the default Postgres major version offered (anything modern works; the official Rallly stack bundles Postgres 14) and deploy it. Do **not** add a public port — the app reaches it over the internal Docker network.
4. Note the internal connection hostname Dokploy shows for the database service.

### 2. Create the Rallly application

1. In the same project, add an **Application** service named `rallly`.
2. Provider: **Docker**, image `lukevella/rallly:4`. The `:4` tag pins the major version and picks up 4.x updates on redeploy.

### 3. Set environment variables

Don't hand-assemble these — the `inputs` in this pattern's frontmatter are the
typed parameters, and the script below generates the env block from them so the
naming traps (`SMTP_PWD` not `SMTP_PASSWORD`, the 32-char `SECRET_PASSWORD`
minimum) can't be fat-fingered. Fill the inputs, then run:

```bash
#!/usr/bin/env bash
# make-env.sh — generate rallly.env from this pattern's inputs.
# Required inputs must be exported first; generated ones are filled if unset.
set -euo pipefail
: "${DOMAIN:?} ${SUPPORT_EMAIL:?} ${SMTP_HOST:?} ${SMTP_USER:?} ${SMTP_PWD:?} ${DB_HOST:?} ${DB_PASSWORD:?}"
SECRET_PASSWORD="${SECRET_PASSWORD:-$(openssl rand -hex 32)}"   # idempotent: reuse if already set
SMTP_PORT="${SMTP_PORT:-587}"

cat > rallly.env <<EOF
NEXT_PUBLIC_BASE_URL=https://${DOMAIN}
SECRET_PASSWORD=${SECRET_PASSWORD}
DATABASE_URL=postgres://rallly:${DB_PASSWORD}@${DB_HOST}:5432/rallly
SUPPORT_EMAIL=${SUPPORT_EMAIL}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PWD=${SMTP_PWD}
SMTP_SECURE=$([ "${SMTP_PORT}" = "465" ] && echo true || echo false)
ALLOWED_EMAILS=${SUPPORT_EMAIL}
INITIAL_ADMIN_EMAIL=${SUPPORT_EMAIL}
EOF
echo "wrote rallly.env (SECRET_PASSWORD is ${#SECRET_PASSWORD} chars)"
```

Paste the contents of `rallly.env` into the service's Environment tab and deploy.
Several pattern gotchas are now enforced by the script instead of merely
documented: `SMTP_SECURE` is derived from the port, `ALLOWED_EMAILS` /
`INITIAL_ADMIN_EMAIL` are locked to you, and `SECRET_PASSWORD` is always long
enough.

Notes:

- `NEXT_PUBLIC_BASE_URL` must be the exact public URL, scheme included. The container derives `AUTH_URL` from it; any mismatch (http vs https, www vs bare) breaks login callbacks with misleading errors.
- The docs recommend a transactional email provider (Resend, Postmark, Mailgun, Brevo) over Gmail or a self-run mail server — magic-link mail that lands in spam means you can't log in.
- `ALLOWED_EMAILS` supports wildcards (`*@example.com`) if you later want to allow your whole domain.

### 4. Add the domain and deploy

1. In the service's Domains tab: add `dates.example.com`, container port `3000`, HTTPS with Let's Encrypt.
2. Deploy. Database migrations run automatically on container start (`prisma migrate deploy`), so first boot takes a moment longer.

### 5. Log in and claim admin

1. Open `https://dates.example.com`, sign in with your email — you'll get a verification code/magic link (this is the SMTP test, too).
2. Visit `https://dates.example.com/control-panel` — the user matching `INITIAL_ADMIN_EMAIL` can claim the admin role there.

### 6. Create a first poll and share it

1. Create a poll with a few candidate dates.
2. Open the participant link in a private browser window: you should be able to vote **without logging in**. That's the experience your friends get.

### 7. Configure backups

The only state is in Postgres:

1. In Dokploy, open the `rallly-db` service → **Backups**.
2. Schedule a daily backup to the S3 destination configured during [dokploy-bootstrap](dokploy-bootstrap.md), and run the test backup once.

## Verification

The `assertions` in the frontmatter are the source of truth; this section is
their runnable form. The scriptable ones exit non-zero on failure, so an agent
can run them and report exactly which check failed instead of asking you to eyeball a list:

```bash
#!/usr/bin/env bash
# verify.sh — DOMAIN must be exported.
set -euo pipefail
: "${DOMAIN:?}"
curl -fsS --max-time 10 "https://$DOMAIN" >/dev/null        && echo "✓ site-reachable"
curl -fsS --max-time 10 "https://$DOMAIN" | grep -qi rallly && echo "✓ serving-rallly"
! nc -z -w3 "$DOMAIN" 5432                                  && echo "✓ db-not-exposed"
echo "All scriptable assertions passed."
```

The remaining assertions are `manual: true` because they need a human or a real
mailbox — do these by hand:

- **login-email-delivers** — trigger a login; the magic-link/code email should arrive within a minute (check spam the first time). This is also your SMTP smoke test.
- **guest-can-vote** — open a poll's participant link in a private window and vote without logging in. That's the experience your friends get.
- **registration-locked** — a second registration with a different email is refused (confirms `ALLOWED_EMAILS`). `/control-panel` should also show you as admin.
- **backup-test-passes** — the Dokploy backup test for `rallly-db` succeeds.

## Gotchas

- **`NEXT_PUBLIC_BASE_URL` exact-match.** The most common Rallly self-host failure. It must be the fully qualified public URL with `https://`. The auth layer verifies request origins against it; a mismatch produces login failures that look like SMTP problems.
- **`SECRET_PASSWORD` length.** Validated at startup: fewer than 32 characters and the container exits during env validation. `openssl rand -hex 32` gives you 64, done.
- **`SUPPORT_EMAIL` is required.** Despite the name suggesting it's optional, env validation fails without it.
- **SMTP naming trap.** `SMTP_PWD` (and `SMTP_USER`), not `SMTP_PASSWORD`/`SMTP_USERNAME`. A wrong name fails silently — mail just never sends.
- **No SMTP, no login.** Rallly's email auth is passwordless. Without working SMTP you can't register or sign in (guests can still vote on existing polls). The kickoff assumption "optional but recommended" was true of older versions; v4 docs list an SMTP server as a hard requirement.
- **Update phone-home.** The self-hosted image ships with `API_BASE_URL=https://api.rallly.co` set, used for update checks (and license activation if you buy one). If you want zero outbound calls, override `API_BASE_URL` to an empty value — knowing that breaks update notifications and license activation.
- **Licensing honor system.** Registered-user limits are reminder-based, not enforced by breakage — but the deal is clear: more than one registered member in a workspace is a paid feature. Guests never count.

## Maintenance notes

- **Updates**: redeploy in Dokploy to pick up the latest 4.x image. Migrations run automatically. Check the [releases page](https://github.com/lukevella/rallly/releases) occasionally; a future `:5` major will need a deliberate tag bump and release-note read.
- **Backups**: Postgres dump daily via Dokploy; restore drill once via Dokploy's restore flow. Poll data is low-stakes compared to [vaultwarden-family](vaultwarden-family.md), but losing scheduled events the day before a family gathering is exactly as annoying as it sounds.
- **What breaks over time**: SMTP credentials rotate or providers tighten policy → logins quietly stop working while polls keep serving. If you can't log in some month, test SMTP first.
- **Low maintenance otherwise**: no object storage, one container, one database. This is a good first app to deploy after bootstrap precisely because its failure modes are simple.
