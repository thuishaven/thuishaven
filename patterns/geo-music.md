---
id: geo-music
title: "A road-trip playlist of artists from the places you drive through"
version: 1
status: experimental
category: media
tags: [music, spotify, playlist, maps, road-trip, geo-music]
maintainer: hiddevh

problem: >
  You want a road-trip soundtrack that reflects the journey: a playlist of
  artists from the towns and regions you actually drive through, in travel
  order, sized to the length of the drive — with a map showing when you'll hear
  each track. Self-hosted, sharing it with your own circle (no SaaS).

recommendation:
  app: geo-music
  app_source: https://github.com/thuishaven/geo-music
  deploy_target: dokploy
  exposure: cloudflare-tunnel

alternatives:
  - name: A static "songs for your trip" playlist
    reason_not_chosen: "Not route-aware — it ignores where you actually are; the whole point here is geography in travel order."
  - name: Spotify's own algorithmic playlists
    reason_not_chosen: "No notion of where artists are from, and no map/journey view."
  - name: A public hosted SaaS version for everyone
    reason_not_chosen: "Spotify's Extended Quota Mode (needed to serve arbitrary users) now requires 250k monthly active users and a registered business — out of reach. Self-hosting per-person sidesteps it: each instance uses its own Spotify app with its own 25-user allowance."

prerequisites:
  - dokploy-installed
  - cloudflare-tunnel-configured
  - spotify-premium-account

estimated_time_minutes: 30

inputs:
  - name: PUBLIC_BASE_URL
    description: "Public HTTPS origin the app is served from (no trailing slash). The OAuth callback is ${PUBLIC_BASE_URL}/auth/callback and must be registered in the Spotify app exactly."
    example: https://geomusic.example.com
    format: url
    required: true
  - name: SPOTIFY_CLIENT_ID
    description: "Client ID of a Spotify app created at developer.spotify.com/dashboard. The app's OWNER account must have Spotify Premium."
    example: de7a558b4b7b44f6808748749737bd95
    required: true
  - name: SPOTIFY_CLIENT_SECRET
    description: "Client secret of the same Spotify app."
    required: true
    secret: true
  - name: SPOTIFY_MARKET
    description: "ISO 3166-1 alpha-2 market used to pick playable top tracks."
    example: NL
    default: NL
    required: false

gotchas:
  - "The Spotify app OWNER must have Premium — the Web API returns 403 'Active premium subscription required for the owner of the app' otherwise. Subscription changes can take a few hours to propagate."
  - "The app starts in Development Mode: only Spotify accounts you add to its allow-list (the owner + up to 25) can connect. Add each user's Spotify email in the dashboard. Extended Quota Mode (to drop the limit) needs 250k MAU + a business, so treat this as a tool for you and ~25 people."
  - "Register the OAuth redirect URI exactly as ${PUBLIC_BASE_URL}/auth/callback in the Spotify app, or login fails with INVALID_CLIENT."
  - "Each playlist build takes one to a few minutes (MusicBrainz/Nominatim/OSRM are rate-limited to ~1 req/s). The app runs builds as background jobs and the page polls, so don't expect an instant response."
  - "Sessions are in-memory: a container restart logs everyone out (they just reconnect Spotify). Fine for a single instance."
  - "Geographic data is best-effort from MusicBrainz: sparse rural regions are thin, and 'from' means MusicBrainz's area tag (residence/citizenship), so you'll get the occasional delightful surprise (e.g. Tina Turner tagged Swiss)."

related: [dokploy-bootstrap]
---

# A road-trip playlist of artists from the places you drive through

## Context

Use this pattern when you want a *journey* soundtrack rather than a generic
travel playlist. You enter a start and end; geo-music routes between them, finds
artists *from* the places along the way (city → region → country), and builds a
Spotify playlist in travel order, sized to roughly the drive time. The web UI
shows the route on a map with a track-by-track timeline and a "fly the route"
animation. Each visitor connects their own Spotify account, and the playlist is
created on their account.

This is a self-host-for-your-circle tool by nature: Spotify caps third-party apps
at 25 connected users unless you are a 250k-MAU business (see Decisions). One
instance comfortably serves you, your family and friends.

## Decisions explained

