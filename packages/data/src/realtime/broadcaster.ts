// Outgoing live strokes — broadcast the local user's in-progress stroke to their OWN tile channel,
// throttled. Neighbors editing an adjacent tile subscribe to this channel and replay the stroke into
// their sliver. `start` and `end` are always sent; `append` sample deltas are coalesced (~40 ms) so we
// emit a handful of messages per second per stroke rather than one per pointer sample — keeping well
// within Realtime Broadcast limits. Soft-realtime: a dropped message is fine (the submitted tile is
// authoritative). Pure transport — no UI.

import type { ToolId, ToolSettings, AssistSettings, StrokeSample, ModelStroke } from '@drawie/core'
import { getSupabase } from '../supabase'
import { channelNameFor, STROKE_EVENT, type LiveStrokeEvent, type TileKey } from './types'

/** Cap a snapshot's total samples so the broadcast payload stays well under Realtime's size limit
 *  (~2500 samples ≈ under 200 KB). Beyond this, only the most-recent strokes are carried. */
const SNAPSHOT_SAMPLE_BUDGET = 2500

/** Identity of an in-progress stroke (sent once, on `begin`). */
export interface StrokeIdentity {
  strokeId: string
  toolId: ToolId
  settings: ToolSettings
  assist: AssistSettings
  seed: number
}

export interface StrokeBroadcaster {
  /** Open a new stroke: sends `start` immediately with its first sample. */
  begin(identity: StrokeIdentity, firstSample: StrokeSample): void
  /** Queue freshly-captured samples for the current stroke (coalesced into ~40 ms `append` batches). */
  append(samples: StrokeSample[]): void
  /** Close the current stroke: flushes any pending samples, then sends `end` (never dropped/coalesced). */
  end(tail?: StrokeSample[], ticks?: number[]): void
  /** History controls — make neighbors' slivers reflect the drawer's undo/redo/clear. */
  undo(): void
  redo(): void
  clearStrokes(): void
  /** Tear down the channel. */
  dispose(): void
}

export interface BroadcasterOpts {
  /** Coalescing window for `append` batches, ms. */
  appendMs?: number
  /** Force a flush once this many samples are buffered (bounds latency on fast strokes). */
  maxBatch?: number
}

/**
 * Create a broadcaster bound to `key` (the local user's tile). Subscribes once; the channel is ready
 * well before the user draws (the hook creates this at mount). `senderId` stamps each event for
 * cursor tracking / caps on the receiver.
 */
export function createStrokeBroadcaster(
  key: TileKey,
  senderId: string,
  opts: BroadcasterOpts = {},
): StrokeBroadcaster {
  // Coalesce appends fairly aggressively — the sliver doesn't need high temporal fidelity, and fewer
  // messages keeps the channel well under Realtime rate limits (a flooded channel can drop later sends).
  const appendMs = opts.appendMs ?? 70
  const maxBatch = opts.maxBatch ?? 48
  const channel = getSupabase().channel(channelNameFor(key), {
    config: { broadcast: { self: false } },
  })
  channel.subscribe()

  let current: StrokeIdentity | null = null
  let seq = 0 // total samples sent for the current stroke (next fromIndex)
  let buffer: StrokeSample[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  // Finished strokes we've broadcast (+ a redo stack) so undo/clear can re-derive the neighbor's state
  // as an idempotent `truncate count` (robust to message loss), and redo can re-send the stroke.
  let curSamples: StrokeSample[] = []
  const sent: ModelStroke[] = []
  const redoStack: ModelStroke[] = []
  let reSeq = 0
  let snapVersion = 0 // monotonic; lets the receiver drop stale snapshot re-sends

  const tileKey = { row: key.row, col: key.col }

  function send(ev: LiveStrokeEvent) {
    // Fire-and-forget — drops are acceptable under soft-realtime.
    void channel.send({ type: 'broadcast', event: STROKE_EVENT, payload: ev })
  }

  function clearTimer() {
    if (timer != null) { clearTimeout(timer); timer = null }
  }

  function flush() {
    clearTimer()
    if (!current || buffer.length === 0) return
    const points = buffer
    buffer = []
    send({ v: 1, strokeId: current.strokeId, phase: 'append', senderId, tileKey, points, fromIndex: seq })
    seq += points.length
  }

  function scheduleFlush() {
    if (buffer.length >= maxBatch) { flush(); return }
    if (timer == null) timer = setTimeout(flush, appendMs)
  }

  /** Broadcast the drawer's COMPLETE current stroke list so the neighbor REPLACES the cell with it.
   *  Absolute state → idempotent + self-healing (recovers any earlier dropped start/append/end). Re-sent
   *  several times over ~1.5 s because a single message is much more loss-prone than a multi-message
   *  stroke; a NON-EMPTY strokeId is used (the one payload difference vs the reliably-delivered `end`).
   *  Capped by a sample budget so the payload stays well under the Realtime message-size limit; if the
   *  tile is huge, only the most-recent strokes are carried (older ones are deeply buried anyway). */
  function sendSnapshot() {
    let budget = SNAPSHOT_SAMPLE_BUDGET
    let from = sent.length
    while (from > 0 && budget > 0) { from--; budget -= sent[from].samples.length || 1 }
    const strokes = sent.slice(from)
    const ev: LiveStrokeEvent = { v: 1, strokeId: `s${reSeq++}`, phase: 'snapshot', senderId, tileKey, strokes, version: ++snapVersion }
    for (const ms of [0, 250, 700, 1500]) {
      if (ms === 0) send(ev)
      else setTimeout(() => send(ev), ms)
    }
  }

  return {
    begin(identity, firstSample) {
      // Any unfinished prior stroke is abandoned — start fresh. A new draw invalidates redo.
      clearTimer()
      buffer = []
      current = identity
      curSamples = [firstSample]
      redoStack.length = 0
      seq = 1
      send({
        v: 1, strokeId: identity.strokeId, phase: 'start', senderId, tileKey,
        toolId: identity.toolId, settings: identity.settings, assist: identity.assist, seed: identity.seed,
        points: [firstSample], fromIndex: 0,
      })
    },
    append(samples) {
      if (!current || samples.length === 0) return
      buffer.push(...samples)
      curSamples.push(...samples)
      scheduleFlush()
    },
    end(tail, ticks) {
      if (!current) return
      if (tail && tail.length) { buffer.push(...tail); curSamples.push(...tail) }
      flush() // emit any remaining samples as a final append before `end`
      send({ v: 1, strokeId: current.strokeId, phase: 'end', senderId, tileKey, ticks })
      sent.push({ toolId: current.toolId, settings: current.settings, assist: current.assist, seed: current.seed, samples: curSamples, ticks })
      current = null
      curSamples = []
      seq = 0
    },
    undo() {
      flush()
      if (sent.length === 0) return
      redoStack.push(sent.pop()!)
      sendSnapshot()
    },
    redo() {
      flush()
      if (redoStack.length === 0) return
      sent.push(redoStack.pop()!)
      sendSnapshot()
    },
    clearStrokes() {
      flush()
      sent.length = 0
      redoStack.length = 0
      sendSnapshot()
    },
    dispose() {
      clearTimer()
      current = null
      buffer = []
      sent.length = 0
      redoStack.length = 0
      void getSupabase().removeChannel(channel)
    },
  }
}
