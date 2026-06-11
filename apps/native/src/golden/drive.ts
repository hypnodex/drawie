import {
  StrokeEngine, type InputPoint, type ToolId, type ToolSettings, type ToolSettingsMap, type AssistSettings,
  type RendererBackend,
} from '@drawie/core'

/**
 * Phase 6 golden — drive a corpus case through the SHARED StrokeEngine on any RendererBackend.
 * A faithful port of tools/baseline-capture/replay.ts + skia-golden-entry.ts (same SEED, ASSIST,
 * and DEFAULT_SETTINGS the docs/baseline captures were rendered with), so feeding it RNSkiaBackend
 * isolates ONE variable: RN-Skia rasterisation vs the Canvas2D baseline. Settings are embedded
 * (not @drawie/core's editor defaults) precisely so this stays a backend test, immune to default drift.
 */

// ── corpus shape (matches docs/baseline/stroke-corpus.json) ──────────────────
export type PathSpec =
  | { type: 'line'; from: [number, number]; to: [number, number]; samples: number }
  | { type: 'sine'; xFrom: number; xTo: number; yMid: number; amplitude: number; cycles: number; samples: number }
  | { type: 'dwell'; from: [number, number]; to: [number, number]; moveSamples: number; holdSamples: number }
export type PressureSpec =
  | { type: 'const'; value: number }
  | { type: 'linear'; from: number; to: number }
  | { type: 'none' }
export type StrokeSpec = { tool: ToolId; path: string; pressure: string; settings?: Partial<ToolSettings>; then?: StrokeSpec }
export type CaseSpec = StrokeSpec & { id: string; setup?: string[]; repeat?: number }
export interface Corpus {
  canvas: { internalSize: number; background: string }
  generator: { sampleDtMs: number }
  pressureProfiles: Record<string, PressureSpec>
  paths: Record<string, PathSpec>
  setups: Record<string, StrokeSpec>
  cases: CaseSpec[]
}

export const HARNESS_SEED = 0x9e3779b9
const HARNESS_ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5,
  shapeAssist: false, shapeStrength: 0.6,
  perfectShape: true, holdToSnap: false, holdDelay: 500,
}
const COMMON = { hardness: 0.6, shape: 'circle' as const, texture: 'none' as const, blending: 0, dilution: 0, persistence: 0.7, buildUp: false }
// Verbatim from tools/baseline-capture/replay.ts — the settings the baseline PNGs were rendered with.
const HARNESS_SETTINGS: ToolSettingsMap = {
  brush:      { color: '#7c8cff', size: 28, opacity: 0.85, softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON, buildUp: true },
  drybrush:   { color: '#111318', size: 46, opacity: 0.95, softness: 0.5, strength: 0.65, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  inkbrush:   { color: '#0a0b0e', size: 64, opacity: 1.0,  softness: 0.5, strength: 0.5, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  pencil:     { color: '#0a0b0e', size: 6,  opacity: 0.85, softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  pen:        { color: '#111318', size: 4,  opacity: 1.0,  softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  marker:     { color: '#ffd166', size: 36, opacity: 0.6,  softness: 0.5, strength: 0.6, pressureSim: false, wetPaint: false, ...COMMON, hardness: 0.75, buildUp: true },
  watercolor: { color: '#118ab2', size: 40, opacity: 0.85, softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: true,  ...COMMON, hardness: 0.25, blending: 0.4, dilution: 0.3, buildUp: true },
  spray:      { color: '#ef476f', size: 60, opacity: 0.7,  softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON },
  eraser:     { color: '#000000', size: 30, opacity: 1.0,  softness: 0.4, strength: 0.6, pressureSim: false, wetPaint: false, ...COMMON },
  smudge:     { color: '#000000', size: 36, opacity: 1.0,  softness: 0.5, strength: 0.55, pressureSim: false, wetPaint: false, ...COMMON },
  waterdrop:  { color: 'transparent', size: 80, opacity: 0.7, softness: 0.5, strength: 0.6, pressureSim: false, wetPaint: false, ...COMMON },
}

function pointAt(path: PathSpec, f: number): { x: number; y: number } {
  if (path.type === 'line' || path.type === 'dwell') {
    return { x: path.from[0] + (path.to[0] - path.from[0]) * f, y: path.from[1] + (path.to[1] - path.from[1]) * f }
  }
  return { x: path.xFrom + (path.xTo - path.xFrom) * f, y: path.yMid + path.amplitude * Math.sin(2 * Math.PI * path.cycles * f) }
}
function pressureAt(p: PressureSpec, f: number): { pressure: number; hasPressure: boolean } {
  if (p.type === 'none') return { pressure: 0, hasPressure: false }
  if (p.type === 'const') return { pressure: p.value, hasPressure: true }
  return { pressure: p.from + (p.to - p.from) * f, hasPressure: true }
}

function driveStroke(backend: RendererBackend, corpus: Corpus, spec: StrokeSpec) {
  const settings: ToolSettings = { ...HARNESS_SETTINGS[spec.tool], ...(spec.settings ?? {}) }
  const path = corpus.paths[spec.path]
  const profile = corpus.pressureProfiles[spec.pressure]
  if (!path) throw new Error(`unknown path "${spec.path}"`)
  if (!profile) throw new Error(`unknown pressure profile "${spec.pressure}"`)
  const dt = corpus.generator.sampleDtMs
  const eng = new StrokeEngine(backend, spec.tool, settings, HARNESS_ASSIST, HARNESS_SEED)
  let t = 0
  if (path.type === 'dwell') {
    for (let i = 0; i < path.moveSamples; i++) {
      const f = path.moveSamples === 1 ? 1 : i / (path.moveSamples - 1)
      const { x, y } = pointAt(path, f)
      const { pressure, hasPressure } = pressureAt(profile, f)
      const ip: InputPoint = { x, y, pressure, hasPressure, t }
      i === 0 ? eng.begin(ip) : eng.extend(ip)
      t += dt
    }
    for (let j = 0; j < path.holdSamples; j++) { eng.tick(t); t += dt }
    eng.end()
    return
  }
  const n = path.samples
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0 : i / (n - 1)
    const { x, y } = pointAt(path, f)
    const { pressure, hasPressure } = pressureAt(profile, f)
    const ip: InputPoint = { x, y, pressure, hasPressure, t }
    i === 0 ? eng.begin(ip) : eng.extend(ip)
    t += dt
  }
  eng.end()
}

/** Render a full corpus case onto the backend's surface: opaque white → setups → main ×repeat → then. */
export function drawCase(backend: RendererBackend, corpus: Corpus, c: CaseSpec) {
  const size = corpus.canvas.internalSize
  backend.clear()
  backend.fillRect(0, 0, size, size, corpus.canvas.background || '#ffffff', 1) // opaque bg the engine reads back
  for (const name of c.setup ?? []) {
    const s = corpus.setups[name]
    if (!s) throw new Error(`unknown setup "${name}"`)
    driveStroke(backend, corpus, s)
    if (s.then) driveStroke(backend, corpus, s.then)
  }
  const repeat = c.repeat ?? 1
  for (let r = 0; r < repeat; r++) driveStroke(backend, corpus, c)
  if (c.then) driveStroke(backend, corpus, c.then)
}
