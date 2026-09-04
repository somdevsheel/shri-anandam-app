# Shri Anandam Admin Web

Staff-facing business management panel (Phase 9) — dashboard, orders,
products, inventory, customers, staff & role/permission management, and
payment reconciliation reports. See the root `README.md`'s "Running the
admin web app" section and `docs/architecture/decisions.md` ADR-020/021
for how auth is wired up and why.

```bash
cp .env.example .env.local
pnpm dev
```

Next.js App Router + Tailwind v4 + TanStack Query, talking directly to
`services/api`. No generated client yet (`packages/api-client` is still
empty) — response shapes are hand-written in `src/lib/types.ts` against
the actual verified API, same approach the mobile apps use.
