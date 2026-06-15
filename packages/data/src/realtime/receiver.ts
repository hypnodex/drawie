// Incoming live strokes — the dispatch hub. Subscribes to the up-to-8 neighbor tile channels and
// turns the raw Broadcast messages into assembled, renderer-ready strokes. The SAME `dispatch()` is
// also called by the dev simulator, so simulated and real strokes travel an identical
// receive → assemble → replay path (the simulator is not a separate fake renderer).
//
// Pure transport/assembly — no DOM, no RN. The renderer registers handlers that own the actual
// per-cell offscreen + engine replay; this file only decides WHAT to draw and WHERE (which neighbor
// cell), assembling incremental samples by strokeId and enforcing safety/perf caps.

import type { ToolId, ToolSettings, AssistSettings, StrokeSample, ModelStroke } from '@drawie/core'
import { getSupabase } from '../supabase'
import { NEIGHBOR_OFFSETS, STROKE_EVENT, channelNameFor, type LiveStrokeEvent, type TileKey } from './types'

/** Resolve a sender tile (row,col) to a neighbor cell index (0..7) relative to `self`, or null if it
 *  isn't one of the 8 neighbors. */
export function neighborCellIndex(self: { row: number; col: number }, row: number, col: number): number | null {
  const dr = row - self.row
  const dc = col - self.col
  const i = NEIGHBOR_OFFSETS.findIndex((o) => o.row === dr && o.col === dc)
  return i === -1 ? null : i
}

/** The in-grid neighbor cells around `self` (drops cells off the edge of the grid). */
export function inGridNeighbors(self: { row: number; col: number }, gridRows: number, gridCols: number) {
  const out: Array<{ cell: number; row: number; col: number }> = []
  NEIGHBOR_OFFSETS.forEach((o, cell) => {
    const row = self.row + o.row
    const col = self.col + o.col
    if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) return
    out.push({ cell, row, col })
  })
  return out
}

/** A remote stroke being assembled/rendered. The renderer reads identity + accumulated `samples`. */
export interface ActiveStroke {
  /** Unique key `${senderId}:${strokeId}`. */
  key: string
  /** Neighbor cell index 0..7 (position around the artboard). */
  cell: number
  senderId: string
  toolId: ToolId
  settings: ToolSettings
  assist: AssistSettings
  seed: number
  /** All samples received so far (tile-local coords). On `start` this holds the head; `onAppend`
   *  hands the renderer just the new delta but also pushes it here. */
  samples: StrokeSample[]
  ticks?: number[]
}

export interface LiveStrokeHandlers {
  /** A new remote stroke began. `s.samples` holds its initial head sample(s). */
  onStart(s: ActiveStroke): void
  /** New samples arrived for an active stroke (already appended to `s.samples`). */
  onAppend(s: ActiveStroke, newSamples: StrokeSample[]): void
  /** The stroke finished. The renderer should finalize + schedule its fade/cleanup. */
  onEnd(s: ActiveStroke): void
  /** History changed (the drawer undid/redid/cleared) — re-render this cell from the given committed
   *  strokes (clear the offscreen + replay them). `strokes` is the full ordered list (possibly empty). */
  onRerender(cell: number, strokes: ModelStroke[]): void
}

export interface ReceiverOpts {
  /** Senders to ignore entirely (e.g. moderation-flagged users). Live strokes are pre-moderation. */
  blockedSenders?: Set<string>
  /** Max concurrently-active strokes per neighbor cell. */
  maxPerCell?: number
  /** Max total concurrently-active strokes across all cells. */
  maxActive?: number
  /** Hard cap on samples retained per stroke (bounds memory). */
  maxPoints?: number
}

export interface StrokeAssembler {
  /** The shared seam: hand a (real or simulated) event to the pipeline. */
  dispatch(ev: LiveStrokeEvent): void
  /** Drop all in-flight stroke state. */
  reset(): void
}

export interface NeighborReceiver extends StrokeAssembler {
  dispose(): void
}

/**
 * Pure assembly: turn a stream of LiveStrokeEvents (from real Broadcast OR the simulator) into the
 * handler calls the renderer needs — reassembling incremental samples by strokeId and enforcing the
 * caps. No Supabase, no network → fully unit-testable. `createNeighborReceiver` wraps this with the
 * neighbor channel subscriptions.
 */
