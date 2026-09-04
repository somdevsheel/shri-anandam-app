// Jest setupFiles entry: loads services/api/.env (a symlink to the repo
// root .env in local dev) into process.env before any test file runs, so
// integration tests that talk to a real Postgres/Redis (via `new
// PrismaClient()` etc.) work the same way `pnpm test` does locally and in
// CI, where the workflow instead sets DATABASE_URL/REDIS_URL directly and
// this is a harmless no-op (dotenv never overrides an already-set var).
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
