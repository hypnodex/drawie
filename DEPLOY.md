# Deploying Drawie2

The app is a static SPA (Vite) + a Supabase backend (Postgres, Auth, Realtime,
Storage, Edge Functions). Local dev runs against `npx supabase start`. This
runbook takes it to a hosted Supabase Cloud project + a Vercel/Netlify frontend
so shared private-canvas links work for real people over the internet.

You'll run these — they need your accounts/credentials (I can't create those).

## 1. Create the hosted Supabase project
1. https://supabase.com/dashboard → **New project**. Note the **project ref**
   (in the URL), the **anon key**, and the **service-role key** (Settings → API).

## 2. Link + push the schema, seed, and functions
```bash
npx supabase login                      # opens browser for an access token
npx supabase link --project-ref <REF>
npx supabase db push                    # applies supabase/migrations/* to the cloud DB
# Optional demo data (skip for a clean prod DB):
#   psql "<connection string from dashboard>" -f supabase/seed.sql
npx supabase functions deploy moderate composite-mosaic
npx supabase secrets set OPENAI_API_KEY=sk-...   # the moderation key (server-side)
```
`composite-mosaic` automatically gets `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Configure Auth (dashboard → Authentication)
- **Providers → Email**: enable (magic link). **Anonymous sign-ins**: enable
  (Settings → ensure "Allow anonymous sign-ins" is on — required for guest joins).
- **Providers → Google**: enable; paste a Google OAuth **client id + secret**
  (create at https://console.cloud.google.com → Credentials → OAuth client →
  Web). Authorized redirect URI: `https://<REF>.supabase.co/auth/v1/callback`.
- **URL Configuration**: set **Site URL** to your deployed app origin
  (e.g. `https://drawie.vercel.app`) and add it (plus `http://localhost:5173`)
  to **Redirect URLs**.

## 4. Deploy the frontend (Vercel example)
1. Import the repo at https://vercel.com (framework auto-detected as Vite).
2. **Environment variables**:
   - `VITE_SUPABASE_URL` = `https://<REF>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = the anon key
   - Do **not** set `VITE_DEV_IMPERSONATE` in prod (leave it off — no demo personas).
3. Deploy. SPA routing is already handled by `vercel.json` (and `public/_redirects`
   for Netlify), so deep links like `/join/<token>` resolve on hard load.

## 5. Smoke test in production
- Open the site → sign in via magic link and via Google.
- Create a **private** canvas → copy the guest link → open it on another device
  / incognito (joins as anonymous guest) → confirm the **host console shows them
  join live**, tile status updates in real time, and completing all tiles reveals
  the composited mosaic.
- Draw + submit a tile with disallowed content → confirm it's blocked (moderation
  Edge Function); the OpenAI key is not in the client bundle.

## Notes / follow-ups
- Anonymous users accumulate (one per guest-link open). Add a periodic cleanup
  (pg_cron) of anonymous users with no tiles, and enable CAPTCHA on the anonymous
  endpoint if abused.
- `profiles.is_premium` is currently self-updatable (demo toggle). Before charging
  for premium, gate it behind a billing webhook + a column guard.
- Regenerate types after any schema change:
  `npx supabase gen types typescript --project-id <REF> > src/types/database.ts`.
