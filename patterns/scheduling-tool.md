---
id: scheduling-tool
title: "Date picker for sharing with friends"
version: 2
status: stable
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
  verified: "2026-06-24"
  upstream_docs: https://support.rallly.co/self-hosting

inputs:
  - name: DOMAIN
    description: "Public domain the poll site is served from"
    example: dates.example.com
    format: hostname
    required: true
  - name: SUPPORT_EMAIL
    description: "Your email — admin, login address, and the only address allowed to register"
    example: you@example.com
    format: email
    required: true
  - name: NOREPLY_EMAIL
    description: "From address for outgoing login emails — MUST be on a domain your SMTP provider has verified. Defaults to SUPPORT_EMAIL."
    example: noreply@example.com
    format: email
    required: false
  - name: SMTP_HOST
    description: "SMTP host for the passwordless login emails"
    example: smtp.resend.com
    required: true
  - name: SMTP_PORT
    description: "SMTP submission port. Prefer 587 (STARTTLS). 465/25 are blocked outbound on many VPS providers including Hetzner — use 587 or your ESP's alternate submission port (e.g. Resend's 2587)."
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
    description: "Internal hostname from the Postgres service's Internal Connection field. NOT just 'rallly-db' — Dokploy appends a generated suffix."
    example: rallly-db-pmqqwz
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
  - id: registration-email-delivers
    description: "REGISTERING (not logging in) on the fresh instance produces a code/magic-link email within a minute. On a zero-user instance, Login for an unknown email sends nothing."
    manual: true
  - id: esp-shows-delivered
    description: "Before suspecting the app: the ESP/provider dashboard shows the message as Delivered. If Delivered but unseen, it's inbox placement (spam/forwarding), not a bug."
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
  - "On a fresh instance you must REGISTER first; Login for an unknown email silently sends nothing — the most common 'email never arrives' false alarm"
  - "Sender domain must be verified with your SMTP provider; if SUPPORT_EMAIL is on a different domain, set NOREPLY_EMAIL to a verified-domain address or sends are rejected silently"
  - "DB_HOST is the Internal Connection host with Dokploy's generated suffix (e.g. rallly-db-pmqqwz), not the bare service name — a wrong host makes the app fail to reach Postgres on first boot"
  - "Outbound SMTP 465/25 is blocked on many VPS providers (incl. Hetzner) — use 587, or your ESP's alternate port; port 465 just hangs"
  - "If the app domain is CDN-proxied, the Let's Encrypt HTTP-01 challenge can fail — set DNS-only for first issuance, then re-proxy with SSL mode Full (strict)"

related: [dokploy-bootstrap, vaultwarden-family]
---

# Date picker for sharing with friends

## Context

Use this pattern when you want a Doodle replacement: you create a poll with candidate dates, send one link, and friends or family pick what works for them — no accounts, no ads, no SaaS. Rallly is a polished Next.js app that does precisely this. You (the poll creator) get the one registered account; participants just click the link and vote.

