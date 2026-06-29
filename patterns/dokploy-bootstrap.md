---
id: dokploy-bootstrap
title: "Set up a fresh Ubuntu server for self-hosting"
version: 2
status: stable
category: bootstrap
tags: [dokploy, docker, traefik, tailscale, lets-encrypt, server-setup]
maintainer: hiddevh

problem: >
  You have (or just rented) an Ubuntu server and want a solid foundation for
  self-hosting: a deploy platform with a web UI, automatic HTTPS for apps you
  expose publicly, an admin interface that is NOT on the public internet, and
  backups — without hand-writing nginx configs and systemd units for every app.

recommendation:
  app: dokploy
  app_source: https://github.com/Dokploy/dokploy
  deploy_target: dokploy
  exposure: tailnet

alternatives:
  - name: Coolify
    reason_not_chosen: "Heavier control plane and more moving parts; great for GUI-first users, but Dokploy's Traefik-based setup is simpler to reason about and debug"
  - name: CapRover
    reason_not_chosen: "Aging project, nginx-based routing feels dated next to Traefik's automatic cert handling"
  - name: plain docker-compose + manual reverse proxy
    reason_not_chosen: "Perfectly fine, but you re-solve domains, certificates, deploy hooks, and backups for every single app"

prerequisites:
  - ubuntu-server-with-root-access
  - public-domain-registered
  - tailscale-account

estimated_time_minutes: 45

tested_against:
  app_version: "0.29.8"
  verified: "2026-06-24"
  upstream_docs: https://docs.dokploy.com/docs/core

inputs:
  - name: TAILSCALE_AUTHKEY
    description: "Pre-approved Tailscale auth key (tskey-auth-...) for non-interactive node join"
    example: tskey-auth-XXXXXXXX
    secret: true
    required: true
  - name: ADVERTISE_ADDR
    description: "Swarm advertise address; needed on VPSes with only a public IP"
    example: 203.0.113.10
    required: false
  - name: SERVER_IP
    description: "The server's public IPv4 address — used to confirm app DNS points at this box"
    example: 203.0.113.10
    required: true
  - name: APP_DOMAIN
    description: "Domain (or wildcard base) future apps are served under"
    example: apps.example.com
    format: hostname
    required: true
  - name: LETSENCRYPT_EMAIL
    description: "Contact email for the Traefik ACME account (cert expiry notices)"
    example: you@example.com
    format: email
    required: true
  - name: DOKPLOY_API_TOKEN
    description: "Dokploy API token (Settings → API/Profile) so an agent can create and deploy apps over HTTP instead of clicking the UI. Needed for the agent-driven deploy path in app patterns."
    secret: true
    required: false

assertions:
  - id: tailscale-connected
    description: "The server is up on the tailnet"
    check: "tailscale status >/dev/null"
  - id: dokploy-services-up
    description: "Dokploy's Swarm services are running"
    check: "docker service ls --format '{{.Name}}' | grep -q '^dokploy'"
  - id: traefik-running
    description: "The Traefik container is up"
    check: "docker ps --format '{{.Names}}' | grep -q dokploy-traefik"
  - id: app-dns-points-at-server
    description: "App DNS resolves to THIS server's IP. Note: if you CDN-proxy the record (Cloudflare orange-cloud) it resolves to the CDN, not the origin — this check is expected to fail then, which is fine."
    check: "dig +short ${APP_DOMAIN} | grep -qF ${SERVER_IP}"
  - id: admin-ui-private
    description: "From outside the tailnet, http://<public-ip>:3000 times out (UI not public)"
    manual: true
  - id: backup-object-created
    description: "A manual Web Server backup produces an object in the S3 bucket"
    manual: true
  - id: survives-reboot
    description: "After `reboot`, the UI and all services return without intervention"
    manual: true

gotchas:
  - "Bare `tailscale up` blocks on an interactive browser login — on a headless server or an agent-driven run it hangs/loops; use `tailscale up --authkey=...` with a pre-generated key instead"
  - "The installer runs `docker swarm leave --force` unconditionally — it will tear down existing Swarm membership on the machine"
  - "The installer pins an exact Docker version; on a just-released Ubuntu whose codename Docker's apt repo doesn't carry yet, Docker install fails and Swarm init aborts — install Docker yourself first (`curl -fsSL https://get.docker.com | sh`), then re-run the installer (it skips Docker when present)"
  - "Installation aborts if anything listens on ports 80, 443, or 3000 — stop existing web servers first"
  - "The first person to open port 3000 creates the admin account — create yours immediately after install"
  - "UFW does not block Docker-published ports; use your provider's firewall or ufw-docker to actually close port 3000"
  - "On servers with only a public IP, the installer can't auto-detect an advertise address — set ADVERTISE_ADDR yourself"
  - "Create the DNS record before adding a domain in Dokploy, or the Let's Encrypt certificate won't be issued"

