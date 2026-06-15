/**
 * Realtime live-neighbor round-trip harness. For each generated stroke it renders TWO ways onto
 * identical 2000² surfaces:
 *   A) the RECEIVER path — serialize the stroke into broadcaster-style LiveStrokeEvents
 *      (start + batched appends + end), feed them through createStrokeAssembler, and drive a live
 *      StrokeEngine from the assembled handler calls (exactly what useLiveNeighbors does).
 *   B) the canonical replayStroke() of the ORIGINAL stroke.
 * A and B must be pixel-identical — proving the wire format is lossless (samples reassembled in order
 * across messages) and the live-replay approach reproduces the stroke. The assembled sample count must
 * also equal the original. @drawie/core is untouched (the receiver only replays through it).
 */
import {
  StrokeEngine, replayStroke, mulberry32,
  type InputPoint, type ModelStroke, type StrokeSample,
} from '@drawie/core'
import { Canvas2DBackend } from '@drawie/renderer'
import { createStrokeAssembler, genStroke, type LiveStrokeEvent, type ActiveStroke } from '@drawie/data'

const SIZE = 2000

function mk2d() {
  const c = document.createElement('canvas')
  c.width = SIZE; c.height = SIZE
  return c.getContext('2d', { willReadFrequently: true })!
}
function toInput(s: StrokeSample): InputPoint {
  return { x: s.x, y: s.y, pressure: s.pressure, hasPressure: s.hasPressure, t: s.t }
}

/** Serialize a stroke into the events the broadcaster would send (start, 2-sample appends, end). */
function toEvents(stroke: ModelStroke, strokeId: string): LiveStrokeEvent[] {
  const tileKey = { row: -1, col: 0 } // a neighbor cell relative to self {0,0}
  const pts = stroke.samples
  const evs: LiveStrokeEvent[] = [{
    v: 1, strokeId, phase: 'start', senderId: 'test', tileKey,
    toolId: stroke.toolId, settings: stroke.settings, assist: stroke.assist, seed: stroke.seed,
    points: [pts[0]], fromIndex: 0,
  }]
  let i = 1
  while (i < pts.length) {
    const batch = pts.slice(i, i + 2)
    evs.push({ v: 1, strokeId, phase: 'append', senderId: 'test', tileKey, points: batch, fromIndex: i })
    i += batch.length
  }
  evs.push({ v: 1, strokeId, phase: 'end', senderId: 'test', tileKey, ticks: stroke.ticks })
  return evs
}

function roundtripCase(seed: number) {
  const stroke = genStroke(mulberry32(seed))

  // A — the receiver path: assemble events, drive a live engine from the handler calls.
  const ctxA = mk2d()
  const backendA = new Canvas2DBackend(ctxA)
  let engA: StrokeEngine | null = null
  let assembledSamples = 0
  const assembler = createStrokeAssembler({ row: 0, col: 0 }, {
    onStart(s: ActiveStroke) {
      engA = new StrokeEngine(backendA, s.toolId, s.settings, s.assist, s.seed)
      engA.begin(toInput(s.samples[0]))
      for (let k = 1; k < s.samples.length; k++) engA.extend(toInput(s.samples[k]))
      assembledSamples = s.samples.length
    },
    onAppend(s, ns) { for (const p of ns) engA!.extend(toInput(p)); assembledSamples = s.samples.length },
    onEnd(s) { engA!.end(); assembledSamples = s.samples.length },
    onRerender() { /* not exercised by this round-trip */ },
  })
  for (const ev of toEvents(stroke, `s-${seed}`)) assembler.dispatch(ev)

  // B — canonical replay of the original stroke.
  const ctxB = mk2d()
  replayStroke(new Canvas2DBackend(ctxB), stroke)

  const a = ctxA.getImageData(0, 0, SIZE, SIZE).data
  const b = ctxB.getImageData(0, 0, SIZE, SIZE).data
  let sum = 0, max = 0
  for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); sum += d; if (d > max) max = d }
  return { seed, tool: stroke.toolId, origSamples: stroke.samples.length, assembledSamples, meanAbs: sum / a.length, maxAbs: max }
}

declare global {
  interface Window {
    __seeds: number[]
    __roundtrip: (seed: number) => ReturnType<typeof roundtripCase>
    __ready: boolean
  }
}

window.__seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010]
window.__roundtrip = roundtripCase
window.__ready = true
