import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useHref, useNavigate } from 'react-router-dom'
import { RouterProvider } from 'react-aria-components'
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

declare module 'react-aria-components' {
  interface RouterConfig {
    routerOptions: { replace?: boolean; state?: unknown }
  }
}

function AriaRouterBridge({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <RouterProvider
      navigate={(to, options) => navigate(to, options as any)}
      useHref={useHref}
    >
      {children}
    </RouterProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AriaRouterBridge>
        <App />
      </AriaRouterBridge>
    </BrowserRouter>
  </StrictMode>,
)