export function createStrokeAssembler(
  self: { row: number; col: number },
  handlers: LiveStrokeHandlers,
  opts: ReceiverOpts = {},
): StrokeAssembler {
  const blocked = opts.blockedSenders
  const maxPerCell = opts.maxPerCell ?? 3
  const maxActive = opts.maxActive ?? 16
  const maxPoints = opts.maxPoints ?? 4000

  const active = new Map<string, ActiveStroke>()
  const perCell = new Array(NEIGHBOR_OFFSETS.length).fill(0)
  // Completed strokes retained per cell so a `snapshot` (undo/redo/clear on the drawer's side) can
  // re-render the sliver. A tile is owned by ONE drawer, so a cell is a single history. `snapVersions`
  // tracks the newest snapshot applied per cell so stale redundant re-sends are ignored.
  const committed = new Map<number, ModelStroke[]>()
  const snapVersions = new Map<number, number>()
  // Appends/ends that arrived before their `start` — stashed briefly so a reordered first packet
  // doesn't drop the whole stroke. Bounded so a never-arriving start can't leak memory.
  const pending = new Map<string, LiveStrokeEvent[]>()
  const MAX_PENDING = 32

  function keyOf(ev: LiveStrokeEvent) {
    return `${ev.senderId}:${ev.strokeId}`
  }

  function handleStart(ev: LiveStrokeEvent) {
    if (ev.toolId == null || ev.settings == null || ev.assist == null || ev.seed == null) return
    if (!ev.points || ev.points.length === 0) return // need at least the head sample to begin the engine
    const cell = neighborCellIndex(self, ev.tileKey.row, ev.tileKey.col)
    if (cell == null) return
    if (perCell[cell] >= maxPerCell || active.size >= maxActive) return
    const key = keyOf(ev)
    if (active.has(key)) return
    const s: ActiveStroke = {
      key, cell, senderId: ev.senderId,
      toolId: ev.toolId, settings: ev.settings, assist: ev.assist, seed: ev.seed,
      samples: (ev.points ?? []).slice(),
    }
    active.set(key, s)
    perCell[cell]++
    handlers.onStart(s)
    // Drain any appends/end that arrived before this start.
    const stash = pending.get(key)
    if (stash) {
      pending.delete(key)
      for (const e of stash) (e.phase === 'end' ? handleEnd : handleAppend)(e)
    }
  }

  function handleAppend(ev: LiveStrokeEvent) {
    const key = keyOf(ev)
    const s = active.get(key)
    if (!s) { stash(key, ev); return }
    if (!ev.points || ev.points.length === 0) return
    if (s.samples.length >= maxPoints) return
    s.samples.push(...ev.points)
    handlers.onAppend(s, ev.points)
  }

  function handleEnd(ev: LiveStrokeEvent) {
    const key = keyOf(ev)
    const s = active.get(key)
    if (!s) { stash(key, ev); return }
    if (ev.ticks) s.ticks = ev.ticks
    active.delete(key)
    perCell[s.cell] = Math.max(0, perCell[s.cell] - 1)
    // Retain the finished stroke so a later `truncate` (undo/clear) can re-render the cell.
    const list = committed.get(s.cell) ?? []
    list.push({ toolId: s.toolId, settings: s.settings, assist: s.assist, seed: s.seed, samples: s.samples, ticks: s.ticks })
    committed.set(s.cell, list)
    handlers.onEnd(s)
  }

  /** Replace the cell's strokes with the drawer's full snapshot (sent on undo/redo/clear) and re-render.
   *  Absolute state → self-heals any earlier dropped start/append/end; re-applying it is a no-op. */
  function handleSnapshot(ev: LiveStrokeEvent) {
    const cell = neighborCellIndex(self, ev.tileKey.row, ev.tileKey.col)
    if (cell == null) return
    const version = ev.version ?? 0
    if (version <= (snapVersions.get(cell) ?? 0)) return // stale re-send — a newer snapshot already won
    snapVersions.set(cell, version)
    const strokes = ev.strokes ?? []
    committed.set(cell, strokes.slice())
    handlers.onRerender(cell, strokes)
  }

  function stash(key: string, ev: LiveStrokeEvent) {
    if (pending.size >= MAX_PENDING && !pending.has(key)) return
    const list = pending.get(key) ?? []
    if (list.length < 64) list.push(ev)
    pending.set(key, list)
  }

  function dispatch(ev: LiveStrokeEvent) {
    if (!ev || ev.v !== 1) return
    if (blocked?.has(ev.senderId)) return
    if (ev.phase === 'start') handleStart(ev)
    else if (ev.phase === 'append') handleAppend(ev)
    else if (ev.phase === 'end') handleEnd(ev)
    else if (ev.phase === 'snapshot') handleSnapshot(ev)
  }

  return {
    dispatch,
    reset() { active.clear(); pending.clear(); perCell.fill(0); committed.clear(); snapVersions.clear() },
  }
}

/**
 * Subscribe to the in-grid neighbor channels around `self` and feed them into a StrokeAssembler. The
 * simulator bypasses the network and calls the returned `dispatch` directly (same assembler).
 */
export function createNeighborReceiver(
  self: TileKey,
  gridRows: number,
  gridCols: number,
  handlers: LiveStrokeHandlers,
  opts: ReceiverOpts = {},
): NeighborReceiver {
  const assembler = createStrokeAssembler(self, handlers, opts)
  const sb = getSupabase()
  const channels = inGridNeighbors(self, gridRows, gridCols).map(({ row, col }) =>
    sb
      .channel(channelNameFor({ canvasId: self.canvasId, row, col }), { config: { broadcast: { self: false } } })
      .on('broadcast', { event: STROKE_EVENT }, (msg) => assembler.dispatch(msg.payload as LiveStrokeEvent))
      .subscribe(),
  )
  return {
    dispatch: assembler.dispatch,
    reset: assembler.reset,
    dispose() {
      for (const ch of channels) void sb.removeChannel(ch)
      assembler.reset()
    },
  }
}
