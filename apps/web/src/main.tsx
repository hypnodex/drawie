import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useHref, useNavigate } from 'react-router-dom'
import { RouterProvider } from 'react-aria-components'
import './index.css'
import { App } from './App'

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
