// Retained document model — the source of truth for a drawing (Phase 3).
//
// Before Phase 3 the pixels WERE the document (no replayable model). Now a drawing
// is a vector model: layers → ordered strokes, each stroke a tool + settings snapshot
// + seed + the raw input samples. Rendering = replay the strokes through the
// StrokeEngine into a RendererBackend. Because the engine is deterministic given a
// seed (Phase 2), replaying a stroke reproduces it bit-for-bit on any backend/platform.
//
// This buys: model-level undo/redo (pop a stroke, re-render) instead of 16 MB ImageData
// snapshots; resolution-independent re-rendering; vector drafts; and a single artifact
// that web and native both replay identically.

import type { ToolId, ToolSettings, AssistSettings, InputPoint } from './types'
import type { RendererBackend } from './renderer'
import { StrokeEngine } from './engine'
import { renderProfiStroke } from './freehand'

/** One captured pointer sample. Tilt is captured now (closes the §9 gap) even
 *  though the current engine ignores it — the model is the place to retain it. */
export interface StrokeSample {
  x: number
  y: number
  pressure: number
  hasPressure: boolean
  tiltX?: number
  tiltY?: number
  t: number // ms relative to stroke start
}

/** One retained stroke — everything needed to replay it deterministically. */
export interface ModelStroke {
  toolId: ToolId
  settings: ToolSettings
  assist: AssistSettings
  seed: number
  samples: StrokeSample[]
  /** Per-frame tick timestamps (ms rel. to stroke start) — only meaningful for
   *  dwell tools (watercolor pooling); omitted/empty otherwise. */
  ticks?: number[]
}

export interface ModelLayer {
  id: string
  name: string
  visible: boolean
  strokes: ModelStroke[]
}

export interface DrawDocument {
  version: 1
  width: number
  height: number
  layers: ModelLayer[]
}

export function emptyLayer(id: string, name: string, visible = true): ModelLayer {
  return { id, name, visible, strokes: [] }
}

export function createDocument(
  width: number,
  height: number,
  layers: Array<{ id: string; name: string; visible: boolean }>,
): DrawDocument {
  return { version: 1, width, height, layers: layers.map((l) => emptyLayer(l.id, l.name, l.visible)) }
}

function toInput(s: StrokeSample): InputPoint {
  return { x: s.x, y: s.y, pressure: s.pressure, hasPressure: s.hasPressure, t: s.t }
}

/**
 * Replay a single stroke into `backend`, interleaving pointer samples (extend) and
 * dwell ticks (tick) in timestamp order so dwell-driven tools (watercolor pooling)
 * reproduce exactly. The backend is drawn onto as-is (caller clears/positions it).
 */
export function replayStroke(backend: RendererBackend, s: ModelStroke): void {
  const samples = s.samples
  if (!samples.length) return
  // profibrush is NOT engine-stamped — it's a perfect-freehand filled ribbon over all points at once.
  if (s.toolId === 'profibrush') {
    renderProfiStroke(backend, samples.map((p) => ({ x: p.x, y: p.y, pressure: p.hasPressure ? p.pressure : 0.5 })), s.settings, s.seed)
    return
  }
  const eng = new StrokeEngine(backend, s.toolId, s.settings, s.assist, s.seed)
  const ticks = s.ticks ?? []
  eng.begin(toInput(samples[0]))
  let si = 1
  let ti = 0
  while (si < samples.length || ti < ticks.length) {
    const nextSampleT = si < samples.length ? samples[si].t : Infinity
    const nextTickT = ti < ticks.length ? ticks[ti] : Infinity
    if (nextTickT < nextSampleT) {
      eng.tick(ticks[ti])
      ti++
    } else {
      eng.extend(toInput(samples[si]))
      si++
    }
  }
  eng.end()
}

/** Replay every stroke of a layer into `backend` (does NOT clear first — caller does). */
export function renderLayer(backend: RendererBackend, layer: ModelLayer): void {
  for (const s of layer.strokes) replayStroke(backend, s)
}
