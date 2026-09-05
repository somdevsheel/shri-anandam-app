# AWS Lightsail Setup

Provisioning and deploying the whole platform (Postgres, Redis,
`services/api`, `services/notification-worker`, `apps/admin-web`,
`apps/kitchen-web`) onto a single Lightsail instance. For the DNS
records, Nginx routing, and TLS that sit on top of this, see
`docs/deployment/domain-and-dns.md` — this doc stops at "the 4 app
processes + Postgres + Redis are running and reachable on localhost";
that one picks up from there.

## What's actually been verified vs. what needs the real instance

| Piece | Status |
|---|---|
| `infrastructure/pm2/ecosystem.config.js` (all 4 Node processes) | **Live-verified** on this dev machine — all 4 came up under pm2 and served real HTTP responses (`curl` against each), including a real bug caught and fixed (see below) |
| `services/notification-worker`'s production `start` script actually loading `.env` | **Live-verified** — was silently broken (see below), fixed, confirmed connecting to a real Postgres and processing real outbox rows under the fixed command |
| `infrastructure/docker/docker-compose.prod.yml` (Postgres + Redis, production credentials) | Written, **not yet run** — this dev machine already has a dev Postgres/Redis on different ports (`docker-compose.yml`); running the prod compose file too would need distinct ports here to test side-by-side, which isn't worth doing on a machine that isn't the actual target. Config reviewed line-by-line against the same image/settings as the dev compose file, which *is* live-tested all session. |
| Everything from "create the instance" onward (this doc's steps 1-8) | Documented, **not run** — no SSH access to the real instance yet from this environment (see below) |

## 0. Your instance, as created

From what you've shared: **Ubuntu**, region **Mumbai (`ap-south-1a`)**,
General purpose plan, dual-stack networking, public IPv4
`13.126.8.106`, private IPv4 `172.26.15.1`. The steps below use that IP
where a concrete example is useful — swap in the real one if it
changes (e.g. once you attach a static IP in step 2).

**SSH access**: tried the `ap-south-1` region's default Lightsail key
already on this machine — it was rejected (`Permission denied
(publickey)`), meaning this instance either used a different/new key
pair, or the default key was regenerated since that file was
downloaded. Two ways to get in:

- **No key needed**: Lightsail console → this instance → **Connect**
  tab → **Connect using SSH** — a browser-based terminal, works
  immediately.
- **From your own terminal**: Lightsail console → account icon
  (top-right) → **Account** → **SSH Keys** tab → download the key this
  instance actually uses (the default for `ap-south-1`, or a
  custom one if you created one at instance-creation time) → then:
  ```bash
  chmod 600 ~/Downloads/<the-key>.pem
  ssh -i ~/Downloads/<the-key>.pem ubuntu@13.126.8.106
  ```

Everything from here on assumes you're at a shell prompt on the
instance itself (either method above gets you there).

## 1. Sizing — how much RAM you need

What actually runs on this one box, and realistic memory for this
scale of business (a single restaurant, not a chain):

| Process | Typical RSS |
|---|---|
| Postgres 16 (docker) | 200-400 MB |
| Redis 7 (docker) | 100-250 MB |
| `services/api` (NestJS) | 150-350 MB |
| `services/notification-worker` | 80-150 MB |
| `apps/admin-web` (Next.js) | 150-250 MB |
| `apps/kitchen-web` (Next.js) | 150-250 MB |
| Nginx + Docker daemon + OS (Ubuntu) | 400-600 MB |
| **Runtime total** | **~1.3-2.3 GB** |

The number that actually decides the plan, though, is **build time**,
not runtime: `next build` and `tsc` compiling `services/api` each spike
well past their steady-state runtime footprint — commonly
1-1.5 GB apiece — and if a build runs while the live processes are
still serving traffic (the realistic case — you don't want to stop the
API to deploy an admin-web change), that spike stacks on top of the
~2 GB runtime total above.

| Plan | RAM | Verdict |
|---|---|---|
| 1 GB | 1 GB | Not enough — a single `next build` alone can exceed this |
| 2 GB | 2 GB | Workable minimum, but tight — build one app at a time, expect the OOM killer to be a real risk if two builds ever overlap, add swap (step 3) as a hard requirement, not an optional safety net |
| **4 GB (recommended)** | 4 GB | Comfortable — a build can run alongside all 4 live processes without swapping, real headroom for traffic bursts |

If you're already on a 2 GB plan and it's working, that's fine to start
on — just don't skip the swap file in step 3, and expect to resize up
(Lightsail supports resizing a snapshot onto a bigger plan) once real
order volume shows up. This doesn't need to be right on day one.

## 2. Attach a static IP

Lightsail console → **Networking** → **Create static IP** → attach it
to this instance. Without this, the instance's public IP can change on
a restart/recreate, silently breaking every DNS record you set up in
`docs/deployment/domain-and-dns.md`. Do this before touching DNS.

## 3. Firewall

Lightsail console → this instance → **Networking** tab → firewall
rules. You need exactly:

| Application | Protocol | Port |
|---|---|---|
| SSH | TCP | 22 |
| HTTP | TCP | 80 |
| HTTPS | TCP | 443 |

Nothing else — Postgres (5432) and Redis (6379) are never opened here;
they're bound to `127.0.0.1` by `docker-compose.prod.yml` (step 6) and
reached only by processes on this same instance, matching this repo's
own private-networking rule (`docs/architecture/
production-architecture.md`).

## 4. Base packages, Node, pnpm, Docker, Nginx, certbot

```bash
sudo apt update && sudo apt upgrade -y

# Swap — a real safety net against the OOM killer during a build (see
# step 1's sizing math), especially on a 2 GB plan. 2 GB swap file:
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node 20 LTS (matches root package.json's "engines": ">=20.0.0" and
# infrastructure/docker/api.Dockerfile's node:20-alpine — this repo has
# only ever been built/tested against Node 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm, matching root package.json's "packageManager": "pnpm@9.15.9"
sudo corepack enable
corepack prepare pnpm@9.15.9 --activate

# Docker + Compose plugin (runs Postgres/Redis — step 6)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # picks up the docker group in this shell without a re-login

# Nginx + certbot (used in docs/deployment/domain-and-dns.md)
sudo apt install -y nginx certbot python3-certbot-nginx

# pm2 (process manager for the 4 Node processes — step 8)
sudo npm install -g pm2

# git, to pull the repo
sudo apt install -y git
```

Verify versions before moving on — a mismatched Node/pnpm version is a
confusing place to debug later:

```bash
node --version    # v20.x
pnpm --version    # 9.15.9
docker --version
nginx -v
certbot --version
pm2 --version
```

## 5. Get the repo onto the instance

```bash
git clone <your repo URL> shri-anandam-app
cd shri-anandam-app
```

If the repo is private, either set up a deploy key (GitHub → repo →
Settings → Deploy keys, generate a keypair on the instance with
`ssh-keygen`, add the public half there) or clone over HTTPS with a
GitHub personal access token. Either way, do this once — every future
deploy is `git pull` (step 10), not a fresh clone.

## 6. Configure secrets

```bash
cp .env.example .env
nano .env   # or vim — fill in every blank value
```

Fill in for real (never commit this file — `.gitignore` already
excludes it):

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — 32+ random bytes each,
  e.g. `openssl rand -base64 32` run twice (must be different from
  each other)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`
  — the new production-only vars (see `.env.example`'s comment).
  **Generate these alphanumeric-only** (e.g.
  `tr -dc A-Za-z0-9 </dev/urandom | head -c 32`), not `openssl rand
  -base64` — both values get embedded directly in a `postgresql://`/
  `redis://` connection-string URL below, and base64's `+`, `/`, `=`
  characters aren't all URL-safe. Caught live: `ioredis`'s strict
  WHATWG `URL` parser rejected a base64 `REDIS_PASSWORD` outright
  (`TypeError: Invalid URL`) the first time this was deployed —
  Postgres's own URL parsing happened to tolerate it, which is worse,
  not better, since it meant only Redis failed loudly.
- `DATABASE_URL` — build it from the `POSTGRES_*` values above, using
  the **standard port 5432** (not the dev remap 55433):
  `postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@127.0.0.1:5432/<POSTGRES_DB>?schema=public`
- `REDIS_URL` — from `REDIS_PASSWORD`, standard port 6379:
  `redis://:<REDIS_PASSWORD>@127.0.0.1:6379`
- `APP_URL=https://api.shrianandamsweets.in`
- `CORS_ALLOWED_ORIGINS=https://admin.shrianandamsweets.in,https://kitchen.shrianandamsweets.in`
- `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` — the same
  real Firebase service-account values already verified working
  earlier this session (not placeholders — copy your actual `.env`'s
  values across, don't regenerate)
- `SMS_API_KEY`, `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/
  `RAZORPAY_WEBHOOK_SECRET`, `S3_*` — real production credentials for
  each provider (out of scope here — provision each service's own
  production account/keys separately)
- `NODE_ENV=production`

## 7. Start Postgres + Redis

```bash
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file .env up -d
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file .env ps   # both should show "healthy" within ~10s
```

## 8. Install, build, migrate

```bash
pnpm install --frozen-lockfile

# Prisma client + schema — generate BEFORE deploy, always, even right
# after a `pnpm install` that reported "Already up to date". pnpm skips
# a package's lifecycle scripts (including @prisma/client's own
# postinstall, which is what normally regenerates the client) when
# nothing about that package's install state changed — it has no way to
# know schema.prisma itself changed, so an unmodified lockfile silently
# leaves a stale client in place regardless of how recent the schema
# edit is. `prisma migrate deploy` itself never regenerates the client
# either (it only applies SQL) — caught live redeploying a real schema
# change: skipped this exact step once, and `prisma:seed` immediately
# after failed with "Module '@prisma/client' has no exported member
# 'ProductUnit'" (a type that schema change had just added).
pnpm --filter @shri-anandam/api prisma:generate
pnpm --filter @shri-anandam/api prisma:deploy   # applies migrations — never `prisma migrate dev` in production

# The shared packages FIRST — services/api and both Next.js apps import
# @shri-anandam/shared-types and @shri-anandam/validation, and those
# packages need their own `dist/` built before anything that imports
# them will typecheck. Skipping this produces "Cannot find module
# '@shri-anandam/shared-types'" from services/api's build — caught live
# deploying this exact doc, not hypothesized.
pnpm -r --filter='./packages/*' build

# Then every app that needs building (apps/customer-mobile and
# apps/owner-mobile don't deploy here at all — they're native apps
# built separately via EAS)
pnpm --filter @shri-anandam/api build
pnpm --filter @shri-anandam/notification-worker build
pnpm --filter @shri-anandam/admin-web build
pnpm --filter @shri-anandam/kitchen-web build
```

**Before building `admin-web`/`kitchen-web` — check for a stray
`.env.local`.** `NEXT_PUBLIC_API_URL` is baked into the JS bundle at
**build time**, not read at runtime — if either app has an
`apps/*/.env.local` left over from local development (e.g. from
`rsync`-ing a working tree instead of a clean `git clone`/`git pull`,
which is exactly how this shipped wrong the first time this was
deployed), Next.js loads `.env.local` at a **higher priority than any
other env source**, including a real value you `export`ed in the
shell — so the build silently bakes in `http://localhost:4000/api/v1`
and every request from a real browser fails with
`net::ERR_CONNECTION_REFUSED` against `localhost:4000`, invisible from
the server side (`curl` from the instance itself has no such file
problem, so every server-side health check looks perfectly fine while
the deployed browser bundle is completely broken — this exact gap
shipped once and was only caught from a live browser's DevTools
Console, not from anything on the server).

```bash
# Before each build, from the repo root:
for app in admin-web kitchen-web; do
  echo "NEXT_PUBLIC_API_URL=https://api.shrianandamsweets.in/api/v1" > apps/$app/.env.local
done
```

Verify it actually landed in the compiled output before moving on —
don't just trust the file was read correctly:

```bash
grep -rl "localhost:4000" apps/admin-web/.next/static apps/kitchen-web/.next/static
# should print nothing; if it prints a file, the build picked up the
# wrong value — fix .env.local and rebuild that app
```

## 9. Set up the app processes with pm2

```bash
pm2 start infrastructure/pm2/ecosystem.config.js
pm2 status   # all 4 should show "online" — if any shows "errored", check `pm2 logs <name>`
```

Smoke-test before moving to DNS/Nginx:

```bash
curl http://localhost:4000/health    # {"success":true,"data":{"status":"ok",...
curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/login   # 200
curl -o /dev/null -w "%{http_code}\n" http://localhost:3001/login   # 200
pm2 logs shri-anandam-notification-worker --lines 5 --nostream   # "Database connection established"
```

**These 4 checks only prove each process boots and serves a page — none
of them would have caught the `NEXT_PUBLIC_API_URL` bug from step 8**
(a `curl` to `/login` gets `200` whether the page's JS calls the real
API or `localhost:4000` — the difference only shows up when a real
browser runs that JS). Once DNS/TLS are live (step 10), the real
end-to-end check is: open the deployed site in an actual browser, log
in, and watch DevTools' Network tab for any request going to
`localhost` instead of the real domain — or repeat step 8's
`grep -rl "localhost:4000"` check against the deployed `.next/static`
directory.

Persist across reboots:

```bash
pm2 save
pm2 startup   # prints a sudo command — copy/paste and run it, one-time
```

## 10. Domain, Nginx, TLS

Continue with `docs/deployment/domain-and-dns.md` from here — DNS
records, the Nginx reverse-proxy config, and certbot.

## 11. Redeploying after a code change

```bash
cd shri-anandam-app
git pull   # a real `git pull` here never recreates the .env.local
           # problem below — that only happened once, from an rsync
           # deploy that copied a local working tree wholesale. Still
           # worth the grep check if apps/*/.env.local exists for any
           # other reason (e.g. someone testing something on the box).
pnpm install --frozen-lockfile
pnpm --filter @shri-anandam/api prisma:generate
pnpm --filter @shri-anandam/api prisma:deploy
pnpm -r --filter='./packages/*' build   # see step 8 — required before the services/apps below
pnpm --filter @shri-anandam/api build
pnpm --filter @shri-anandam/notification-worker build
pnpm --filter @shri-anandam/admin-web build
pnpm --filter @shri-anandam/kitchen-web build
grep -rl "localhost:4000" apps/admin-web/.next/static apps/kitchen-web/.next/static   # see step 8 — must print nothing
pm2 reload infrastructure/pm2/ecosystem.config.js   # zero-downtime reload, not restart
```

## Real bugs this doc's own verification caught (fixed, not just noted)

Writing this doc meant actually running the deploy path against a real
build, not just describing it — several things broke that would have
silently failed on the real instance otherwise:

- **`services/notification-worker`'s production `start` script never
  loaded `.env`.** Only `start:dev` did (`ts-node -r dotenv/config`);
  `start` was plain `node dist/main.js`, and the worker reads
  `DATABASE_URL` etc. straight from `process.env` with no `@nestjs/
  config`-style fallback. On a machine with nothing pre-exporting those
  vars, this would crash immediately with "DATABASE_URL is required."
  `dotenv` was also only a `devDependency`, so a production-only
  install (`pnpm install --prod`) wouldn't even have the package
  available. Fixed: `start` is now `node -r dotenv/config dist/main.js`,
  and `dotenv` moved to `dependencies`. Verified live: ran the exact
  fixed command, watched it load `.env` via its symlink to the repo
  root, connect to a real Postgres, and process real outbox rows.
- **pm2 couldn't start either Next.js app.** Pointing pm2's `script` at
  `node_modules/.bin/next` (the natural choice — it's what `pnpm dev`/
  `pnpm start` resolve to) fails, because that file is a POSIX shell
  script, and pm2's fork mode runs `script` through Node directly with
  no shebang detection — `SyntaxError: missing ) after argument list`
  trying to parse shell as JS. Fixed: point at Next's actual CLI entry,
  `node_modules/next/dist/bin/next` (real JS, has a `#!/usr/bin/env
  node` shebang). Verified live: both admin-web and kitchen-web came up
  under pm2 and served real `200`s.
- **`packages/*` needed an explicit build step before `services/api`
  would even compile** — `tsc` failed with "Cannot find module
  '@shri-anandam/shared-types'" until `packages/shared-types`,
  `packages/validation`, and `packages/config` were built first (their
  own `dist/`). Not obvious from the root `package.json`'s own `build`
  script, which does this automatically via a `--filter` glob covering
  both — easy to miss when running each app's build individually, which
  is what this doc originally did. Now step 8 does it explicitly, first.
- **The real REDIS_PASSWORD-in-a-URL bug** — see the warning under step
  6 above; `ioredis`'s strict URL parser rejected a base64-generated
  password containing `+`/`/` outright, crashing `services/api` on
  every boot (`TypeError: Invalid URL`) until the password was
  regenerated alphanumeric-only and the Redis container recreated to
  pick it up.
- **`NEXT_PUBLIC_API_URL` silently baked in as `localhost:4000`** — see
  the warning under step 8 above. This one didn't show up in any
  server-side check (every `curl`, every `pm2 logs`, every `/health`
  looked completely fine) — it only surfaced when the site was actually
  opened in a real browser and every data-fetching request failed with
  `net::ERR_CONNECTION_REFUSED` against `localhost:4000`. Root cause: an
  `apps/admin-web/.env.local`/`apps/kitchen-web/.env.local` left over
  from local development (copied over by an `rsync`-based deploy, not
  present in git) took priority over the real value at build time.
  Fixed by overwriting both files with the real production URL,
  rebuilding, and confirming via `grep` against the compiled
  `.next/static` output — then confirming a second time against the
  actual JS chunks served over the live public domain, since a build
  artifact check alone doesn't prove what's actually being served.
