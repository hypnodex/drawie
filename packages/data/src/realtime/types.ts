// Realtime neighbor-tile live drawing — wire types + channel naming.
//
// While a user draws their tile, the up-to-8 adjacent tiles are partly visible as thin
// "slivers" around the artboard. This module carries the OTHER users' in-progress strokes
// over Supabase Realtime Broadcast so they appear live in those slivers. The payload is a
// compact, incremental form of a @drawie/core ModelStroke (toolId + settings + assist + seed
// + samples) in tile-local artboard coordinates [0..ARTBOARD]; the receiver reassembles it and
// replays it through the existing engine. Pure data — no DOM, no RN, no React.

import type { ToolId, ToolSettings, AssistSettings, StrokeSample, ModelStroke } from '@drawie/core'

/** The tile-local artboard resolution strokes are captured in (matches Canvas.tsx INTERNAL_SIZE
 *  and DrawCanvas ARTBOARD). Coordinates in LiveStrokeEvent.points are in this space. */
export const ARTBOARD = 2000

/** Broadcast event name carried inside each Realtime message. */
export const STROKE_EVENT = 'stroke'

/** Identifies one tile in a canvas grid. */
export interface TileKey {
  canvasId: string
  row: number
  col: number
}

/** The 8 neighbor offsets around a tile (row,col deltas) — the single source of truth shared by
 *  the receiver and both renderers (mirrors apps/web Canvas.tsx NEIGHBORS). Ordering is stable so
 *  a cell index (0..7) maps consistently to a position on every platform. */
export const NEIGHBOR_OFFSETS: ReadonlyArray<{ row: -1 | 0 | 1; col: -1 | 0 | 1 }> = [
  { row: -1, col: -1 }, // 0 top-left
  { row: -1, col: 0 },  // 1 top
  { row: -1, col: 1 },  // 2 top-right
  { row: 0, col: -1 },  // 3 left
  { row: 0, col: 1 },   // 4 right
  { row: 1, col: -1 },  // 5 bottom-left
  { row: 1, col: 0 },   // 6 bottom
  { row: 1, col: 1 },   // 7 bottom-right
]

/** Channel name for a tile — one Broadcast channel per tile so neighbor scoping is clean.
 *  The local user PUBLISHES to their own tile channel; a viewer SUBSCRIBES to the up-to-8
 *  channels of the tiles adjacent to the one they're editing. */
export function channelNameFor(k: Pick<TileKey, 'canvasId' | 'row' | 'col'>): string {
  return `tile:${k.canvasId}:${k.row}:${k.col}`
}

/** Phase of a live event. `start` carries the stroke identity (tool/settings/assist/seed) plus its
 *  first sample(s); `append` carries incremental sample deltas; `end` closes it (and carries the final
 *  tail + any watercolor ticks). `snapshot` carries the drawer's COMPLETE current stroke list — sent on
 *  undo/redo/clear so the receiver REPLACES the cell's strokes with it. Because it's an absolute
 *  state (not a delta), re-applying it is a no-op (safe to re-send redundantly) and it self-heals any
 *  earlier dropped start/append/end. Soft-realtime: any single message may be dropped. */
export type StrokePhase = 'start' | 'append' | 'end' | 'snapshot'

/** One Broadcast message describing part of a remote in-progress stroke. */
export interface LiveStrokeEvent {
  /** Schema version — receiver drops anything it doesn't understand. */
  v: 1
  /** Unique per in-progress stroke (sender-local); the receiver assembles points by this id. */
  strokeId: string
  phase: StrokePhase
  /** Auth user id (or a `sim:*` id) — used for self-suppression fallback, cursor tracking, caps. */
  senderId: string
  /** The SENDER's tile coordinates (canvasId is implied by the channel). The receiver maps this to
   *  one of its NEIGHBOR_OFFSETS cells. */
  tileKey: { row: number; col: number }

  // ── stroke identity (present on `start`; cached by strokeId) ──
  toolId?: ToolId
  settings?: ToolSettings
  assist?: AssistSettings
  seed?: number

  // ── incremental geometry (tile-local coords [0..ARTBOARD]) ──
  /** New samples carried by this message: the full head on `start`, the delta on `append`,
   *  any tail on `end`. */
  points?: StrokeSample[]
  /** Index of points[0] within the full stroke — lets the receiver detect gaps / ordering. */
  fromIndex?: number
  /** Per-frame dwell tick timestamps (watercolor pooling) — sent on `end`, mirrors ModelStroke.ticks. */
  ticks?: number[]
  /** `snapshot` only: the drawer's complete current stroke list — the receiver replaces the cell's
   *  strokes with this and re-renders. Absolute state, so re-applying it is a no-op (self-healing). */
  strokes?: ModelStroke[]
  /** `snapshot` only: a monotonic version (per sender) so the receiver ignores STALE re-sends — a
   *  redundant copy of an older snapshot must not overwrite a newer one when undo→clear happen fast. */
  version?: number
}
