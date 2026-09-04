// pm2 process manager config for a single-instance deploy (e.g. the AWS
// Lightsail setup in docs/deployment/aws-lightsail-setup.md).
//
// Why pm2 and not Docker for these 4: only services/api has a Dockerfile
// today (infrastructure/docker/api.Dockerfile) — apps/admin-web,
// apps/kitchen-web, and services/notification-worker don't yet. pm2 is
// the pragmatic way to keep all 4 Node processes running, restarted on
// crash, and started on boot without writing 3 more Dockerfiles first.
// Postgres/Redis still run in Docker (docker-compose.prod.yml) — this
// file only manages the 4 Node processes that talk to them.
//
// Run from the repo root:
//   pm2 start infrastructure/pm2/ecosystem.config.js
//   pm2 save && pm2 startup   # persist across reboots — see the setup doc
//
// Each app's `cwd` is set explicitly, matching how each one already
// resolves its own .env: services/api and services/notification-worker
// each have a `.env` symlinked to the repo root's real one
// (`services/api/.env -> ../../.env`) — @nestjs/config (api) and the
// `-r dotenv/config` node flag (notification-worker, added specifically
// so its production `start` script — not just start:dev — loads .env;
// see the fix alongside this file) both resolve `.env` from cwd, so
// running pm2 from anywhere still finds the right file as long as `cwd`
// below stays correct. admin-web/kitchen-web read NEXT_PUBLIC_API_URL
// baked in at `next build` time (see their own .env.local at build time,
// not at pm2-start time — rebuild, don't just restart, after changing
// NEXT_PUBLIC_API_URL).

module.exports = {
  apps: [
    {
      name: "shri-anandam-api",
      cwd: "services/api",
      script: "dist/main.js",
      env: { NODE_ENV: "production" },
      max_memory_restart: "500M",
    },
    {
      name: "shri-anandam-notification-worker",
      cwd: "services/notification-worker",
      script: "dist/main.js",
      node_args: "-r dotenv/config",
      env: { NODE_ENV: "production" },
      max_memory_restart: "250M",
    },
    {
      // node_modules/.bin/next is a POSIX shell shim, not a Node file —
      // pm2's fork mode runs `script` through Node directly (no shebang
      // detection), so pointing it at the shim throws "SyntaxError:
      // missing ) after argument list" trying to parse shell as JS
      // (caught live running this config, not assumed). Point straight
      // at Next's real CLI entry (which does have a `#!/usr/bin/env
      // node` shebang and is plain JS) instead.
      name: "shri-anandam-admin-web",
      cwd: "apps/admin-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
    },
    {
      name: "shri-anandam-kitchen-web",
      cwd: "apps/kitchen-web",
      script: "node_modules/next/dist/bin/next",
      // -p 3001 matches apps/kitchen-web/package.json's own start
      // script and infrastructure/nginx/shri-anandam.conf's proxy_pass —
      // keep all 3 in sync if this ever changes.
      args: "start -p 3001",
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
    },
  ],
};
