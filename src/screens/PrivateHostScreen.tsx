import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Chip, Spinner, Surface } from '@heroui/react'
import DrawingScreen from './DrawingScreen'
import { resolveHostToken, reassignParticipant, kickParticipant } from '../services/privateCanvasService'
import { getTilesForCanvas, claimTile, completeTileAndMaybeReveal, uploadTileArtwork } from '../services/tileService'
import { buildGuestLink, buildHostLink } from '../lib/canvasLink'
import { useRealtimeTiles } from '../hooks/useRealtimeTiles'
import { useAuth } from '../state/AuthContext'
import { Heading } from '../components/ui/Heading'
import { Eyebrow } from '../components/ui/Eyebrow'
import type { Canvas, Tile } from '../types/domain'

/**
 * Host management console (`/host/:hostToken`). Resolves the host token, shows
 * the whole mosaic and who has joined — updating LIVE via realtime as guests
 * arrive and draw — and lets the host reassign / kick / copy share links, or
 * claim an artboard and draw.
 */
export default function PrivateHostScreen() {
  const { hostToken = '' } = useParams()
  const { user } = useAuth()

  const [canvas, setCanvas] = useState<Canvas | null>(null)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const [drawingTileId, setDrawingTileId] = useState<string | null>(null)

  // Resolve the host token once → canvas (also records the caller as host).
  useEffect(() => {
    if (!hostToken) { setInvalid(true); setLoading(false); return }
    let active = true
    ;(async () => {
      try {
        const cv = await resolveHostToken(hostToken)
        const ts = await getTilesForCanvas(cv.id)
        if (active) { setCanvas(cv); setTiles(ts); setLoading(false) }
      } catch {
        if (active) { setInvalid(true); setLoading(false) }
      }
    })()
    return () => { active = false }
  }, [hostToken])

  const reloadTiles = useCallback(() => {
    if (canvas) getTilesForCanvas(canvas.id).then(setTiles).catch(() => {})
  }, [canvas])

  // Live updates — guests joining/drawing appear without a refresh.
  useRealtimeTiles(canvas?.id, reloadTiles)

  const participants = useMemo(
    () => tiles.filter((t) => t.assignedUserId).map((t) => ({
      id: t.assignedUserId!, name: t.contributorName ?? 'Guest', tileId: t.id, status: t.status,
    })),
    [tiles],
  )
  const freeTiles = useMemo(() => tiles.filter((t) => !t.assignedUserId), [tiles])
  const hostParticipant = participants.find((p) => p.id === user?.id)

  if (loading) return <Centered><Spinner size="lg" /><p className="mt-4 text-sm text-[var(--muted)]">Loading console…</p></Centered>
  if (invalid || !canvas) {
    return <Centered><Surface variant="secondary" className="rounded-[var(--radius)] p-8 max-w-md text-center">
      <Heading level={1} size="md">Invalid host link</Heading>
      <p className="mt-3 text-sm text-[var(--muted)]">This management link is not valid.</p>
    </Surface></Centered>
  }

  // ── Host drawing mode ──
  if (drawingTileId) {
    const tile = tiles.find((t) => t.id === drawingTileId)
    if (tile) {
      return (
        <DrawingScreen
          canvas={canvas}
          tile={tile}
          tiles={tiles}
          sessionKey={`drawie.session.${canvas.id}.${tile.id}.v1`}
          onSubmit={async (image) => {
            let path: string | undefined
            if (image) { try { path = await uploadTileArtwork(canvas.id, tile.id, image) } catch { /* */ } }
            try { await completeTileAndMaybeReveal(canvas.id, tile.id, path) } catch { /* */ }
            setDrawingTileId(null); reloadTiles()
          }}
          onLeave={() => { setDrawingTileId(null); reloadTiles() }}
        />
      )
    }
  }

  const origin = window.location.origin
  const guestLink = buildGuestLink(origin, canvas)
  const hostLink = buildHostLink(origin, canvas)

  const hostDraw = async () => {
    setBusy(true)
    try {
      const tile = await claimTile(canvas.id) // existing tile if already drawing, else a free one
      setDrawingTileId(tile.id)
    } catch { /* full */ }
    setBusy(false)
  }
  const onKick = async (pid: string) => { setBusy(true); try { await kickParticipant(canvas.id, pid) } catch { /* */ } reloadTiles(); setBusy(false) }
  const onReassign = async (pid: string, tileId: string) => {
    setBusy(true)
    try { await reassignParticipant(canvas.id, tileId, pid) } catch { /* taken */ }
    reloadTiles(); setBusy(false)
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-10 sm:py-14">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Eyebrow variant="dot">Host console</Eyebrow>
            <Chip color="accent" variant="primary" size="sm">Private</Chip>
          </div>
          <Heading level={1} size="lg" className="mt-3">{canvas.title}</Heading>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {canvas.gridCols} × {canvas.gridRows} mosaic · {canvas.participantCount ?? participants.length} participants ·{' '}
            {participants.length} joined
          </p>
        </div>
        <Button variant={hostParticipant ? 'secondary' : 'primary'} size="md" onPress={hostDraw} isDisabled={busy || (freeTiles.length === 0 && !hostParticipant)}>
          {hostParticipant ? 'Continue my artboard' : 'Draw an artboard'}
        </Button>
      </header>

      <div className="grid lg:grid-cols-[320px_1fr] gap-8 items-start">
        <div className="flex flex-col gap-6">
          <Surface variant="secondary" className="rounded-[var(--radius)] p-5">
            <Eyebrow className="mb-3">Share links</Eyebrow>
            <CopyField label="Guest" url={guestLink} />
            <CopyField label="Host" url={hostLink} accent />
          </Surface>

          <Surface variant="secondary" className="rounded-[var(--radius)] p-5">
            <Eyebrow className="mb-3">Mosaic</Eyebrow>
            <div className="grid gap-[3px] w-full" style={{ gridTemplateColumns: `repeat(${canvas.gridCols}, 1fr)` }}>
              {tiles.map((t) => {
                const bg = t.status === 'completed' ? 'var(--success)' : t.assignedUserId ? 'var(--accent)' : 'var(--default)'
                return (
                  <div
                    key={t.id}
                    className="aspect-square rounded-[3px] flex items-center justify-center text-[8px] font-bold text-[var(--accent-foreground)] overflow-hidden"
                    style={{ background: bg }}
                    title={t.contributorName ? `${t.contributorName} · ${t.status}` : `Empty (${t.row + 1},${t.col + 1})`}
                  >
                    {t.contributorName ? t.contributorName.charAt(0) : ''}
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-3 text-[10px] text-[var(--muted)]">
              <Legend color="var(--default)" label="Empty" />
              <Legend color="var(--accent)" label="Assigned" />
              <Legend color="var(--success)" label="Done" />
            </div>
          </Surface>
        </div>

        <Surface variant="secondary" className="rounded-[var(--radius)] p-5">
          <div className="flex items-center justify-between mb-4">
            <Eyebrow>Participants</Eyebrow>
            <span className="text-xs text-[var(--muted)] tabular-nums">{participants.length} joined</span>
          </div>

          {participants.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-8 text-center">
              No one has joined yet. Share the guest link to get started.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--separator)]">
              {participants.map((p) => {
                const tile = tiles.find((t) => t.id === p.tileId)
                return (
                  <li key={p.id} className="py-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--foreground)] truncate">{p.name}</span>
                        {p.id === user?.id && <Chip color="accent" variant="soft" size="sm">You</Chip>}
                        {p.status === 'completed' && <Chip color="success" variant="soft" size="sm">Done</Chip>}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] font-mono mt-0.5">
                        artboard {tile ? `${tile.row + 1}·${tile.col + 1}` : '—'}
                      </div>
                    </div>

                    <select
                      value=""
                      disabled={busy || freeTiles.length === 0}
                      onChange={(e) => e.target.value && onReassign(p.id, e.target.value)}
                      className="h-9 px-2 rounded-lg bg-[var(--surface)] text-xs text-[var(--foreground)] border-0 outline-none disabled:opacity-50"
                    >
                      <option value="">Reassign…</option>
                      {freeTiles.map((t) => (
                        <option key={t.id} value={t.id}>{t.row + 1}·{t.col + 1}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onKick(p.id)}
                      className="h-9 px-3 rounded-lg text-xs font-bold text-[var(--danger)] bg-[var(--surface)] hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] disabled:opacity-40 transition"
                    >
                      Kick
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Surface>
      </div>
    </div>
  )
}

// ── Bits ────────────────────────────────────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-[var(--background)]">{children}</div>
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}

function CopyField({ label, url, accent }: { label: string; url: string; accent?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-2 mb-2 last:mb-0">
      <span className={['text-[10px] font-bold uppercase tracking-wider w-9 shrink-0', accent ? 'text-[var(--accent)]' : 'text-[var(--muted)]'].join(' ')}>{label}</span>
      <code className="flex-1 min-w-0 truncate px-2 py-1.5 rounded-md bg-[var(--surface)] font-mono text-[10px] text-[var(--muted)]">{url}</code>
      <button type="button" onClick={copy} className="shrink-0 h-7 px-2.5 rounded-md text-[11px] font-bold bg-[var(--accent)] text-[var(--accent-foreground)] active:scale-95 transition">
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  )
}
