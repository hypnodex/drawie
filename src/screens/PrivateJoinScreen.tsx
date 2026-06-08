import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Spinner, Surface } from '@heroui/react'
import DrawingScreen from './DrawingScreen'
import { supabase } from '../lib/supabase'
import { joinPrivateCanvas } from '../services/privateCanvasService'
import { getTilesForCanvas, completeTileAndMaybeReveal, uploadTileArtwork } from '../services/tileService'
import { Heading } from '../components/ui/Heading'
import { Eyebrow } from '../components/ui/Eyebrow'
import type { Canvas, Tile } from '../types/domain'

type Phase = 'joining' | 'drawing' | 'done' | 'error'

/**
 * Guest entry for a private canvas (`/join/:guestToken`). Signs the visitor in
 * anonymously (no account needed), resolves the token + gets assigned an
 * artboard via the join RPC (centre for the first joiner, random otherwise),
 * then drops them straight into the drawing artboard. On submit the artwork is
 * uploaded to storage and the tile marked complete.
 */
export default function PrivateJoinScreen() {
  const { guestToken = '' } = useParams()
  const nav = useNavigate()

  const [phase, setPhase] = useState<Phase>('joining')
  const [canvas, setCanvas] = useState<Canvas | null>(null)
  const [tile, setTile] = useState<Tile | null>(null)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (!guestToken || ran.current) return
    ran.current = true
    ;(async () => {
      try {
        // Ensure a session exists (anonymous guest is fine for link-only join).
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          const { error } = await supabase.auth.signInAnonymously()
          if (error) throw new Error(error.message)
        }
        const res = await joinPrivateCanvas(guestToken)
        const ts = await getTilesForCanvas(res.canvas.id)
        setCanvas(res.canvas); setTile(res.tile); setTiles(ts); setPhase('drawing')
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not join this canvas.'
        setErrorMsg(msg === 'INVALID_TOKEN' ? 'This invite link is not valid.'
          : msg === 'TILE_UNAVAILABLE' ? 'This canvas is full.' : msg)
        setPhase('error')
      }
    })()
  }, [guestToken])

  if (!guestToken) return <Panel title="Invalid link" body="This invite link is not valid." />
  if (phase === 'joining') return <Centered><Spinner size="lg" /><p className="mt-4 text-sm text-[var(--muted)]">Joining…</p></Centered>
  if (phase === 'error') return <Panel title="Couldn't join" body={errorMsg} action={{ label: 'Back to start', onPress: () => nav('/') }} />
  if (phase === 'done') return <DonePanel canvas={canvas} />

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
          <Button variant="primary" size="md" className="mt-6" onPress={action.onPress}>{action.label}</Button>
        )}
      </Surface>
    </Centered>
  )
}

function DonePanel({ canvas }: { canvas: Canvas | null }) {
  const nav = useNavigate()
  return (
    <Centered>
      <Surface variant="secondary" className="rounded-[var(--radius)] p-8 max-w-md flex flex-col items-center">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--success)] text-[var(--success-foreground)] mb-4">
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <Eyebrow variant="dot">Submitted</Eyebrow>
        <Heading level={1} size="md" className="mt-2">Your tile is in the mosaic.</Heading>
        <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
          Thanks for contributing to "{canvas?.title ?? 'this canvas'}". When everyone finishes, the full mosaic is revealed.
        </p>
        <Button variant="secondary" size="md" className="mt-6" onPress={() => nav('/')}>Done</Button>
      </Surface>
    </Centered>
  )
}