Written against Rallly v4.10 and validated end-to-end by the maintainer on a fresh Hetzner VPS (Dokploy + Resend, June 2026) via the Dokploy UI path; the deviations from that run are folded in below, which is why this pattern is `stable`. (The newer agent-driven Dokploy-API deploy recipe is documented but not yet proven end-to-end — see issue #2.)

## Decisions explained

**Why Rallly.** Actively maintained, modern UX that non-technical participants don't trip over, official Docker distribution, and guest voting with no account requirement — which is the core of the use case. The alternatives are either unmaintained (dudle), dated (Framadate), or have no official self-host path (when2meet).

**One honest caveat — licensing.** Rallly is AGPL and free for personal use, but since v4 the *multi-user* features ("Spaces": inviting other registered members into your workspace) require a paid license. That does not affect this pattern: scheduling with friends needs exactly one registered user (you) and unlimited anonymous guest voters, which is free. If you wanted several family members to each manage their own polls on one instance, you'd need a license (Plus, up to 5 users) — or each runs their own instance.

**Why a public domain.** The entire point is sending a link to people who don't have Tailscale and never will. The poll links are unguessable IDs; the only account that exists is yours, and registration gets locked to your email address below.

**Why Postgres via Dokploy.** Rallly requires Postgres (no SQLite option). Dokploy creates and manages it next to the app on the same internal network, unexposed.

**Direct image instead of Rallly's official installer.** The official self-host route is a CLI installer that brings its own Traefik and object storage. On a Dokploy server you already have Traefik and certificates; running the plain image keeps one routing layer. Trade-off: no avatar/image uploads (those need S3-compatible storage) — irrelevant for date polls. If you ever want them, add any S3-compatible bucket via the `S3_*` env vars.

## Step-by-step

Assumes a server bootstrapped with [dokploy-bootstrap](dokploy-bootstrap.md) and a DNS record for e.g. `dates.example.com` pointing at it.

This pattern is **API-first**: the deploy is driven over the Dokploy HTTP API so an agent can run it end-to-end without a human in the UI. It uses `DOKPLOY_API_TOKEN` and `DOKPLOY_URL` from [dokploy-bootstrap](dokploy-bootstrap.md) step 9 (reach the API over the tailnet). A condensed click-through fallback for humans is at the end. The call **sequence** is stable; confirm exact endpoint names and request-body fields against your install's live schema at `$DOKPLOY_URL/api/swagger` (versioned — written against Dokploy 0.29.8; the API path itself is pending a clean end-to-end run, see issue #2).

### 1. Create the project and Postgres

```
auth header:  x-api-key: $DOKPLOY_API_TOKEN     base: $DOKPLOY_URL/api

project.create   { name: "tools" }                                  -> projectId
postgres.create  { projectId, name: "rallly-db", databaseName: "rallly",
                   databaseUser: "rallly", databasePassword: $DB_PASSWORD }  -> postgresId
postgres.deploy  { postgresId }
postgres.one     { postgresId }   # read back DB_HOST = generated appName
```

`DB_HOST` is the service's **generated appName** (e.g. `rallly-db-pmqqwz`), **not** `rallly-db` — Dokploy appends a random suffix. Read it back from `postgres.one` and export it for the next step. Use the default Postgres major version (18 at time of writing; migrations run clean). Never give the database a public port.

### 2. Generate the environment

The `inputs` in this pattern's frontmatter are the typed parameters; this script
turns them into the env block so the naming traps (`SMTP_PWD` not
`SMTP_PASSWORD`, the 32-char `SECRET_PASSWORD` minimum) can't be fat-fingered.
Export the inputs (including the `DB_HOST` from step 1), then run:

```bash
#!/usr/bin/env bash
# make-env.sh — generate rallly.env from this pattern's inputs.
# Required inputs must be exported first; generated ones are filled if unset.
set -euo pipefail
: "${DOMAIN:?} ${SUPPORT_EMAIL:?} ${SMTP_HOST:?} ${SMTP_USER:?} ${SMTP_PWD:?} ${DB_HOST:?} ${DB_PASSWORD:?}"
SECRET_PASSWORD="${SECRET_PASSWORD:-$(openssl rand -hex 32)}"   # idempotent: reuse if already set
SMTP_PORT="${SMTP_PORT:-587}"
NOREPLY_EMAIL="${NOREPLY_EMAIL:-$SUPPORT_EMAIL}"               # MUST be on a provider-verified domain

cat > rallly.env <<EOF
NEXT_PUBLIC_BASE_URL=https://${DOMAIN}
SECRET_PASSWORD=${SECRET_PASSWORD}
DATABASE_URL=postgres://rallly:${DB_PASSWORD}@${DB_HOST}:5432/rallly
SUPPORT_EMAIL=${SUPPORT_EMAIL}
NOREPLY_EMAIL=${NOREPLY_EMAIL}
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

The script enforces several gotchas instead of merely documenting them:
`SMTP_SECURE` is derived from the port, `ALLOWED_EMAILS` / `INITIAL_ADMIN_EMAIL`
are locked to you, and `SECRET_PASSWORD` is always long enough.

Notes:

- `NEXT_PUBLIC_BASE_URL` must be the exact public URL, scheme included. The container derives `AUTH_URL` from it; any mismatch (http vs https, www vs bare) breaks login callbacks with misleading errors.
- The docs recommend a transactional email provider (Resend, Postmark, Mailgun, Brevo) over Gmail or a self-run mail server — magic-link mail that lands in spam means you can't log in.
- **Sender domain must be verified.** Transactional providers only send *from* a domain you've verified with them. If your login address (`SUPPORT_EMAIL`) is on a different domain than the verified one, set `NOREPLY_EMAIL` to an address on the verified domain — otherwise the provider rejects the send and login mail never arrives, a silent failure that looks like a Rallly bug.
- `ALLOWED_EMAILS` supports wildcards (`*@example.com`) if you later want to allow your whole domain.

### 3. Create, configure, and deploy the app

```
application.create              { projectId, name: "rallly" }            -> applicationId
application.saveDockerProvider  { applicationId, dockerImage: "lukevella/rallly:4" }
application.saveEnvironment     { applicationId, env: <contents of rallly.env> }
domain.create                  { applicationId, host: $DOMAIN, port: 3000,
                                 https: true, certificateType: "letsencrypt" }
application.deploy             { applicationId }
```

- The image tag `lukevella/rallly:4` pins the major version and picks up 4.x updates on redeploy. Database migrations (`prisma migrate deploy`) run automatically on first boot, so it takes a moment longer.
- Dokploy gives the **application** a fully random container name (e.g. `app-input-haptic-bandwidth-rux8uo`), unlike the database. To find its container/logs later, resolve `applicationId → appName` via `application.one` — don't `grep` for "rallly".
- **CDN-proxied DNS:** if `$DOMAIN` is proxied through a CDN (Cloudflare orange-cloud), set it **DNS-only** during first certificate issuance (HTTP-01 can fail through the proxy), then re-enable the proxy with SSL mode **Full (strict)**, never Flexible. See [dokploy-bootstrap](dokploy-bootstrap.md) step 6.
- After deploy, run the `verify.sh` from [Verification](#verification) against `$DOMAIN`.

### 4. Register and claim admin

1. Open `https://dates.example.com` and **Register / create your account** — this triggers the first verification email (and is your SMTP smoke test). On a zero-user instance, **Login** for an unknown email is a silent no-op: only Register sends mail. If the email doesn't arrive, work the [email debug recipe](#when-the-login-email-doesnt-arrive) below before suspecting the deploy.
2. Visit `https://dates.example.com/control-panel` — the user matching `INITIAL_ADMIN_EMAIL` can claim the admin role there. Login (not Register) is for return visits once your account exists.

### 5. Create a first poll and share it

1. Create a poll with a few candidate dates.
2. Open the participant link in a private browser window: you should be able to vote **without logging in**. That's the experience your friends get.

### 6. Configure backups

The only state is in Postgres:

1. In Dokploy, open the `rallly-db` service → **Backups**.
2. Schedule a daily backup to the S3 destination configured during [dokploy-bootstrap](dokploy-bootstrap.md), and run the test backup once.

### Manual UI fallback

No API token, or prefer clicking? The same deploy in the Dokploy UI, condensed:

1. **Project + Postgres** — create a project (e.g. `tools`), add a **Postgres** database (`rallly-db`, db `rallly`, user `rallly`, your `DB_PASSWORD`), deploy it with no public port. Copy the **Internal Connection** host — that suffixed value is your `DB_HOST`.
2. **Env** — run `make-env.sh` (step 2) and paste `rallly.env` into the application's **Environment** tab.
3. **App** — add an **Application** `rallly`, provider **Docker**, image `lukevella/rallly:4`.
4. **Domain** — in the **Domains** tab add your domain, container port `3000`, HTTPS via Let's Encrypt; deploy. (Mind the CDN-proxied DNS note above.)

This is the path validated end-to-end on Hetzner; the API path above is the agent default and is pending its own clean run (#2).

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

- **registration-email-delivers** — **Register** (not log in) and confirm the code/magic-link email arrives within a minute. This is your SMTP smoke test. On a fresh instance, Login for an unknown email sends nothing.
- **esp-shows-delivered** — before suspecting the app, confirm the ESP/provider dashboard shows the message as *Delivered*. Delivered-but-unseen is inbox placement (spam/forwarding), not a bug.
- **guest-can-vote** — open a poll's participant link in a private window and vote without logging in. That's the experience your friends get.
- **registration-locked** — a second registration with a different email is refused (confirms `ALLOWED_EMAILS`). `/control-panel` should also show you as admin.
- **backup-test-passes** — the Dokploy backup test for `rallly-db` succeeds.

## Deliverability

The prerequisite `smtp-credentials-available` gets mail *sent*; it doesn't get it
*seen*. A brand-new sending domain, or a code arriving via a forward, gets junked
by default. Before going live:

- **DKIM** — ensure your ESP/sending domain has DKIM signing enabled. DKIM is the
  only authentication that survives a forward (SPF alignment breaks when mail is
  forwarded).
- **DMARC** — add a monitor-only record; without one, strict receivers (iCloud,
  Gmail) junk a new domain's mail:
  ```
  _dmarc.<domain>  TXT  "v=DMARC1; p=none; rua=mailto:you@<domain>"
  ```
- **Forwarding is the #1 cause of "missing" codes.** If your login address
  forwards (e.g. `you@yourdomain → …@icloud.com`), check the spam folder of the
  *final* mailbox, not the address you typed.

## When the login email doesn't arrive

~90% of the friction in real deployments is "the code email never arrives," and
it's almost never the app, SMTP, or the deploy. Work this decision tree — steps
1–2 usually resolve it in minutes:

```
1. Account exists?   psql> SELECT count(*) FROM users;
                     → 0 means you must REGISTER, not log in.
2. OTP generated?    psql> SELECT identifier, value, expires_at
                            FROM verifications ORDER BY created_at DESC;
                     → present = auth works. The code is RIGHT THERE — read it to
                       log in without email and unblock yourself immediately.
3. Did it leave?     tcpdump -n 'tcp port 587'  while triggering a send
                     → TCP+TLS to the ESP = the app really sent it.
4. ESP accepted it?  payload > a few KB + clean teardown (no RST) = DATA accepted.
                     Then check the ESP dashboard for Delivered.
5. Delivered but
   unseen?         → INBOX PLACEMENT. Follow forwards to the FINAL mailbox, check
                     spam, verify DKIM/DMARC. Not an app bug.
```

Trigger a send headlessly for testing (note the **required** `Origin` header —
better-auth checks trusted origins, else 401):

```bash
curl -fsS -X POST "https://${DOMAIN}/api/better-auth/email-otp/send-verification-otp" \
  -H "Origin: https://${DOMAIN}" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","type":"sign-in"}'
```

**Red herrings — do not chase these:**

- **`Failed to find Server Action "…"` in logs is unrelated.** Rallly v4 auth is
  better-auth API routes (`/api/better-auth/[...all]`), not Server Actions.
- **It is not the CDN.** The JS bundle is byte-identical via CDN vs origin; RSC
  isn't being mangled.
- **It is not cert validation.** `Certificate validation is now enabled by default
  for SMTP` is informational; Node uses its built-in roots even though the
  container ships no `ca-certificates.crt`. You do **not** need
  `SMTP_REJECT_UNAUTHORIZED=false`.
- **The from-address split is real** — see Deliverability and `NOREPLY_EMAIL`
  above; better-auth returns `success:true` even when the provider rejected the
  send, so a wrong sender domain fails silently.
- **A send-only ESP key can't confirm delivery via API.** A restricted/send-only
  Resend key returns `401 restricted_api_key` on `GET /emails` — check the
  dashboard instead of burning a step on the API.

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