related: [scheduling-tool, vaultwarden-family]
---

# Set up a fresh Ubuntu server for self-hosting

## Context

Use this pattern once per server, before deploying any apps. It takes a fresh Ubuntu machine to a state where every other Thuishaven pattern can assume: Dokploy running, its admin UI reachable only over Tailscale, Traefik ready to issue Let's Encrypt certificates for apps you choose to expose publicly, DNS prepared, and backups configured. Works on a VPS (Hetzner, DigitalOcean, etc.) or a home server.

This pattern is `stable`: validated end-to-end by the maintainer on a fresh Hetzner VPS (Dokploy v0.29.8, June 2026), with the findings from that run folded in. The agent-driven Dokploy-API path (step 9) is the one part still documented-but-unproven — see issue #2.

## Decisions explained

**Why Dokploy.** It hits the sweet spot for this audience: a real web UI for deployments, but built on boring, inspectable primitives — Docker, Docker Swarm, Traefik. Configuration lives in `/etc/dokploy` as plain files you can read. Coolify is the closest competitor and a fine choice, but it has a heavier control plane; when something breaks at 23:00, Dokploy's "it's just Traefik file-provider configs" is easier to debug.

**Why the admin UI goes on the tailnet, not the public internet.** The Dokploy UI can deploy arbitrary containers with access to the Docker socket — it is root on your server with a login page. No public exposure, no brute-force surface, no waiting for the next auth CVE. Tailscale gives you an encrypted private network to reach it from your laptop and phone with near-zero configuration. Public exposure is reserved for the *apps* you deliberately expose via Traefik.

**Why Traefik + Let's Encrypt for public apps.** It ships with Dokploy and automates the certificate lifecycle. You add a domain to an app in the UI; Traefik picks it up and provisions the certificate. No certbot cron jobs.

