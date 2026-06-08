import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

/**
 * Single Supabase browser client for the app. URL + anon key come from Vite env
 * (`.env.local` locally, hosting env vars in production). The anon key is safe
 * to ship to the browser — Row-Level Security governs what it can read/write.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // Surfaced loudly in dev; in prod the build should always inject these.
  console.error(
    'Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'in .env.local (run `supabase start` then `supabase status` for local values).',
  )
}

export const supabase = createClient<Database>(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,   // completes magic-link / OAuth redirects
    flowType: 'pkce',
  },
})
