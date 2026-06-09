// Minimal ambient typing for the two env vars this package reads, so @drawie/data
// stays self-contained (no dependency on Vite's global `vite/client` types — the
// web app provides those in its own program; native will inject env differently).
interface ImportMetaEnv {
  // App env vars this package reads.
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  // Standard Vite built-ins (mirrors `vite/client`) — used for dev-only logging.
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
  readonly BASE_URL: string
  readonly SSR: boolean
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
