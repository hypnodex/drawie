// Dev-only simulation harness — fakes neighbors drawing into the surrounding slivers WITHOUT a second
// real user, by emitting LiveStrokeEvents through the SAME `dispatch` the real Broadcast handler uses.
// It is NOT a separate fake renderer: simulated strokes go through receive → assemble → engine replay
// exactly like real ones, so testing the sim faithfully exercises the real pipeline.
//
// MUST be impossible to enable in production: callers gate on import.meta.env.DEV / __DEV__ AND pass
// `dev: true`; this entry hard-returns an inert handle otherwise (defence-in-depth).

import { mulberry32 } from '@drawie/core'
import { ARTBOARD, NEIGHBOR_OFFSETS, type LiveStrokeEvent, type TileKey } from './types'
import { inGridNeighbors } from './receiver'
import { genStroke, genPainting, type Region } from './strokeGen'

export type SimMode = 'cursor' | 'painting'

export interface SimCursor { cell: number; row: number; col: number; x: number; y: number }

export interface SimHandle {
  setEnabled(on: boolean): void
  setNeighborCount(n: number): void
  setMode(mode: SimMode): void
  /** Re-seed and restart from scratch (dev "redraw" button). */
  restart(): void
  /** Current fake pen positions (one per actively-drawing cell) for an optional cursor dot. */
  getCursors(): SimCursor[]
  dispose(): void
}

export interface SimOpts {
  dev: boolean
  dispatch: (ev: LiveStrokeEvent) => void
  self: TileKey
  gridRows: number
  gridCols: number
  mode?: SimMode
  neighborCount?: number
  seed?: number
  /** Coalescing cadence of simulated appends (matches the real broadcaster ~40 ms). */
  appendMs?: number
}

const INERT: SimHandle = {
  setEnabled() {}, setNeighborCount() {}, setMode() {}, restart() {}, getCursors() { return [] }, dispose() {},
}

/** Visible sliver band (tile-local) for a neighbor cell, slightly larger than the real sliver so
 *  simulated strokes are clearly visible and naturally cross the shared edge. */
function bandRegion(cell: number): Region {
  const o = NEIGHBOR_OFFSETS[cell]
  const band = ARTBOARD * 0.18
  const xr = o.col === -1 ? [ARTBOARD - band, ARTBOARD] : o.col === 1 ? [0, band] : [0, ARTBOARD]
  const yr = o.row === -1 ? [ARTBOARD - band, ARTBOARD] : o.row === 1 ? [0, band] : [0, ARTBOARD]
  return { x0: xr[0], y0: yr[0], x1: xr[1], y1: yr[1] }
}

export function startNeighborSim(opts: SimOpts): SimHandle {
  if (!opts.dev) return INERT

  const { dispatch, self, gridRows, gridCols } = opts
  const appendMs = opts.appendMs ?? 40
  let mode: SimMode = opts.mode ?? 'cursor'
  let baseSeed = opts.seed ?? 0x1234abcd
  let enabled = true
  let neighborCount = Math.max(1, Math.min(8, opts.neighborCount ?? 3))

  const timers = new Set<ReturnType<typeof setTimeout>>()
  const cursors = new Map<number, SimCursor>()
  let strokeSeq = 0
  // Per-cell pre-generated painting queues (painting mode) + rng.
  let cells: Array<{ cell: number; row: number; col: number; queue: ReturnType<typeof genPainting>; rng: () => number }> = []

  function later(fn: () => void, ms: number) {
    const id = setTimeout(() => { timers.delete(id); if (enabled) fn() }, ms)
    timers.add(id)
  }
  function clearTimers() { for (const id of timers) clearTimeout(id); timers.clear() }

  function buildCells() {
    const all = inGridNeighbors(self, gridRows, gridCols).slice(0, neighborCount)
    cells = all.map(({ cell, row, col }, i) => ({
      cell, row, col,
      rng: mulberry32((baseSeed ^ (cell * 0x9e3779b1)) >>> 0),
      queue: mode === 'painting' ? genPainting((baseSeed ^ (cell * 0x85ebca6b)) >>> 0, 4 + i, bandRegion(cell)) : [],
    }))
  }

  function nextStroke(c: typeof cells[number]) {
    if (mode === 'painting') return c.queue.shift() ?? null
    return genStroke(c.rng, { region: bandRegion(c.cell) })
  }

  /** Draw one stroke for a cell over time (start → paced appends → end), then schedule the next. */
  function drawOne(c: typeof cells[number]) {
    if (!enabled) return
    const stroke = nextStroke(c)
    if (!stroke) { cursors.delete(c.cell); return } // painting finished for this cell
    const strokeId = `s${strokeSeq++}`
    const senderId = `sim:${c.cell}`
    const tileKey = { row: c.row, col: c.col }
    const pts = stroke.samples

    dispatch({
      v: 1, strokeId, phase: 'start', senderId, tileKey,
      toolId: stroke.toolId, settings: stroke.settings, assist: stroke.assist, seed: stroke.seed,
      points: [pts[0]], fromIndex: 0,
    })
    cursors.set(c.cell, { cell: c.cell, row: c.row, col: c.col, x: pts[0].x, y: pts[0].y })

    let i = 1
    const step = () => {
      if (!enabled) return
      const batch = pts.slice(i, i + 2)
      if (batch.length) {
        dispatch({ v: 1, strokeId, phase: 'append', senderId, tileKey, points: batch, fromIndex: i })
        const last = batch[batch.length - 1]
        cursors.set(c.cell, { cell: c.cell, row: c.row, col: c.col, x: last.x, y: last.y })
        i += batch.length
        later(step, appendMs)
      } else {
        dispatch({ v: 1, strokeId, phase: 'end', senderId, tileKey, ticks: stroke.ticks })
        later(() => drawOne(c), 300 + Math.floor(c.rng() * 900)) // pause, then next stroke
      }
    }
    later(step, appendMs)
  }

  function start() {
    clearTimers()
    cursors.clear()
    strokeSeq = 0
    buildCells()
    for (const c of cells) drawOne(c)
  }

  start()

  return {
    setEnabled(on) {
      if (on === enabled) return
      enabled = on
      if (on) start()
      else clearTimers()
    },
    setNeighborCount(n) {
      neighborCount = Math.max(1, Math.min(8, n))
      if (enabled) start()
    },
    setMode(m) {
      if (m === mode) return
      mode = m
      if (enabled) start()
    },
    restart() {
      baseSeed = (baseSeed * 1664525 + 1013904223) >>> 0
      if (enabled) start()
    },
    getCursors() { return Array.from(cursors.values()) },
    dispose() { enabled = false; clearTimers(); cursors.clear() },
  }
}
