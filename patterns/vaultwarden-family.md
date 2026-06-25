---
id: vaultwarden-family
title: "Move your family off 1Password to self-hosted Vaultwarden"
version: 2
status: experimental
category: security
tags: [passwords, family, bitwarden, vaultwarden, password-manager]
maintainer: hiddevh

problem: >
  You pay for a family password manager subscription (1Password, Bitwarden
  Premium, Dashlane) and want to self-host instead: full control over the
  vault data, no recurring cost, while keeping the things that make a managed
  service livable — browser extensions, mobile autofill, sharing passwords
  with family members, and emergency access.

recommendation:
  app: vaultwarden
  app_source: https://github.com/dani-garcia/vaultwarden
  deploy_target: dokploy
  exposure: public-domain

alternatives:
  - name: Bitwarden (official server)
    reason_not_chosen: "Resource-heavy multi-container deployment designed for enterprises; paid license needed for the family features Vaultwarden ships for free"
  - name: KeePassXC + Syncthing
    reason_not_chosen: "No server-side sharing model: family password sharing and emergency access become manual file-sync rituals, and there is no web vault"
  - name: Passbolt
    reason_not_chosen: "Team/business focus; personal-vault and mobile autofill experience is weaker than the Bitwarden client ecosystem"

prerequisites:
  - dokploy-installed
  - public-domain-configured
  - smtp-credentials-available

estimated_time_minutes: 60

tested_against:
  app_version: "1.36.0"
  verified: "2026-06-22"
  upstream_docs: https://github.com/dani-garcia/vaultwarden/wiki

inputs:
  - name: DOMAIN
    description: "Public hostname for the vault (the DOMAIN env var prepends https://)"
    example: vault.example.com
    format: hostname
    required: true
  - name: SMTP_HOST
    description: "SMTP host — invites, verification, and emergency-access mail go through it"
    example: smtp.example.com
    required: true
  - name: SMTP_PORT
    description: "SMTP port"
    default: "587"
    format: integer
    required: false
  - name: SMTP_FROM
    description: "From address for Vaultwarden mail"
    example: vault@example.com
    format: email
    required: true
  - name: SMTP_USERNAME
    description: "SMTP username"
    required: true
  - name: SMTP_PASSWORD
    description: "SMTP password"
    secret: true
    required: true
  - name: ADMIN_PASSWORD
    description: "Plaintext admin password you'll type into /admin; hashed into ADMIN_TOKEN below"
    generate: "openssl rand -base64 32"
    secret: true
    required: true

assertions:
  - id: site-https
    description: "https://${DOMAIN} responds (the web vault needs a secure context)"
    check: "curl -fsS --max-time 10 https://${DOMAIN} >/dev/null"
  - id: serving-vaultwarden
    description: "It is Vaultwarden — the /alive health endpoint returns a timestamp"
    check: "curl -fsS --max-time 10 https://${DOMAIN}/alive | grep -q ."
  - id: clients-sync
    description: "An item created on one client appears on another within seconds (WebSocket sync)"
    manual: true
  - id: member-isolation
    description: "A second family member sees shared collections but not your personal vault"
    manual: true
  - id: signups-locked
    description: "With SIGNUPS_ALLOWED=false deployed, the registration page refuses new sign-ups"
    manual: true
  - id: admin-accepts-token
    description: "https://${DOMAIN}/admin accepts the admin password generated in step 1"
    manual: true
  - id: backup-restores
    description: "The backup archive extracts on another machine and db.sqlite3 opens"
    manual: true

gotchas:
  - "Vaultwarden only works over HTTPS — the web vault uses Web Crypto APIs that browsers restrict to secure contexts"
  - "DOMAIN must be the full public URL including https://, or invite links and some clients break"
  - "Store ADMIN_TOKEN as an Argon2 hash, and escape every $ as $$ if you paste the hash into a compose file"
  - "Never back up db.sqlite3 with a plain file copy while the container runs — use sqlite3 .backup or the built-in vaultwarden backup command"
  - "Disable public signups (SIGNUPS_ALLOWED=false) after creating your own account; invite family members instead"

related: [dokploy-bootstrap, scheduling-tool]
---

# Move your family off 1Password to self-hosted Vaultwarden

## Context

