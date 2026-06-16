import { useEffect, useMemo, useRef } from 'react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import type { Canvas as CanvasDomain, Tile } from '@drawie/data'

interface Props {
  isOpen: boolean
  onClose: () => void
  activeTileCanvas: HTMLCanvasElement | null
  canvas?: CanvasDomain
  tiles?: Tile[]
  userTile?: Tile
}

type CellStatus = 'drawing' | 'done' | 'empty'
interface CellMeta { status: CellStatus; tile: number }

/**
 * Full-screen mosaic reveal. The user's tile shows their actual drawing;
 * every other tile is just status (drawing / done / empty). HeroUI v3 Modal
 * compound: Modal → Backdrop + Container → Dialog → Body.
 */
export function MosaicReveal({
  isOpen, onClose, activeTileCanvas, canvas, tiles, userTile,
}: Props) {
  const size = canvas ? { rows: canvas.gridRows, cols: canvas.gridCols } : { rows: 5, cols: 5 }
  const position = canvas && userTile ? { row: userTile.row, col: userTile.col } : { row: 2, col: 2 }

  const grid = useMemo<CellMeta[][]>(() => {
    const out: CellMeta[][] = []
    for (let r = 0; r < size.rows; r++) {
      const row: CellMeta[] = []
      for (let c = 0; c < size.cols; c++) {
        const tileNumber = r * size.cols + c + 1
        if (canvas && tiles) {
          const real = tiles.find((t) => t.row === r && t.col === c)
          const status: CellStatus =
            real?.status === 'completed' ? 'done'
              : real?.status === 'in-progress' ? 'drawing'
              : 'empty'
          row.push({ tile: tileNumber, status })
        } else {
          const seed = (r * 37 + c * 13 + 11) >>> 0
          const v = ((seed * 9301 + 49297) % 233280) / 233280
          let status: CellStatus = 'empty'
          if (v < 0.22) status = 'drawing'
          else if (v < 0.74) status = 'done'
          row.push({ tile: tileNumber, status })
        }
      }
      out.push(row)
    }
    return out
  }, [size.rows, size.cols, canvas, tiles])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[var(--foreground)]/95 text-[var(--background)] border-0 max-w-[94vw] sm:max-w-[94vw] max-h-[92vh] overflow-hidden">
            <div className="flex flex-col items-center gap-4 py-2">
            <header className="text-center">
              <div className="font-mono text-[10px] opacity-60">Mosaic Preview</div>
              <DialogTitle className="text-2xl font-bold mt-1">The full mosaic</DialogTitle>
              <p className="text-sm opacity-70 mt-2 max-w-md mx-auto">
                Only your tile shows artwork. Other tiles are private — you can only
                see their status (in progress or done).
              </p>
            </header>

            <div
              className="grid rounded-2xl overflow-hidden"
              style={{
                gridTemplateColumns: `repeat(${size.cols}, 1fr)`,
                gridTemplateRows: `repeat(${size.rows}, 1fr)`,
                // True aspect → square tiles even on non-square mosaics; cap to the viewport so the
                // whole thing is visible without scrolling, with top/bottom breathing room.
                aspectRatio: `${size.cols} / ${size.rows}`,
                maxHeight: '74vh', maxWidth: '88vw', width: '100%', margin: '0 auto',
                gap: 3, padding: 3, backgroundColor: '#0a0b0e',
              }}
            >
              {grid.flatMap((row, r) =>
                row.map((meta, c) => {
                  const isYou = r === position.row && c === position.col
                  return (
                    <div key={`${r}-${c}`} className="relative overflow-hidden rounded-[3px] bg-[var(--background)]">
                      {isYou ? <YourTile source={activeTileCanvas} /> : <StatusCell meta={meta} />}
                      {isYou && (
                        <>
                          <div className="absolute inset-0 ring-2 ring-[var(--accent)]/80 pointer-events-none rounded-[3px]" />
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/85 text-[9px] font-bold text-[var(--accent)] tracking-wider">
                            YOU
                          </div>
                        </>
                      )}
                    </div>
                  )
                })
              )}
            </div>

              <Button onClick={onClose} size="lg">
                Back to editing
              </Button>
            </div>
      </DialogContent>
    </Dialog>
  )
}

function YourTile({ source }: { source: HTMLCanvasElement | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !source) return
    c.width = source.width
    c.height = source.height
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(source, 0, 0)
  }, [source])
  return <canvas ref={ref} className="w-full h-full block" />
}

function StatusCell({ meta }: { meta: CellMeta }) {
  return (
    <div className="w-full h-full bg-[var(--background)] flex flex-col items-center justify-center gap-1 p-1.5 text-center">
      <div className="text-[10px] font-mono text-[var(--muted)]">#{meta.tile}</div>
      <StatusGlyph status={meta.status} />
    </div>
  )
}

function StatusGlyph({ status }: { status: CellStatus }) {
  if (status === 'drawing') {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="relative inline-flex">
          <span className="absolute inset-0 rounded-full bg-[var(--accent)]/40 animate-ping" />
          <span className="relative block w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
        </span>
        <span className="text-[10px] font-semibold tracking-wide text-[var(--foreground)]">drawing</span>
      </div>
    )
  }
  if (status === 'done') {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--success)]/15">
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l4.5 4.5L20 6" />
          </svg>
        </span>
        <span className="text-[10px] font-semibold tracking-wide text-[var(--success)]">done</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-1 opacity-50">
      <span className="block w-2 h-2 rounded-full bg-[var(--muted)]" />
      <span className="text-[10px] font-medium tracking-wide text-[var(--muted)]">empty</span>
    </div>
  )
}