**Why self-host instead of a public service.** Spotify's Extended Quota Mode —
required to let *arbitrary* users connect — now demands 250k monthly active users
and a registered business. A hobby project can't meet that. But Development Mode
allows the app owner plus 25 allow-listed accounts, which is plenty for personal
sharing. Self-hosting per person means everyone gets their own Spotify app and
their own 25-user budget, so the limit never bites the community as a whole. This
is exactly Thuishaven's model: a recipe you run yourself, not a central service.

**Why Dokploy.** geo-music ships a Dockerfile; Dokploy builds and runs it next to
your other services and handles restarts. No database is needed — it's stateless
(sessions are in memory).

**Why a Cloudflare Tunnel / public domain.** Spotify OAuth needs a reachable
HTTPS callback. A Cloudflare Tunnel to your home server gives a public HTTPS
origin without opening ports. (Tailnet-only via `tailscale serve` also works if
everyone you share with is on your tailnet — set `PUBLIC_BASE_URL` to the
`*.ts.net` HTTPS host instead.)

**Why MusicBrainz + Spotify.** MusicBrainz provides open artist-origin data
(searchable by area); Spotify provides the catalogue, popularity (for ranking),
and playlist creation. Geocoding/routing use keyless OSM services (Nominatim,
OSRM), so the only credentials you need are the Spotify app's.

## Step-by-step

Assumes a server bootstrapped with [dokploy-bootstrap](dokploy-bootstrap.md) and
a Cloudflare Tunnel ready to route a hostname to it.

### 1. Create the Spotify app

1. At [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard),
   while logged in as a **Premium** account, create an app.
2. Add the redirect URI `${PUBLIC_BASE_URL}/auth/callback` under **Settings →
   Redirect URIs**.
3. Copy the **Client ID** and **Client Secret** → `SPOTIFY_CLIENT_ID` /
   `SPOTIFY_CLIENT_SECRET`.
4. Under **Users and Access**, add the Spotify email of everyone who will use it
   (up to 25).

### 2. Deploy on Dokploy

1. Create an application from the `thuishaven/geo-music` repo (it builds the
   `Dockerfile`).
2. Set environment variables: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
   `PUBLIC_BASE_URL` (your `https://` domain), and optionally `SPOTIFY_MARKET`.
   The container listens on **8080**.

### 3. Expose it

Point your Cloudflare Tunnel's public hostname at the container's `:8080`, so
`${PUBLIC_BASE_URL}` resolves over HTTPS. Make sure the callback from step 1
matches the live domain exactly.

## Verification

1. Open `${PUBLIC_BASE_URL}` — the page loads and shows **Connect Spotify**.
2. Connect with an allow-listed account; you're redirected back, connected.
3. Build a short route (e.g. Amsterdam → Utrecht). After a minute or two the map,
   timeline, and an **Open in Spotify** link appear, and the playlist exists on
   your Spotify account.
4. `curl -s ${PUBLIC_BASE_URL}/api/me` returns `{"connected":true}` for a
   logged-in session.

## Gotchas

- **Premium-owner requirement.** If the app owner isn't Premium, the very first
  API call 403s. Make the owner account Premium and wait for it to propagate.
- **25-user ceiling.** Development Mode only — add each user's Spotify email.
  There is no realistic path past 25 for a hobby app; design your sharing around
  it (or have others self-host their own instance).
- **Exact callback URL.** A mismatch between `PUBLIC_BASE_URL` and the registered
  redirect URI fails with INVALID_CLIENT.
- **Slow builds are normal.** Rate-limited upstreams mean a build takes minutes;
  the UI polls a background job and shows elapsed time.
- **Best-effort geography.** Sparse regions under-fill, and "from" reflects
  MusicBrainz's area tag (which can be residence/citizenship, not birthplace).

## Maintenance notes

- **Updates**: redeploy from the repo (Dokploy rebuild). No database to migrate.
- **Backups**: none required — the app is stateless; the only state worth keeping
  is users' generated playlists, which live in their own Spotify accounts.
- **Token hygiene**: keep `SPOTIFY_CLIENT_SECRET` in Dokploy secrets only; rotate
  it in the Spotify dashboard if it leaks.
- **Watch for drift**: Spotify periodically tightens API terms (it removed broad
  genre data and the old quota path). If builds start failing, check the Spotify
  developer dashboard for new restrictions first.
