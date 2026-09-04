// Jest setupFiles entry — loads the repo root .env (symlinked into this
// package, same pattern as services/api/test/load-env.js) so unit tests
// that touch config.ts work the same way locally and in CI (where the
// workflow sets DATABASE_URL directly and this is a harmless no-op).
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
