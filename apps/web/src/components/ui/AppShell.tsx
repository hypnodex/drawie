import { useState } from 'react'
import { Outlet, Link as RouterLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Nav } from './Nav'
import { Eyebrow } from './Eyebrow'

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Nav />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

// ── Footer data ───────────────────────────────────────────────────────────────

const FOOTER_COLS = [
  {
    heading: 'Product',
    links: [
      { label: 'Discover',      to: '/' },
      { label: 'Create canvas', to: '/create-canvas' },
      { label: 'Premium',       to: '/premium' },
      { label: 'Dashboard',     to: '/dashboard' },
    ],
  },
  {
    heading: 'Explore',
    links: [
      { label: 'Open canvases',     to: '/' },
      { label: 'Almost done',       to: '/' },
      { label: 'Completed gallery', to: '/' },
      { label: 'Trending',          to: '/' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About',           to: '/' },
      { label: 'Blog',            to: '/' },
      { label: 'Privacy policy',  to: '/' },
      { label: 'Terms of service',to: '/' },
    ],
  },
]

// ── Footer ────────────────────────────────────────────────────────────────────

function SiteFooter() {
  return (
    <footer className="mt-20 bg-[var(--surface-secondary)]">
      <Separator />

      {/* top — brand + newsletter */}
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 pt-12 pb-10 grid gap-10 md:grid-cols-2 md:items-start">
        {/* brand */}
        <div className="max-w-sm">
          <RouterLink to="/" className="inline-flex items-center gap-2.5 group" aria-label="Drawie home">
            <span className="flex items-center gap-[3px]" aria-hidden>
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--foreground)]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--foreground)]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--foreground)] transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-[var(--foreground)]">
              Drawie<sup className="text-[10px] text-[var(--muted)] ml-0.5">®</sup>
            </span>
          </RouterLink>
          <p className="mt-4 text-sm text-[var(--muted)] leading-relaxed">
            A collaborative mosaic platform where every tile is drawn by a
            different person. One canvas. Many hands. One artwork.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <SocialLink href="/" label="Twitter / X">
              <path d="M4 4l16 16M4 20L20 4" />
            </SocialLink>
            <SocialLink href="/" label="Instagram">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </SocialLink>
            <SocialLink href="/" label="GitHub">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </SocialLink>
          </div>
        </div>

        {/* newsletter */}
        <div>
          <Eyebrow variant="dot" className="mb-3">Stay in the loop</Eyebrow>
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-5 max-w-sm">
            New canvases, community picks, and feature updates — straight to
            your inbox. No noise, unsubscribe anytime.
          </p>
          <NewsletterForm />
        </div>
      </div>

      <Separator />

      {/* middle — link columns */}
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-10 grid grid-cols-2 sm:grid-cols-3 gap-8">
        {FOOTER_COLS.map((col) => (
          <div key={col.heading}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--foreground)] mb-4">
              {col.heading}
            </p>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  <RouterLink
                    to={link.to}
                    className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    {link.label}
                  </RouterLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Separator />

      {/* bottom bar */}
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-5 flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>© 2026 Drawie · All rights reserved</Eyebrow>
        <Eyebrow variant="index">v 0.1.0 / demo</Eyebrow>
      </div>
    </footer>
  )
}

// ── Newsletter form ───────────────────────────────────────────────────────────

type FormState = 'idle' | 'sending' | 'done'

function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>('idle')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || state !== 'idle') return
    setState('sending')
    // Simulate network request
    setTimeout(() => {
      setState('done')
      setEmail('')
    }, 900)
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-3 py-3 px-4 rounded-[var(--radius)] bg-[color-mix(in_oklab,var(--success)_12%,transparent)]">
        <CheckCircleIcon className="shrink-0 text-[var(--success)]" />
        <div>
          <p className="text-sm font-bold text-[var(--foreground)]">You're in!</p>
          <p className="text-xs text-[var(--muted)]">We'll be in touch when something good happens.</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm">
      <Input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === 'sending'}
        required
        aria-label="Email address"
        className="flex-1"
      />
      <Button
        type="submit"
        disabled={state === 'sending' || !email.trim()}
      >
        {state === 'sending' ? '…' : 'Subscribe'}
      </Button>
    </form>
  )
}

// ── Micro-components ──────────────────────────────────────────────────────────

function SocialLink({
  href, label, children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="w-9 h-9 rounded-full bg-[var(--default)] hover:bg-[var(--surface)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        aria-hidden>
        {children}
      </svg>
    </a>
  )
}

function CheckCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-5" />
    </svg>
  )
}
