---
id: scheduling-tool
title: "Date picker for sharing with friends"
version: 1
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

```bash
NEXT_PUBLIC_BASE_URL=https://dates.example.com
SECRET_PASSWORD=<openssl rand -hex 32>          # session encryption; minimum 32 chars
DATABASE_URL=postgres://rallly:<db-password>@<internal-db-host>:5432/rallly
SUPPORT_EMAIL=you@example.com                   # required; shown to users and used as sender fallback

# SMTP — effectively required: login is passwordless via email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PWD=your-smtp-password                     # note: PWD, not PASSWORD
SMTP_SECURE=false                               # false for STARTTLS on 587; true for implicit TLS on 465

# Keep the instance yours: only this address can register
ALLOWED_EMAILS=you@example.com
INITIAL_ADMIN_EMAIL=you@example.com
```

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

1. `https://dates.example.com` loads with a valid certificate.
2. Magic-link/verification email arrives within a minute of a login attempt (check spam the first time).
3. `/control-panel` shows you as admin.
4. A poll created by you can be voted on from a private window and from a phone outside your network, without login.
5. A second registration attempt with a different email address is refused (confirms `ALLOWED_EMAILS`).
6. The database backup test in Dokploy succeeds.

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
