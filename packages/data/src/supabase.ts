import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types/database'

/**
 * Supabase client — built via a factory so web and native share ONE implementation with
 * different configs:
 *   - web:    localStorage + detectSessionInUrl (completes magic-link / OAuth in the URL)
 *   - native: AsyncStorage + detectSessionInUrl:false (OAuth/email confirm via a drawie:// deep link)
 *
 * Each platform calls `initSupabase(...)` ONCE at startup (web in main.tsx, native in App.tsx).
 * Services keep importing the `supabase` proxy below, which forwards to the initialised client —
 * so no service code changes. NOTE: this module must stay free of `import.meta` (Vite-only) so
 * Metro can bundle @drawie/data for native; env reading lives in the web entry now.
 */
export type SupabaseConfig = {
  url: string
  anonKey: string
  /** Auth session store: localStorage on web (default), AsyncStorage on native. */
  storage?: unknown
  /** web: true; native: false (no URL to parse — uses a deep link). */
  detectSessionInUrl?: boolean
  /** Enables the data layer's dev console.debug logs (web passes import.meta.env.DEV). */
  debug?: boolean
}

export function createSupabaseClient(cfg: SupabaseConfig): SupabaseClient<Database> {
  return createClient<Database>(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: cfg.detectSessionInUrl ?? true,
      flowType: 'pkce',
      ...(cfg.storage ? { storage: cfg.storage as never } : {}),
    },
  })
}

/** Live dev flag for the data layer (replaces import.meta.env.DEV, which Metro can't parse). */
export let dataDebug = false

let _client: SupabaseClient<Database> | null = null

/** Initialise the shared client. Call once at app startup, before any service runs. */
export function initSupabase(cfg: SupabaseConfig): SupabaseClient<Database> {
  if (!cfg.url || !cfg.anonKey) {
    console.error('Supabase config missing url/anonKey — auth + data calls will fail.')
  }
  dataDebug = cfg.debug ?? false
  _client = createSupabaseClient(cfg)
  return _client
}

export function getSupabase(): SupabaseClient<Database> {
  if (!_client) throw new Error('Supabase not initialised — call initSupabase(...) at app startup.')
  return _client
}

/**
 * Back-compat singleton: existing `import { supabase }` keeps working. Every access forwards to
 * the initialised client (methods bound so `this` is the client). All usage is inside functions /
 * hooks (verified), so the lazy lookup never runs before initSupabase.
 */
export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_t, prop) {
    const c = getSupabase() as unknown as Record<string | symbol, unknown>
    const v = c[prop]
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v
  },
})
