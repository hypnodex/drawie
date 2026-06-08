import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Spinner } from '@heroui/react'
import type { Canvas, Tile } from '../../types/domain'
import { getTilesForCanvas, tileArtworkUrl } from '../../services/tileService'
import { getCanvas } from '../../services/canvasService'
import { useRealtimeTiles } from '../../hooks/useRealtimeTiles'
import { useRealtimeCanvas } from '../../hooks/useRealtimeCanvas'
import { Heading } from '../ui/Heading'
import { Eyebrow } from '../ui/Eyebrow'

interface Props {
  canvas: Canvas
  /** The viewer's own tile — highlighted in the grid. */
  myTileId?: string
  onLeave?: () => void
}

/**
 * Live mosaic progress + reveal. After a participant submits, they watch the
 * shared mosaic fill in real time as the other artists finish. Completed tiles
 * show their actual artwork (members can read the private tiles bucket), but
 * the whole mosaic stays blurred until every tile is done — then it reveals
 * unblurred (the server-composited final image when available).
 */
export function MosaicProgress({ canvas, myTileId, onLeave }: Props) {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [artUrls, setArtUrls] = useState<Map<string, string>>(new Map())
  const [finalUrl, setFinalUrl] = useState<string | null>(canvas.artworkUrl ?? null)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(() => {
    getTilesForCanvas(canvas.id).then((t) => { setTiles(t); setLoaded(true) }).catch(() => {})
  }, [canvas.id])

  useEffect(() => { reload() }, [reload])
  useRealtimeTiles(canvas.id, reload)
  useRealtimeCanvas(canvas.id, () => {
    getCanvas(canvas.id).then((c) => { if (c?.artworkUrl) setFinalUrl(c.artworkUrl) }).catch(() => {})
  })

  const total = canvas.gridRows * canvas.gridCols
  const done = tiles.filter((t) => t.status === 'completed').length
  const allDone = loaded && done >= total
  const remaining = total - done

  // Fetch signed URLs for completed tiles (members can read the tiles bucket).
  useEffect(() => {
    let active = true
    const completed = tiles.filter((t) => t.status === 'completed' && t.artworkPath)
    Promise.all(completed.map(async (t) => [t.id, await tileArtworkUrl(t.artworkPath)] as const))
      .then((pairs) => {
        if (!active) return
        setArtUrls(new Map(pairs.filter((p): p is [string, string] => !!p[1])))
      })
      .catch(() => {})
    return () => { active = false }
  }, [tiles])

  const byPos = useMemo(() => {
    const m = new Map<string, Tile>()
    for (const t of tiles) m.set(`${t.row}-${t.col}`, t)
    return m
  }, [tiles])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-[var(--background)]">
      <div className="w-full max-w-xl text-center">
        <Eyebrow variant="dot">{allDone ? 'Revealed' : 'Submitted'}</Eyebrow>
        <Heading level={1} size="lg" className="mt-2">
          {allDone ? 'The mosaic is complete' : 'Your tile is in'}
        </Heading>
        <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
          {allDone
            ? `All ${total} artboards of "${canvas.title}" are finished. Here's the full mosaic.`
            : `Thanks for contributing to "${canvas.title}". Watch it fill in as the other artists finish — the full picture is revealed once everyone's done.`}
        </p>

        {/* Mosaic */}
        <div className="relative mt-7 mx-auto w-full aspect-square rounded-[var(--radius)] overflow-hidden shadow-[var(--shadow-overlay)]"
             style={{ background: canvas.previewGradient }}>
          {allDone && finalUrl ? (
            <img src={finalUrl} alt={canvas.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div
              className="absolute inset-0 grid transition-[filter] duration-1000"
              style={{
                gridTemplateColumns: `repeat(${canvas.gridCols}, 1fr)`,
                gridTemplateRows: `repeat(${canvas.gridRows}, 1fr)`,
                filter: allDone ? 'none' : 'blur(8px)',
                transform: allDone ? 'none' : 'scale(1.06)',
              }}
            >
              {Array.from({ length: total }).map((_, i) => {
                const row = Math.floor(i / canvas.gridCols)
                const col = i % canvas.gridCols
                const t = byPos.get(`${row}-${col}`)
                const url = t ? artUrls.get(t.id) : undefined
                const mine = t?.id === myTileId
                return (
                  <div key={i} className="relative overflow-hidden" style={{ outline: mine ? '2px solid var(--accent)' : undefined, outlineOffset: '-2px' }}>
                    {url ? (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={[
                        'w-full h-full',
                        t?.status === 'in-progress' ? 'bg-[var(--accent)]/25 animate-pulse' : 'bg-[var(--foreground)]/5',
                      ].join(' ')} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {!allDone && <div className="absolute inset-0 bg-[var(--background)]/10 pointer-events-none" />}
        </div>

        {/* Progress */}
        {!allDone ? (
          <div className="mt-6">
            <div className="h-2 rounded-full bg-[var(--default)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                   style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
            </div>
            <p className="mt-3 text-sm text-[var(--muted)] inline-flex items-center gap-2">
              <Spinner size="sm" />
              <span className="tabular-nums font-bold text-[var(--foreground)]">{done}/{total}</span> tiles done ·
              waiting for {remaining} more {remaining === 1 ? 'artist' : 'artists'}
            </p>
          </div>
        ) : (
          <div className="mt-6 inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--success)] text-[var(--success-foreground)]">
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
        )}

        {onLeave && (
          <div className="mt-8">
            <Button variant="secondary" size="md" onPress={onLeave}>Done</Button>
          </div>
        )}
      </div>
    </div>
  )
}
