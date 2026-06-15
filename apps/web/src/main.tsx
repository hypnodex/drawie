import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { initSupabase, setEnforceOneTilePerUser } from '@drawie/data'
import './index.css'
import { App } from './App'

// Initialise the shared Supabase client for web (localStorage + URL-based OAuth completion).
// Native does the equivalent with AsyncStorage in apps/native. Must run before any service.
initSupabase({
  url: import.meta.env.VITE_SUPABASE_URL as string,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  detectSessionInUrl: true,
  debug: import.meta.env.DEV,
})

// One-tile-per-user is the production rule; dev/test sets VITE_ENFORCE_ONE_TILE_PER_USER=false
// to let one account claim many tiles. Unset (production) defaults to true.
setEnforceOneTilePerUser(import.meta.env.VITE_ENFORCE_ONE_TILE_PER_USER !== 'false')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
