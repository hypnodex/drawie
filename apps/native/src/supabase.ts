import 'react-native-url-polyfill/auto' // supabase-js needs a complete URL impl in RN
import AsyncStorage from '@react-native-async-storage/async-storage'
import { initSupabase, setEnforceOneTilePerUser } from '@drawie/data'

/**
 * Native Supabase init — the shared @drawie/data client configured for React Native:
 *   - storage: AsyncStorage (persists the auth session on device)
 *   - detectSessionInUrl: false (no URL; OAuth/email-confirm come back via the drawie:// deep link)
 *
 * URL + anon key come from EXPO_PUBLIC_* env (apps/native/.env, gitignored), inlined at build.
 * Importing this module at the top of App.tsx initialises the client before any service runs.
 */
export const supabase = initSupabase({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  storage: AsyncStorage,
  detectSessionInUrl: false,
  debug: __DEV__,
})

// One-tile-per-user is the production rule; dev/test sets EXPO_PUBLIC_ENFORCE_ONE_TILE_PER_USER=false
// to let one account claim many tiles. Unset (production) defaults to true.
setEnforceOneTilePerUser(process.env.EXPO_PUBLIC_ENFORCE_ONE_TILE_PER_USER !== 'false')
