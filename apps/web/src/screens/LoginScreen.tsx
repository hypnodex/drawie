import { useState } from 'react'
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '../components/ui/ButtonLink'
import { useAuth } from '../state/AuthContext'
import { Avatar } from '../components/ui/Avatar'
import { Heading } from '../components/ui/Heading'

/**
 * Sign-in: passwordless email magic-link, Google OAuth, or anonymous guest.
 * In dev, the seeded demo personas remain as a one-click quick switch.
 *
 * Phase 2 (shadcn migration): direct HeroUI usage (Button/Chip/Spinner/Surface) swapped for
 * shadcn Button/Badge/Input + a styled panel; layout/structure preserved. The local ButtonLink/
 * Avatar/Heading wrappers are migrated in their own pass.
 */
export default function LoginScreen() {
  const { users, login, signInWithEmail, signInWithGoogle, signInAsGuest } = useAuth()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: { pathname: string } } }
  const redirectTo = loc.state?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const onMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy('email'); setError('')
    const { error } = await signInWithEmail(email.trim())
    setBusy(null)
    if (error) setError(error)
    else setSent(true)
  }

  const onGoogle = async () => {
    setBusy('google'); setError('')
    const { error } = await signInWithGoogle()
    if (error) { setError(error); setBusy(null) }
    // success → browser redirects to Google
  }

  const onGuest = async () => {
    setBusy('guest'); setError('')
    const { error } = await signInAsGuest()
    setBusy(null)
    if (error) setError(error)
    else nav(redirectTo, { replace: true })
  }

  const onPersona = async (id: string) => {
    setBusy(`persona:${id}`)
    await login(id)
    nav(redirectTo, { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[var(--radius)] overflow-hidden bg-secondary text-secondary-foreground">
          <div className="p-8 text-center">
            <RouterLink to="/" className="inline-flex items-center gap-2.5 mb-6" aria-label="Drawie">
              <span className="flex items-center gap-[3px]" aria-hidden>
                <span className="w-2 h-2 rounded-full bg-[var(--foreground)]" />
                <span className="w-2 h-2 rounded-full bg-[var(--foreground)]" />
                <span className="w-2 h-2 rounded-full bg-[var(--foreground)]" />
              </span>
              <span className="text-base font-extrabold tracking-tight text-[var(--foreground)]">
                Drawie<sup className="text-[10px] text-[var(--muted)] ml-0.5">®</sup>
              </span>
            </RouterLink>

            {sent ? (
              <>
                <Heading level={1} size="md">Check your email</Heading>
                <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
                  We sent a sign-in link to <span className="font-bold text-[var(--foreground)]">{email}</span>.
                  Open it on this device to finish signing in.
                </p>
                <button
                  type="button"
                  onClick={() => { setSent(false); setEmail('') }}
                  className="mt-5 text-xs font-mono text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  ← Use a different method
                </button>
              </>
            ) : (
              <>
                <Heading level={1} size="md">Sign in to Drawie</Heading>
                <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
                  Join a canvas, save your work, and collaborate in real time.
                </p>

                <form onSubmit={onMagicLink} className="mt-6 flex flex-col gap-2 text-left">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Email</label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-11"
                  />
                  <Button type="submit" className="w-full" disabled={busy !== null}>
                    {busy === 'email' ? <Loader2 className="size-4 animate-spin" /> : 'Send magic link'}
                  </Button>
                </form>

                <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  <span className="h-px flex-1 bg-[var(--separator)]" /> or <span className="h-px flex-1 bg-[var(--separator)]" />
                </div>

                <div className="flex flex-col gap-2">
                  <Button variant="secondary" className="w-full" onClick={onGoogle} disabled={busy !== null}>
                    {busy === 'google' ? <Loader2 className="size-4 animate-spin" /> : 'Continue with Google'}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={onGuest} disabled={busy !== null}>
                    {busy === 'guest' ? <Loader2 className="size-4 animate-spin" /> : 'Continue as guest'}
                  </Button>
                </div>

                {error && <p className="mt-4 text-xs text-[var(--danger)]">{error}</p>}
              </>
            )}
          </div>

          {/* Dev-only persona quick switch. */}
          {users.length > 0 && !sent && (
            <div className="border-t border-[var(--separator)]">
              <p className="px-7 pt-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Dev personas
              </p>
              <ul className="px-4 py-3 flex flex-col gap-1.5">
                {users.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => onPersona(u.id)}
                      disabled={busy !== null}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-tertiary)] active:scale-[0.99] transition text-left disabled:opacity-50"
                    >
                      <Avatar user={u} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-[var(--foreground)]">{u.name}</span>
                          {u.isPremium && <Badge>Pro</Badge>}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--muted)] mt-0.5 tabular-nums">
                          {u.completedTilesCount} completed · {u.contributedCanvasIds.length} canvases
                        </div>
                      </div>
                      <span className="text-base text-[var(--foreground)]">→</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="px-7 py-4 text-center bg-[color-mix(in_oklab,var(--accent)_20%,var(--surface-secondary))]">
            <ButtonLink to="/" variant="ghost" size="sm" className="font-mono text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)]">
              Continue browsing without signing in →
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  )
}
