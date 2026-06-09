# Deployment snapshot — pre-migration (Phase 0)

Recorded as part of Phase 0 so the live state is documented before the native-apps +
shared-core migration begins. **No secrets are stored here** — live values live in Vercel
env vars and `npx supabase status` / the Supabase dashboard.

## Frontend (Vercel)
- **Production URL:** https://drawie-xi.vercel.app
- **Hosting:** Vercel (Hobby), SPA. Auto-deploys on push to `main`.
- **SPA routing:** `vercel.json` rewrites `/(.*)` → `/index.html`; `public/_redirects` for Netlify parity.
- **Build:** `tsc -b && vite build` (Vite 5). Output `dist/`.
- **Required env vars (set in Vercel, not committed):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. `VITE_DEV_IMPERSONATE` is **off** in prod.

## Source (GitHub)
- **Remote:** `git@github.com:hypnodex/drawie.git` (`origin`)
- **Default branch:** `main`
- **Pre-migration tip (before snapshot commit):** `fe95107` "Private guest flow…"
- **Phase 0 snapshot commit (rollback anchor):** `fc2eeec` `chore: snapshot before native-core migration`
- **Backup refs:** branch `backup/pre-native-core-20260609`, tag `pre-native-core` (both → `fc2eeec`)

## Backend (Supabase Cloud)
- **Project ref:** `orsuxhtzbabmurbijofj` (region eu-west-1)
- **Surface:** Postgres + Auth (Email magic-link, Anonymous, Google) + Realtime + Storage (`tiles` bucket) + Edge Functions (`moderate`, `composite-mosaic`).
- **Server secret:** `OPENAI_API_KEY` set via `supabase secrets` (moderation; never in client bundle).
- **Schema/functions deploy:** `supabase db push` / `supabase functions deploy moderate composite-mosaic`. See [../../DEPLOY.md](../../DEPLOY.md).
- **Generated types:** `src/types/database.ts` (regenerate with `supabase gen types typescript`).

## Local backup artifacts (created in Phase 0)
Located in the repo's parent dir (`/Users/ondrej/.cursor/projects/Users-ondrej-cursor/`), outside the repo:
- `drawie2-backup-20260609.zip` — `git archive` of the `pre-native-core` tag (clean tracked source).
- `drawie2-backup-20260609/` — full folder copy **including `.git`** (excludes regenerable `node_modules/`, `dist/`).

> These local backups are **not** offsite. To get offsite recovery, push the backup branch + tag:
> `git push origin backup/pre-native-core-20260609 && git push origin pre-native-core` (not done automatically — pushing is outward-facing).
