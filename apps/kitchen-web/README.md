# Shri Anandam Kitchen

Installable PWA order queue for kitchen/counter staff (Phase 10). One
screen: active orders (PENDING/ACCEPTED/PREPARING/READY), large
touch-friendly cards, a sound alert on new orders, and a per-order
detail screen with the same permission-gated status-transition actions
as `apps/owner-mobile`/`apps/admin-web`. See the root `README.md`'s
"Running the kitchen PWA" section and `docs/architecture/decisions.md`
ADR-022 for the polling-until-Phase-11-WebSockets rationale and a couple
of real ordering bugs this screen's requirements surfaced.

```bash
cp .env.example .env.local
pnpm dev
```
