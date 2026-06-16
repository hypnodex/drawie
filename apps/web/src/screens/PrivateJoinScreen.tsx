import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { Surface } from '@/components/ui/Surface'
import DrawingScreen from './DrawingScreen'
import { supabase } from '@drawie/data'
import { useAuth } from '../state/AuthContext'
import { joinPrivateCanvas } from '@drawie/data'
import { getTilesForCanvas, completeTileAndMaybeReveal, uploadTileArtwork } from '@drawie/data'
import { MosaicProgress } from '../components/canvas/MosaicProgress'
import { Heading } from '../components/ui/Heading'
import { Eyebrow } from '../components/ui/Eyebrow'
import type { Canvas, Tile } from '@drawie/data'

type Phase = 'form' | 'joining' | 'drawing' | 'done' | 'error'

const guestStoreKey = (token: string) => `drawie.guest.${token}`

function mapErr(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('INVALID_TOKEN')) return 'This invite link is not valid.'
  if (msg.includes('TILE_UNAVAILABLE')) return 'This canvas is full — every artboard is taken.'
  return msg || 'Could not join this canvas.'
}

/**
 * Guest entry for a private canvas (`/join/:guestToken`). A new guest first
 * gives their name + email (no account needed); we then sign them in
 * anonymously, set that name on their profile, assign an artboard, and let them
 * draw. They stay signed in as that guest afterward. Returning guests (or
 * logged-in users) skip the form and go straight to their tile — or to the live
 * mosaic if they've already submitted. On submit, a confirmation email with a
 * link back to the mosaic is sent (best-effort).
 */
export default function PrivateJoinScreen() {
  const { guestToken = '' } = useParams()
  const nav = useNavigate()
  const { refreshUser } = useAuth()

  const [phase, setPhase] = useState<Phase>('joining')
  const [canvas, setCanvas] = useState<Canvas | null>(null)
  const [tile, setTile] = useState<Tile | null>(null)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const emailRef = useRef('')
  const nameRef = useRef('')
  const started = useRef(false)

  // Resolve the token, assign/return a tile, and route to drawing or (if already
  // submitted) the live mosaic.
  const doJoin = useCallback(async () => {
    const res = await joinPrivateCanvas(guestToken)
    const ts = await getTilesForCanvas(res.canvas.id)
    setCanvas(res.canvas); setTile(res.tile); setTiles(ts)
    setPhase(res.tile.status === 'completed' ? 'done' : 'drawing')
  }, [guestToken])

  useEffect(() => {
    if (!guestToken || started.current) return
    started.current = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const saved = localStorage.getItem(guestStoreKey(guestToken))
        const realUser = data.session && !data.session.user.is_anonymous
        if (realUser) {
          emailRef.current = data.session?.user.email ?? ''
          await doJoin()
        } else if (saved) {
          try { const o = JSON.parse(saved); emailRef.current = o.email || ''; nameRef.current = o.name || '' } catch { /* ignore */ }
          await doJoin()
        } else {
          setPhase('form')   // new guest → collect name + email
        }
      } catch (e) {
        setErrorMsg(mapErr(e)); setPhase('error')
      }
    })()
  }, [guestToken, doJoin])

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setPhase('joining'); setErrorMsg('')
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously()
        if (error) throw new Error(error.message)
      }
      const { data: s2 } = await supabase.auth.getSession()
      if (s2.session) {
        await supabase.from('profiles').update({ name: name.trim() }).eq('id', s2.session.user.id)
      }
      emailRef.current = email.trim()
      nameRef.current = name.trim()
      localStorage.setItem(guestStoreKey(guestToken), JSON.stringify({ name: name.trim(), email: email.trim() }))
      await refreshUser()       // header now shows the guest's chosen name
      await doJoin()
    } catch (err) {
      setErrorMsg(mapErr(err)); setPhase('error')
    }
  }

  if (!guestToken) return <Panel title="Invalid link" body="This invite link is not valid." />
  if (phase === 'error') return <Panel title="Couldn't join" body={errorMsg} action={{ label: 'Back to start', onPress: () => nav('/') }} />
  if (phase === 'form') {
    return (
      <Centered>
        <Surface variant="secondary" className="rounded-[var(--radius)] p-8 max-w-md w-full text-left">
          <div className="text-center">
            <Eyebrow variant="dot">Private canvas</Eyebrow>
            <Heading level={1} size="md" className="mt-2">You're invited to draw</Heading>
            <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
              Add your name and email — no account needed. You'll get an artboard to draw, and an
              email link to watch the finished mosaic.
            </p>
          </div>
          <form onSubmit={submitForm} className="mt-6 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Name</label>
              <input
                type="text" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="h-11 px-3 rounded-xl bg-[var(--surface)] text-sm text-[var(--foreground)] border border-[var(--separator)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 px-3 rounded-xl bg-[var(--surface)] text-sm text-[var(--foreground)] border border-[var(--separator)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <Button type="submit" variant="default" className="mt-1 w-full">
              Join &amp; start drawing →
            </Button>
          </form>
        </Surface>
      </Centered>
    )
  }
  if (phase === 'joining') {
    return <Centered><Spinner size="lg" /><p className="mt-4 text-sm text-[var(--muted)]">Joining…</p></Centered>
  }
  if (phase === 'done' && canvas) {
    return <MosaicProgress canvas={canvas} myTileId={tile?.id} onLeave={() => nav('/')} />
  }
  if (!canvas || !tile) return <Panel title="Something went wrong" body="Your artboard could not be loaded." />

  return (
    <DrawingScreen
      canvas={canvas}
      tile={tile}
      tiles={tiles}
      sessionKey={`drawie.session.${canvas.id}.${tile.id}.v1`}
      onSubmit={async (image) => {
        let path: string | undefined
        if (image) { try { path = await uploadTileArtwork(canvas.id, tile.id, image) } catch { /* keep going */ } }
        try { await completeTileAndMaybeReveal(canvas.id, tile.id, path) } catch { /* ignore */ }
        // Best-effort confirmation email with a link back to the mosaic.
        if (emailRef.current) {
          const link = `${window.location.origin}/join/${guestToken}`
          void supabase.functions.invoke('send-mosaic-email', {
            body: { email: emailRef.current, name: nameRef.current || undefined, canvasTitle: canvas.title, link },
          })
        }
        setPhase('done')
      }}
      onLeave={() => nav('/')}
    />
  )
}

// ── Panels ────────────────────────────────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-[var(--background)]">
      {children}
    </div>
  )
}

function Panel({ title, body, action }: { title: string; body: string; action?: { label: string; onPress: () => void } }) {
  return (
    <Centered>
      <Surface variant="secondary" className="rounded-[var(--radius)] p-8 max-w-md">
        <Heading level={1} size="md">{title}</Heading>
        <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">{body}</p>
        {action && (
          <Button variant="default" className="mt-6" onClick={action.onPress}>{action.label}</Button>
        )}
      </Surface>
    </Centered>
  )
}
