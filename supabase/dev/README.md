# supabase/dev — test-only SQL (NOT in the production migration chain)

Scripts here are applied **manually to a local / test stack only**. They must never live in
`supabase/migrations/` — a `supabase db push` would otherwise carry them to production.

## `claim_tile_allow_multiple.dev.sql`

Relaxes the `claim_tile` RPC so ONE account can claim MANY tiles per canvas — needed for fast
single-account testing (e.g. the realtime neighbor slivers, where one person draws two adjacent
tiles). **Production enforces one tile per user per canvas**
(`migrations/20260615000000_claim_tile_one_per_user.sql`).

Apply locally **after** a reset:

```bash
npx supabase db reset                 # rebuilds local DB from the prod chain (= one-tile)
psql "$LOCAL_DB_URL" -f supabase/dev/claim_tile_allow_multiple.dev.sql   # opt-in multi-tile
# $LOCAL_DB_URL e.g. postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Pair it with the frontend flag for local dev:
- web `apps/web/.env.local`: `VITE_ENFORCE_ONE_TILE_PER_USER=false`
- native `apps/native/.env`: `EXPO_PUBLIC_ENFORCE_ONE_TILE_PER_USER=false`
  (only meaningful when native points at a local/staging stack — against hosted-prod the DB
  enforces one-tile regardless).

## One-time hosted remediation (do at the Phase-0 merge/redeploy)

The relaxation **leaked to the hosted prod DB** — `20260611000000` appears in the *Remote*
migration list. To restore one-tile on hosted and clean up the history (requires the hosted DB
password):

```bash
npx supabase db push                                             # applies 20260615 → hosted one-tile
npx supabase migration repair --status reverted 20260611000000   # drop the moved relaxation from remote history
```

`db push` alone already makes hosted one-tile (the forward migration re-creates the function);
the `migration repair` only realigns the remote history with the local files (the relaxation
file moved out of `migrations/`).