**A real consequence to understand: Docker Swarm.** The Dokploy installer initializes Docker Swarm (single-node) and deploys Dokploy itself as a Swarm service. If this machine already participates in a Swarm cluster, **the installer will force-leave it** (`docker swarm leave --force`) and destroy that membership. Existing standalone containers keep running but remain unmanaged by Dokploy. This pattern assumes a fresh or near-fresh server; for joining Dokploy into an *existing* Swarm, see the [manual installation docs](https://docs.dokploy.com/docs/core/manual-installation) instead.

## Step-by-step

All commands run as root (or prefix with `sudo`) over SSH.

### 1. Pre-flight checks

```bash
# OS: Ubuntu 24.04 LTS or 22.04 LTS recommended (older LTS releases are supported).
# A just-released Ubuntu (e.g. 26.04 right after launch) may have no Docker apt repo
# yet — the installer's Docker step can fail; see step 3 for the bring-your-own-Docker path.
lsb_release -a

# Resources: minimum 2 GB RAM and 30 GB free disk
free -h
df -h /

# Ports 80, 443, and 3000 must be completely free — the installer aborts otherwise
ss -tulnp | grep -E ':(80|443|3000)\s'

# Existing Docker? Fine — the installer will skip Docker installation.
docker --version 2>/dev/null || echo "no docker (installer will install it)"

# Existing containers and Swarm state — read the consequences above before proceeding
docker ps 2>/dev/null
docker info 2>/dev/null | grep -i swarm
```

Resolve anything that shows up: stop/disable an existing nginx/apache (`systemctl disable --now nginx`), and do not continue on a machine whose Swarm membership you care about.

### 2. Install Tailscale first

Installing Tailscale before Dokploy means you can do the security-sensitive first-login over the tailnet, never exposing the admin UI to the public internet.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Then bring the node up. **On a headless server — and especially when an agent is driving the setup — do not use the bare interactive `tailscale up`.** It prints an authentication URL and blocks until you complete a browser login, which agents loop on and scripts hang on. Instead, generate an auth key first and pass it in non-interactively:

1. In the Tailscale admin console, go to **[Settings → Keys → Generate auth key](https://login.tailscale.com/admin/settings/keys)**. Tick **Pre-approved** so the node joins without a separate approval step; for a throwaway or dogfood box, also tick **Ephemeral** so it auto-removes when it goes offline. Copy the `tskey-auth-…` value.
2. Bring the node up with the key:

```bash
sudo tailscale up --authkey=tskey-auth-XXXXXXXX --hostname=dokploy --ssh
```

This returns immediately — no URL to fetch, no browser round-trip. (The key lands in your shell history and the process list; on a server you intend to keep, use a short-lived or ephemeral key and rotate it afterwards.)

> At a desktop with a browser, plain `tailscale up` is fine — follow the printed URL. The auth-key flow is the one to use on servers and in any automated or agent-driven run.

Note the server's tailnet IP — you'll use it to reach the admin UI:

```bash
tailscale ip -4   # something like 100.x.y.z
```

In the Tailscale admin console, consider disabling key expiry for this server so it doesn't drop off the tailnet in 180 days. (An ephemeral node is exempt — it's removed on disconnect rather than expiring.)

### 3. Run the Dokploy installer

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

If the installer errors with a message about not finding a private IP (common on VPSes that only have a public address), set the advertise address explicitly and rerun:

```bash
export ADVERTISE_ADDR=$(curl -4s ifconfig.me)   # or your private IP if the VPS has one
curl -sSL https://dokploy.com/install.sh | sh
```

**If the installer fails to install Docker** — common on a just-released Ubuntu whose codename Docker's apt repo doesn't carry yet, because the installer pins an exact Docker version — install Docker yourself first, then re-run. The installer detects the existing Docker and skips straight to Swarm and the services:

```bash
# Docker's official convenience script installs the current stable build for your OS
curl -fsSL https://get.docker.com | sh
docker --version            # confirm it's installed and the daemon is up

curl -sSL https://dokploy.com/install.sh | sh   # re-run; skips Docker, proceeds to Swarm
```

If even `get.docker.com` has no build for your release, prefer the latest Ubuntu LTS Docker officially supports (24.04 at time of writing) over the newest release.

What it does, so nothing is a surprise: installs Docker if missing, initializes a single-node Docker Swarm, creates the `dokploy-network` overlay network, creates `/etc/dokploy`, and starts four things — Postgres 16 and Redis 7 (Dokploy's own state), the Dokploy UI (port 3000), and Traefik (ports 80 and 443).

### 4. Create the admin account immediately

The first visitor to port 3000 gets to create the admin account, and right now port 3000 is open to the whole internet. Do this within minutes of the install finishing:

1. Open `http://<tailnet-ip>:3000` (the Tailscale IP from step 2) from your laptop.
2. Create the admin account with a strong, stored-in-your-password-manager password.

### 5. Close port 3000 to the public internet

The UI must end up reachable over Tailscale only. **UFW alone will not do this** — Docker publishes ports by manipulating iptables directly, bypassing UFW rules. Two reliable options:

**Option A — provider firewall (preferred on a VPS).** In your cloud provider's firewall (Hetzner Cloud Firewall, DO Cloud Firewall, AWS security group): allow inbound TCP 22, TCP 80, TCP+UDP 443, and Tailscale's UDP 41641; deny everything else, including TCP 3000. Tailscale traffic tunnels over UDP, so the UI stays reachable at `http://<tailnet-ip>:3000` while the public internet gets nothing.

**Option B — remove the published port (home server / no provider firewall).** Unpublish port 3000 entirely and reach the UI through a Traefik-routed domain or SSH tunnel:

```bash
docker service update --publish-rm "published=3000,target=3000,mode=host" dokploy
```

To temporarily get it back: same command with `--publish-add`. With the port unpublished, access the UI via an SSH port-forward over Tailscale when needed:

```bash
ssh -L 3000:localhost:3000 root@<tailnet-ip>   # then open http://localhost:3000
```

Note: with Option B, `localhost:3000` forwarding works because host-mode published ports were removed but the service still listens inside; if the forward doesn't connect, re-add the publish restricted by Option A-style firewalling instead.

Verify from a machine **outside** your tailnet (e.g. phone on mobile data): `http://<public-ip>:3000` must time out.

### 6. Prepare DNS at your registrar

Create these records at your DNS provider (instructions only — you do this at your registrar; values shown as examples):

| Type | Name | Value | Purpose |
|---|---|---|---|
| A | `apps.example.com` | `<server-public-IP>` | one record per public app, or: |
| A | `*.apps.example.com` | `<server-public-IP>` | wildcard so new apps need no DNS work |

A wildcard subdomain (`*.apps.example.com`) is the low-friction choice: every future app gets `something.apps.example.com` with zero registrar visits. Individual A records are slightly more private (no wildcard advertising that everything routes to one box). Either works.

Wait for propagation before assigning domains in Dokploy (`dig +short test.apps.example.com` should return your server IP). If you add a domain in Dokploy before DNS resolves, the Let's Encrypt challenge fails; fix by recreating the domain or restarting Traefik after DNS is live.

**If your DNS is proxied through a CDN (Cloudflare orange-cloud):** a proxied record resolves to the CDN's IPs, not your origin, which has two consequences the rest of this pattern assumes away:

- **First certificate issuance.** Traefik uses the Let's Encrypt HTTP-01 challenge; through a proxy it can fail depending on the proxy's SSL/"Always Use HTTPS" settings. Set the record to **DNS-only (grey-cloud)** while issuing the first certificate, then re-enable the proxy.
- **SSL mode once proxied.** Set the CDN's SSL mode to **Full (strict)**. **Flexible** terminates TLS at the CDN and talks HTTP to the origin, which causes an infinite redirect loop once Traefik forces HTTPS.

A proxied record will (correctly) make the `app-dns-points-at-server` assertion fail, since it resolves to the CDN — expected, not a problem.

### 7. Set the Let's Encrypt email

Traefik needs a contact email for the ACME account (expiry notices land there):

1. In the Dokploy UI: **Settings → Web Server**.
2. Enter your Let's Encrypt email in the certificates section and save.

Don't assign a public domain to the Dokploy panel itself — the whole point is that the panel stays off the public internet. Per-app domains are configured on each app when you deploy one (see [scheduling-tool](scheduling-tool.md) for a first example).

### 8. Configure backups

Dokploy has built-in scheduled backups to any S3-compatible storage (Backblaze B2, Cloudflare R2, AWS S3, ...):

1. Create a bucket at your storage provider and an access key scoped to it.
2. In Dokploy: **Settings → S3 Destinations** → add the destination, and use the test button.
3. Enable the **Web Server backup** on a schedule (e.g. daily at 04:00). This backs up Dokploy's own database plus `/etc/dokploy` — your projects, domains, and Traefik config.
4. When you later deploy apps with databases, give each one its own scheduled database backup to the same destination (each Thuishaven pattern covers this).

Off-server backups are non-negotiable; a backup on the server it protects is just a copy waiting to die with the disk.

### 9. Enable agent-driven deploys via the Dokploy API (recommended)

The rest of Thuishaven's app patterns describe deploys as Dokploy UI clicks, but Dokploy exposes a full authenticated HTTP API — so an agent can create projects, databases, and applications, set environment, add domains, and deploy **without a human driving the mouse**. Set this up once here and the app patterns can assume it, exactly like they assume `tailscale-connected`.

1. In the Dokploy UI: **Settings → API/Profile** → generate an API token. Store it as `DOKPLOY_API_TOKEN` (treat it as root-equivalent — it can deploy arbitrary containers).
2. The API lives on the same origin as the UI (reach it over the tailnet, e.g. `http://<tailnet-ip>:3000`). Authenticate with the token; confirm access:

```bash
# base URL = the Dokploy UI origin, reachable over the tailnet
export DOKPLOY_URL="http://<tailnet-ip>:3000"
curl -fsS "$DOKPLOY_URL/api/health"                                  # -> 200, no auth
curl -fsS -H "x-api-key: $DOKPLOY_API_TOKEN" "$DOKPLOY_URL/api/project.all" >/dev/null \
  && echo "✓ API token works"
```

The exact endpoint set and request bodies are versioned — read your install's live schema at `$DOKPLOY_URL/api/swagger` (it requires auth). The app patterns list the call sequence they need; this step is just the shared auth + base URL they build on.

### 10. Keep the server itself patched

Dokploy manages apps, not the OS. Enable unattended security updates:

```bash
apt-get update && apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades   # choose Yes
```

## Verification

The `assertions` in the frontmatter are the source of truth. The scriptable ones
run **on the server** and exit non-zero on failure:

```bash
#!/usr/bin/env bash
# verify.sh — run on the bootstrapped server. APP_DOMAIN and SERVER_IP must be exported.
set -euo pipefail
: "${APP_DOMAIN:?} ${SERVER_IP:?}"
tailscale status >/dev/null                                       && echo "✓ tailscale-connected"
docker service ls --format '{{.Name}}' | grep -q '^dokploy'       && echo "✓ dokploy-services-up"
docker ps --format '{{.Names}}' | grep -q dokploy-traefik         && echo "✓ traefik-running"
dig +short "$APP_DOMAIN" | grep -qF "$SERVER_IP"                  && echo "✓ app-dns-points-at-server"
echo "All scriptable assertions passed."
```

The rest are `manual: true` because they need a second network vantage point or a
physical reboot:

- **admin-ui-private** — from outside the tailnet (e.g. phone on mobile data), `http://<public-ip>:3000` must time out. This is the security-critical check; verify it from an actually-external network, not by reading firewall rules.
- **backup-object-created** — the S3 destination test in Dokploy succeeds and a manual Web Server backup produces an object in your bucket.
- **survives-reboot** — `reboot` the server; after it comes back, the UI and all services return without manual intervention.

The real end-to-end verification is deploying a first app with a public domain and watching the certificate get issued — that's the next pattern: [scheduling-tool](scheduling-tool.md).

## Gotchas

- **Swarm force-leave.** The installer runs `docker swarm leave --force` unconditionally and force-removes any existing `dokploy-network`. On a machine that's part of a Swarm you care about, this is destructive. It also means re-running the installer on a working Dokploy box is not harmless — for updates use the update mechanism (below), not a reinstall.
- **Port 3000 race after install.** Between "installer prints the URL" and "you create the admin account", anyone scanning your IP can register as admin. Do step 4 immediately; if you suspect you were beaten to it, the cleanest fix is to uninstall and reinstall.
- **UFW gives false confidence.** `ufw deny 3000` will appear to work while Docker happily accepts traffic on 3000 from anywhere. Verify with an actual external connection attempt, not by reading firewall rules. If you need host-level filtering for Docker ports, use [ufw-docker](https://github.com/chaifeng/ufw-docker) or raw `DOCKER-USER` iptables rules.
- **`ADVERTISE_ADDR` on public-IP-only servers.** The installer auto-detects only RFC1918 private addresses. Cloud servers without a private interface need `ADVERTISE_ADDR` exported explicitly or the install fails.
- **DNS-before-domain ordering.** Adding a domain in Dokploy while DNS still points elsewhere burns a failed ACME challenge. Let's Encrypt also rate-limits: repeated failures can lock you out of issuance for that hostname temporarily (and 5 duplicate certificates per week per cert set).
- **Existing containers are invisible to Dokploy.** Pre-existing containers keep running but don't appear as Dokploy projects. Plan to re-create them as Dokploy services over time, or accept managing them separately.
- **Provider egress limits on mail ports.** Many VPS providers (including Hetzner) block *outbound* TCP 25 and 465 to curb spam, while leaving 587 open. This bites any app you later deploy that sends mail: a service configured for implicit-TLS SMTP on 465 will just hang. Prefer port 587 (STARTTLS), or your provider/ESP's alternate submission port.
- **CDN-proxied DNS.** A Cloudflare orange-clouded record resolves to the CDN, not your origin: it can break first Let's Encrypt issuance (use DNS-only while issuing) and, on SSL mode "Flexible", cause an HTTPS redirect loop (use Full strict). See step 6.

## Maintenance notes

- **Updating Dokploy**: Settings → Web Server → update button in the UI, or from the shell: `curl -sSL https://dokploy.com/install.sh | sh -s update`. This only updates Dokploy itself — Traefik, Postgres, and Redis stay at their installed versions.
- **OS updates**: unattended-upgrades handles security patches; do a manual `apt full-upgrade` + reboot quarterly.
- **Disk watch**: Docker images accumulate. Dokploy has cleanup settings; `docker system df` shows what's eating space, `docker system prune -f` (without `-a` unless you know why) reclaims it.
- **What breaks over time**: Let's Encrypt renewals are automatic, but if a domain's DNS changes or the server IP changes, renewals silently start failing ~60 days later — cert expiry alerts to the ACME email are your safety net, don't use a dead mailbox.
- **Backup restore drill**: once after setup, download a Web Server backup archive and check it contains `/etc/dokploy` and a database dump. Restoring onto a new server is documented in the [Dokploy backup docs](https://docs.dokploy.com/docs/core/backups); after a restore you may need to update the server IP and re-auth Git providers.
