# Domain & DNS

The platform uses 3 subdomains of the existing `shrianandamsweets.in`
domain. **The main website (`shrianandamsweets.in` and
`www.shrianandamsweets.in`) is not touched by any of this** — nothing
here changes its DNS records, its hosting, or its own web server config;
this only *adds* 3 new subdomains alongside it.

| Subdomain | App | Talks to it |
|---|---|---|
| `api.shrianandamsweets.in` | `services/api` (REST + Socket.IO) | Both mobile apps, admin-web, kitchen-web |
| `admin.shrianandamsweets.in` | `apps/admin-web` | Staff, in a browser |
| `kitchen.shrianandamsweets.in` | `apps/kitchen-web` | Kitchen display screen, in a browser |

`apps/customer-mobile` and `apps/owner-mobile` are native apps, not
websites — they have no subdomain of their own, they just call
`https://api.shrianandamsweets.in` (see `eas.json` in each, already
updated to this).

## What's actually been verified vs. what's a deployment concern

| Piece | Status |
|---|---|
| Every app pointed at the right subdomain in its own config (`eas.json`, `.env.example` files, `CORS_ALLOWED_ORIGINS`) | **Done** — see the diff this doc ships alongside |
| All 4 Node processes (api, notification-worker, admin-web, kitchen-web) actually running on the right ports under pm2 | **Live-verified** on this machine — all 4 came up and served real HTTP 200s (`curl` against each) under `infrastructure/pm2/ecosystem.config.js`; see `docs/deployment/aws-lightsail-setup.md` |
| `infrastructure/nginx/shri-anandam.conf` (reverse proxy, 3 server blocks) | Written, syntactically a real Nginx config, **not tested against a running Nginx** — no server exists in this environment to run one on |
| DNS records actually created | **Not done — needs you.** I have no access to your DNS provider. Records to add are below. |
| TLS certificates issued | Not done — needs a real reachable server for certbot's HTTP-01 challenge (see below) |

## 1. DNS records to add

At whatever DNS provider manages `shrianandamsweets.in` today (your
domain registrar, or Cloudflare/Route53/etc. if you've delegated
nameservers there — not something I can see from here), add 3 new **A
records**, and touch nothing else:

| Type | Name | Value |
|---|---|---|
| A | `api` | your Lightsail instance's **static IP** |
| A | `admin` | same static IP |
| A | `kitchen` | same static IP |

Use a Lightsail **static IP** (Lightsail's free static-IP feature),
not the instance's default public IP — the default one changes if the
instance ever restarts/is recreated, which would silently break DNS
until you noticed and manually updated 3 records. Attach the static IP
once, point all 3 A records at it, and a restart never breaks DNS again.

Your instance's current public IPv4 is `13.126.8.106` (Mumbai,
`ap-south-1a`) — check the Lightsail console's **Networking** tab for
that instance: if a static IP is already attached, `13.126.8.106` *is*
that permanent value and you can use it directly below; if not, attach
one now (Lightsail may hand you a different static IP than this
existing one — use whatever the static IP page shows, not necessarily
this exact address).

Set TTL to something short (300s) while you're setting this up, so a
mistake is quick to fix; raise it back to an hour+ once everything's
confirmed working.

Do **not** touch the existing `@` (root) or `www` records — those keep
serving the main website exactly as they do today.

## 2. Point Nginx at the 3 apps

Copy `infrastructure/nginx/shri-anandam.conf` onto the Lightsail
instance:

```bash
sudo cp infrastructure/nginx/shri-anandam.conf /etc/nginx/sites-available/shri-anandam.conf
sudo ln -s /etc/nginx/sites-available/shri-anandam.conf /etc/nginx/sites-enabled/
sudo nginx -t   # validate syntax before reloading
sudo systemctl reload nginx
```

This assumes each app is already running on the instance on its own
port (`services/api` on `4000` per `.env`'s `APP_PORT`, `apps/admin-web`
on `3000`, `apps/kitchen-web` on `3001` — see the comment at the top of
that config file for exactly where those numbers come from). See
`docs/deployment/aws-lightsail-setup.md` for getting all 4 Node
processes (api, notification-worker, admin-web, kitchen-web) actually
running and kept alive via pm2 (`infrastructure/pm2/ecosystem.config.js`)
— that's a prerequisite to this step, not part of domain routing itself.

