import { useEffect, useMemo, useRef, useState } from 'react'
import type { Canvas } from '../../types/domain'
import { makeMockTileCanvas } from '../../drawing/mockTiles'

interface Props {
  canvas: Canvas
  blurContent?: boolean
  showGrid?: boolean
  className?: string
}

/**
 * Card preview. Completed canvases with an artworkUrl render that PNG
 * unblurred (falling back to procedural art if the image fails). Active
 * canvases render the procedural canvas with a soft blur + grid-status chip.
 */
export function MosaicPreview({
  canvas, blurContent = true, showGrid = true, className = '',
}: Props) {
  const isCompleted = canvas.status === 'completed'

  const grid = useMemo(() => {
    if (!showGrid) return null
    const total = canvas.totalTiles
    const filled = new Set<number>()
    let seed = hashSeed(canvas.id)
    for (let i = 0; i < canvas.completedTiles; i++) {
      seed = (seed * 9301 + 49297) % 233280
      filled.add(Math.floor((seed / 233280) * total))
    }
    return { total, filled }
  }, [canvas.id, canvas.totalTiles, canvas.completedTiles, showGrid])

  const [imgFailed, setImgFailed] = useState(false)
  const useRealArtwork = isCompleted && !!canvas.artworkUrl && !imgFailed

  return (
    <div
      className={['relative w-full aspect-square overflow-hidden', className].join(' ')}
      style={{ background: canvas.previewGradient }}
    >
      {useRealArtwork ? (
        <img
          src={canvas.artworkUrl}
          alt={canvas.title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <ArtworkCanvas
          canvasId={canvas.id}
          className="absolute inset-0 w-full h-full"
          blurPx={isCompleted ? 0 : (blurContent ? 22 : 0)}
        />
      )}

      {!isCompleted && blurContent && (
        <div className="absolute inset-0 bg-[var(--background)]/15" />
      )}

      {showGrid && grid && !isCompleted && (
        <div className="absolute bottom-3 left-3 p-1.5 rounded-xl bg-[var(--background)] shadow-sm">
          <div
            className="grid gap-[1px]"
            style={{
              gridTemplateColumns: `repeat(${canvas.gridCols}, 1fr)`,
              gridTemplateRows: `repeat(${canvas.gridRows}, 1fr)`,
              width: chipSizeFor(canvas.gridRows, canvas.gridCols),
              height: chipSizeFor(canvas.gridRows, canvas.gridCols),
            }}
          >
            {Array.from({ length: grid.total }).map((_, i) => (
              <div
                key={i}
                className={[
                  'rounded-[1px]',
                  grid.filled.has(i)
                    ? 'bg-[var(--foreground)]'
                    : 'bg-[var(--foreground)]/15',
                ].join(' ')}
              />
            ))}
          </div>
          <div className="mt-1 font-mono text-[8px] text-[var(--foreground)] font-bold text-center tabular-nums leading-none">
            {canvas.completedTiles}/{canvas.totalTiles}
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--background)]/35 to-transparent pointer-events-none" />
    </div>
  )
}

function chipSizeFor(rows: number, cols: number): number {
  const maxDim = Math.max(rows, cols)
  if (maxDim <= 4) return 44
  if (maxDim <= 6) return 56
  if (maxDim <= 8) return 64
  return 72
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function ArtworkCanvas({
  canvasId, blurPx, className,
}: {
  canvasId: string
  blurPx: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const size = 240
    if (c.width !== size) { c.width = size; c.height = size }
    const src = makeMockTileCanvas(size, hashSeed(canvasId))
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(src, 0, 0)
  }, [canvasId])
  return (
    <canvas
      ref={ref}
      className={['block', className].join(' ')}
      style={{
        filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
        transform: blurPx > 0 ? 'scale(1.12)' : undefined,
        transformOrigin: 'center',
      }}
      aria-hidden
    />
  )
}