Use this pattern when you want a self-hosted password manager for a household: a handful of users, shared credentials (streaming, utilities, the kids' school portal), and a plan for what happens if the person running the server is unavailable. Vaultwarden is a lightweight Rust reimplementation of the Bitwarden server API — you self-host the server, and everyone uses the official Bitwarden apps and browser extensions against it. Features that are paid in Bitwarden (organizations, emergency access) are included for free.

This is a pattern where operational discipline matters more than the install. A password manager is the one service where losing data or serving a broken TLS setup actually hurts. Take the backup section seriously before you move real credentials in.

## Decisions explained

**Why Vaultwarden over the official Bitwarden server.** The official server is a multi-container .NET deployment aimed at enterprises and wants far more RAM, plus a paid license for the family features. Vaultwarden implements nearly the complete Bitwarden client API in a single small container with SQLite, is actively maintained, and explicitly targets "individuals, families, and small organizations". Every official Bitwarden client works with it.

**Why a public domain instead of Tailscale-only.** Browser extensions and mobile autofill need to reach the server from every device your family uses, including devices you don't control (work laptops, in-laws' phones). Requiring Tailscale on every family device is a non-starter. Vaultwarden's security model assumes a hostile network anyway: the vault is end-to-end encrypted, the server only stores ciphertext. Expose it publicly over HTTPS, disable signups, and keep the admin panel locked down.

**Why SQLite.** It is the most widely used and tested backend, recommended by the project for most users, and makes backups a single-file affair. A family will never hit its limits.

**Why Dokploy.** Consistent with the rest of Thuishaven: Traefik routing and Let's Encrypt certificates come from the [dokploy-bootstrap](dokploy-bootstrap.md) pattern; this pattern only adds a service.

## Step-by-step

Assumes a server bootstrapped with [dokploy-bootstrap](dokploy-bootstrap.md) and a DNS record for your chosen hostname (e.g. `vault.example.com`) pointing at the server.

### 1. Generate the admin token

The admin panel (`/admin`) is enabled by setting `ADMIN_TOKEN`. Store it as an Argon2 hash, not plaintext. On any machine with Docker:

```bash
docker run --rm -it vaultwarden/server:1.36.0 /vaultwarden hash
```

Enter a long random password (generate one with `openssl rand -base64 32` and save it somewhere safe — this is what you'll type into `/admin`). The command prints an `ADMIN_TOKEN='$argon2id$...'` line. Keep the hash for step 3.

### 2. Create the service in Dokploy

1. In the Dokploy UI, create a project (e.g. `family`), then add an **Application** type service named `vaultwarden`.
2. Set the provider to **Docker** with image `vaultwarden/server:1.36.0`. Pin the version; don't use `latest` for a password manager — you want to read release notes before upgrading.
3. Add a persistent volume mounting to `/data` inside the container (e.g. a volume named `vaultwarden-data`). Everything Vaultwarden stores — SQLite database, attachments, RSA keys, admin config — lives in `/data`.

### 3. Set environment variables

In the service's Environment tab:

```bash
DOMAIN=https://vault.example.com
ADMIN_TOKEN='$argon2id$v=19$m=65540,t=3,p=4$...'   # the hash from step 1
SIGNUPS_ALLOWED=true            # temporarily — turned off in step 6
SMTP_HOST=smtp.example.com
SMTP_FROM=vault@example.com
SMTP_PORT=587
SMTP_SECURITY=starttls
SMTP_USERNAME=vault@example.com
SMTP_PASSWORD=your-smtp-password
```

Notes:

- `DOMAIN` must be the **exact** public URL including `https://`.
- If you ever move these into a compose file instead of the env tab, escape every `$` in the Argon2 hash as `$$`.
- SMTP is effectively required for a family setup: organization invites, email verification, and emergency access notifications all go through email. Any transactional mail provider or your own mailbox's SMTP credentials work.

### 4. Expose it via your domain

In the service's Domains tab, add `vault.example.com` with HTTPS enabled (Let's Encrypt) and container port `80` — the Vaultwarden container listens on 80 internally. Deploy the service.

WebSocket notifications (live sync between clients) run over the same port; Traefik forwards the upgrade headers automatically, no extra configuration needed.

### 5. Create your account and the family organization

1. Open `https://vault.example.com`, create **your own** account. Use a strong master password — it cannot be recovered, only reset by deleting the account.
2. In the web vault: **New organization** (e.g. "Family"). Create collections for shared credential groups, e.g. `Shared — Household`, `Shared — Streaming`, `Shared — Kids`.
3. Invite family members from **Organization → Members**. Invites arrive by email (this is why SMTP matters) and expire after 5 days. Each member creates their own account with their own master password; you confirm them after they accept.
4. Move shared credentials into collections; per-member access is controlled per collection.