## 3. TLS (HTTPS) via Let's Encrypt

Once step 1's DNS has propagated (check with `dig api.shrianandamsweets.in`
— should return your static IP) and step 2's Nginx config is live on
port 80, get real certificates with `certbot`:

```bash
sudo certbot --nginx \
  -d api.shrianandamsweets.in \
  -d admin.shrianandamsweets.in \
  -d kitchen.shrianandamsweets.in
```

`certbot`'s Nginx plugin edits `shri-anandam.conf` in place to add the
`ssl_certificate`/`listen 443` lines and a port-80-to-443 redirect, and
sets up auto-renewal (`certbot renew` via its own systemd timer —
verify with `sudo systemctl status certbot.timer`). This only works if
DNS in step 1 already resolves to this server — Let's Encrypt's HTTP-01
challenge fetches a token from the domain over the real internet to
prove you control it.

## 4. Env vars each app needs at this domain

Already updated in this repo (see each file's own comment for detail) —
this table is just the summary of what production values to actually
set when deploying, since `.env.example`/`eas.json` intentionally ship
placeholders or dev defaults, never real production values:

| App | Var | Production value |
|---|---|---|
| `services/api` | `APP_URL` | `https://api.shrianandamsweets.in` |
| `services/api` | `CORS_ALLOWED_ORIGINS` | `https://admin.shrianandamsweets.in,https://kitchen.shrianandamsweets.in` |
| `apps/admin-web` | `NEXT_PUBLIC_API_URL` | `https://api.shrianandamsweets.in/api/v1` |
| `apps/kitchen-web` | `NEXT_PUBLIC_API_URL` | `https://api.shrianandamsweets.in/api/v1` |
| `apps/customer-mobile`, `apps/owner-mobile` | `EXPO_PUBLIC_API_URL` | `https://api.shrianandamsweets.in/api/v1` (baked into the build by `eas.json`'s `preview`/`production` profiles — already set) |

One thing to know: `eas.json`'s `preview` profile now points at the
same production API as `production` (not a separate staging one) —
this build has a single Lightsail instance/database, no staging
environment provisioned. If a staging environment gets stood up later,
give it its own subdomain (e.g. `staging-api.shrianandamsweets.in`) and
point `preview` back at that.

## 5. Order of operations

Do these in order — each step depends on the previous one actually
working, and skipping ahead just produces a confusing failure at a
later step instead of a clear one at the right step:

1. Attach a Lightsail static IP to the instance.
2. Add the 3 DNS A records (step 1 above), wait for propagation
   (`dig` each subdomain until it returns the static IP).
3. Get all 4 Node processes running on the instance on their assigned
   ports — see `docs/deployment/aws-lightsail-setup.md` (pm2 +
   `infrastructure/pm2/ecosystem.config.js`).
4. Deploy `infrastructure/nginx/shri-anandam.conf` (step 2 above),
   confirm plain-HTTP routing works — `services/api`'s `@Public()`
   `GET /health` (`services/api/src/health/health.controller.ts`) needs
   no auth and is deliberately **unprefixed** (`main.ts`'s
   `setGlobalPrefix` explicitly excludes `health`/`live`/`ready`/
   `metrics` from `API_PREFIX` — orchestrators/scrapers expect fixed,
   unversioned paths — not `/api/v1/health`, caught live testing this
   exact command), so it's the simplest smoke test:
   `curl -H "Host: api.shrianandamsweets.in" http://<static-ip>/health`
   before DNS has propagated, or plain
   `curl https://api.shrianandamsweets.in/health` after step 5's TLS is
   up. A healthy response looks like
   `{"success":true,"data":{"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}...`.
5. Run `certbot` (step 3 above) to get HTTPS working.
6. Set the real production env vars (step 4 above) and restart every
   process so they pick up the new values.