### 6. Lock down signups

Once everyone has an account, set in the Environment tab:

```bash
SIGNUPS_ALLOWED=false
```

and redeploy. Organization invites keep working (`INVITATIONS_ALLOWED` defaults to `true`), so you can still add people later — but strangers who find your instance can no longer register.

Note: settings previously saved through the `/admin` panel persist in `/data/config.json` and **override** environment variables. If a setting doesn't seem to take effect, check the admin panel.

### 7. Set up emergency access

Vaultwarden supports Bitwarden's Emergency Access (enabled by default). For each adult:

1. Web vault → **Settings → Emergency access** → **Add emergency contact**.
2. Grant your partner (or another trusted person) **Takeover** or **View** access with a waiting period (e.g. 7 days).
3. The contact accepts the invite; you confirm them.

This answers "what if the server admin is hit by a bus": the vault can be recovered by family without anyone knowing your master password. Test the request flow once so both sides know what it looks like.

### 8. Configure clients

On every device, install the official Bitwarden app or browser extension. **Before logging in**: on the login screen, open the server/region selector ("Logging in on"), choose **Self-hosted**, and enter `https://vault.example.com` as the Server URL. Then log in normally. CLI: `bw config server https://vault.example.com`.

### 9. Migrate from 1Password

1. Export from 1Password (per vault, `.1pux` or CSV).
2. In the Vaultwarden web vault: **Tools → Import data**, select the matching 1Password format, import into your personal vault (or directly into an organization collection for shared items).
3. Spot-check entries with TOTP seeds, custom fields, and attachments — these are the usual casualties of export formats. Attachments don't survive any export; re-upload them manually.
4. Have each family member do the same with their own export.
5. Only after a week or two of real use: delete the 1Password data and cancel the subscription.

### 10. Automate backups

Back up the SQLite database with SQLite's online backup (never a plain `cp` of a live database), plus the attachments and keys. Vaultwarden ships a built-in backup command. On the server, create `/usr/local/bin/vaultwarden-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR=/var/backups/vaultwarden
CONTAINER=$(docker ps --filter ancestor=vaultwarden/server:1.36.0 --format '{{.Names}}' | head -n1)
mkdir -p "$BACKUP_DIR"
# Writes a consistent db backup inside /data, then copy the whole data dir out
docker exec "$CONTAINER" /vaultwarden backup
docker cp "$CONTAINER":/data "$BACKUP_DIR/data-$(date +%F)"
tar -czf "$BACKUP_DIR/vaultwarden-$(date +%F).tar.gz" -C "$BACKUP_DIR" "data-$(date +%F)"
rm -rf "$BACKUP_DIR/data-$(date +%F)"
# Keep 14 days
find "$BACKUP_DIR" -name 'vaultwarden-*.tar.gz' -mtime +14 -delete
```

```bash
chmod +x /usr/local/bin/vaultwarden-backup.sh
(crontab -l 2>/dev/null; echo "30 3 * * * /usr/local/bin/vaultwarden-backup.sh") | crontab -
```

Then get the archives **off the server** — sync `/var/backups/vaultwarden` to external storage (rclone to any S3/Backblaze/Drive target, or a restic repository). A backup on the same disk as the database is not a backup. The archive contains your encrypted vault plus `config.json` (which holds the admin token hash) — treat it as sensitive even though vault items are ciphertext.

## Agent-executable deploy (Dokploy API)

Steps 2–4 are written as Dokploy UI clicks for a human; an agent should drive the
create/configure/deploy over the Dokploy API instead. Assumes `DOKPLOY_API_TOKEN`
and `DOKPLOY_URL` from [dokploy-bootstrap](dokploy-bootstrap.md) step 9. The
sequence is stable; confirm exact endpoint and field names against
`$DOKPLOY_URL/api/swagger` (versioned — tested against Dokploy 0.29.8).

```
auth header:  x-api-key: $DOKPLOY_API_TOKEN     base: $DOKPLOY_URL/api

1. project.create                  { name: "family" }                      -> projectId
2. application.create              { projectId, name: "vaultwarden" }       -> applicationId
3. application.saveDockerProvider  { applicationId,
                                     dockerImage: "vaultwarden/server:1.36.0" }
4. mounts.create                   { serviceId: applicationId, type: "volume",
                                     mountPath: "/data", ... }    # persists /data
5. application.saveEnvironment     { applicationId, env: <the env block from step 3> }
                                   # remember DOMAIN=https://${DOMAIN}, ADMIN_TOKEN
                                   # is the argon2 hash from step 1
6. domain.create                   { applicationId, host: $DOMAIN,
                                     port: 80, https: true,
                                     certificateType: "letsencrypt" }
7. application.deploy              { applicationId }
```

Steps 1 (generate admin token), 5–9 (web-vault account/org/clients/migration) stay
human — they're inherently GUI/client actions. As with the database in
[scheduling-tool](scheduling-tool.md), Dokploy gives the application a random
container name; resolve `applicationId → appName` via `application.one` to find its
logs.

## Verification

The `assertions` in the frontmatter are the source of truth. The two scriptable
ones exit non-zero on failure:

```bash
#!/usr/bin/env bash
# verify.sh — DOMAIN must be exported (hostname, no scheme).
set -euo pipefail
: "${DOMAIN:?}"
curl -fsS --max-time 10 "https://$DOMAIN" >/dev/null         && echo "✓ site-https"
curl -fsS --max-time 10 "https://$DOMAIN/alive" | grep -q .  && echo "✓ serving-vaultwarden"
echo "All scriptable assertions passed."
```

A password manager's important checks are inherently `manual: true` — they need
real clients and a real second person. Do these by hand:

- **clients-sync** — create an item on your phone; it appears in the browser extension within seconds (confirms WebSocket sync). Autofill works from a browser extension and mobile app pointed at your server URL.
- **member-isolation** — a second family member logs in and sees shared collections but not your personal vault.
- **signups-locked** — with `SIGNUPS_ALLOWED=false` deployed, the registration page refuses new sign-ups.
- **admin-accepts-token** — `https://${DOMAIN}/admin` asks for the admin password and accepts the one generated in step 1.
- **backup-restores** — run the backup script, extract the archive on another machine, and verify the database opens: `sqlite3 db.sqlite3 'select count(*) from users;'`. An untested backup is a hypothesis.

## Gotchas

- **HTTPS is mandatory, not a nicety.** The web vault uses Web Crypto APIs that browsers only expose in secure contexts. Plain HTTP gives you a broken login page, not a degraded experience.
- **`DOMAIN` mismatch breaks invites.** Invite links and several client flows are built from `DOMAIN`. It must match the public URL exactly, scheme included.
- **`$` escaping in the Argon2 hash.** The PHC hash is full of `$` characters. In Dokploy's env tab a single-quoted value is fine, but in a docker-compose file each `$` must be doubled (`$$`) or compose will try variable interpolation and the token silently won't match.
- **`config.json` overrides environment variables.** Anything ever saved via the admin panel persists in `/data/config.json` and wins over env vars after restarts. If an env change seems ignored, that's why.
- **Live-copying SQLite corrupts backups.** A `cp` of `db.sqlite3` while the server runs can produce a silently corrupt copy. Always go through `/vaultwarden backup` (built in since 1.32.1) or `sqlite3 ... ".backup ..."`. When restoring, delete any `db.sqlite3-wal` file alongside the restored database first.
- **Master passwords are unrecoverable.** No SMTP reset emails will save a forgotten master password. Emergency Access (step 7) is the designed recovery path — set it up before you need it.
- **Don't use the `latest` tag.** Read the release notes before upgrading a password manager. Vaultwarden releases occasionally include security fixes you want promptly, and rarely, behavior changes (e.g. 2FA remember tokens were invalidated in 1.35.5) you want to know about.

## Maintenance notes

- **Updates**: check [vaultwarden releases](https://github.com/dani-garcia/vaultwarden/releases) roughly monthly; security advisories are called out prominently. Update by bumping the image tag in Dokploy and redeploying (also update the tag in the backup script). Vaultwarden runs database migrations automatically on startup.
- **Backups**: verify quarterly that you can actually restore — extract the newest archive and open the database. An untested backup is a hypothesis.
- **Admin panel**: you rarely need it after setup. For extra hardening, remove `ADMIN_TOKEN` (and the `admin_token` key in `config.json`) to disable `/admin` entirely, or block the `/admin` path at the proxy, and re-enable when needed.
- **Certificate renewal** is automatic via Traefik/Let's Encrypt; if clients suddenly refuse to connect, an expired certificate is the first thing to check.
- **Watch disk space**: attachments and icon cache live in `/data` and grow slowly; the database itself stays small.
