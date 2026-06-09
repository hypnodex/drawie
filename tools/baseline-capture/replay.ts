/**
 * Deterministic corpus replay — the reusable heart of the parity harness.
 *
 * Given the current `StrokeEngine` and a `docs/baseline/stroke-corpus.json` case,
 * this expands the case's pinned (path, pressureProfile, settings) into the exact
 * `InputPoint[]` the engine consumes and drives begin/extend/tick/end against a 2D
 * context — mirroring how `Canvas.tsx` drives a real pointer stroke.
 *
 * It is intentionally renderer-agnostic about *how* the context paints: today it
 * runs against the pre-migration Canvas-2D engine to produce the Phase 0 baseline;
 * the same replay is meant to be reused as the Phase 6 golden-image CI seed
 * (replay a corpus model through web-Skia and native-Skia and diff).
 */
import { StrokeEngine, type InputPoint } from '@drawie/core'
import type { ToolId, ToolSettings, ToolSettingsMap, AssistSettings } from '@drawie/core'
import { Canvas2DBackend } from '@drawie/renderer'

// Fixed seed so the harness is reproducible run-to-run. (The Phase 0 baseline was
// captured with the pre-migration engine's unseeded Math.random, so stochastic
// tools — pencil/spray/drybrush/inkbrush — won't pixel-match; they're verified by
// ink-coverage instead. Deterministic tools don't draw from the rng at all.)
const HARNESS_SEED = 0x9e3779b9

// ── Defaults ────────────────────────────────────────────────────────────────
// Mirror of `DEFAULT_SETTINGS` in src/screens/DrawingScreen.tsx and `DEFAULT_ASSIST`
// in src/drawing/engine.ts. Kept here so the harness has no React/UI dependency.
// ⚠ Keep in sync with the app; these get centralized into packages/core in Phase 1,
// at which point both the app and this harness should import the single source.
const COMMON = {
  hardness: 0.6, shape: 'circle' as const, texture: 'none' as const,
  blending: 0, dilution: 0, persistence: 0.7, buildUp: false,
}
export const DEFAULT_SETTINGS: ToolSettingsMap = {
  brush:      { color: '#7c8cff', size: 28, opacity: 0.85, softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON, buildUp: true },
  drybrush:   { color: '#111318', size: 46, opacity: 0.95, softness: 0.5, strength: 0.65,pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  inkbrush:   { color: '#0a0b0e', size: 64, opacity: 1.0,  softness: 0.5, strength: 0.5, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  pencil:     { color: '#0a0b0e', size: 6,  opacity: 0.85, softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  pen:        { color: '#111318', size: 4,  opacity: 1.0,  softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  marker:     { color: '#ffd166', size: 36, opacity: 0.6,  softness: 0.5, strength: 0.6, pressureSim: false, wetPaint: false, ...COMMON, hardness: 0.75, buildUp: true },
  watercolor: { color: '#118ab2', size: 40, opacity: 0.85, softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: true,  ...COMMON, hardness: 0.25, blending: 0.4, dilution: 0.3, buildUp: true },
  spray:      { color: '#ef476f', size: 60, opacity: 0.7,  softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON },
  eraser:     { color: '#000000', size: 30, opacity: 1.0,  softness: 0.4, strength: 0.6, pressureSim: false, wetPaint: false, ...COMMON },
  smudge:     { color: '#000000', size: 36, opacity: 1.0,  softness: 0.5, strength: 0.55,pressureSim: false, wetPaint: false, ...COMMON },
  waterdrop:  { color: 'transparent', size: 80, opacity: 0.7, softness: 0.5, strength: 0.6, pressureSim: false, wetPaint: false, ...COMMON },
}

const DEFAULT_ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5,
  shapeAssist: false, shapeStrength: 0.6,
  perfectShape: true, holdToSnap: false, holdDelay: 500,
}

// ── Corpus shape (loose — see docs/baseline/stroke-corpus.json) ───────────────
type PathSpec =
  | { type: 'line';  from: [number, number]; to: [number, number]; samples: number }
  | { type: 'sine';  xFrom: number; xTo: number; yMid: number; amplitude: number; cycles: number; samples: number }
  | { type: 'dwell'; from: [number, number]; to: [number, number]; moveSamples: number; holdSamples: number }
type PressureSpec =
  | { type: 'const'; value: number }
  | { type: 'linear'; from: number; to: number }
  | { type: 'none' }
type StrokeSpec = { tool: ToolId; path: string; pressure: string; settings?: Partial<ToolSettings>; then?: StrokeSpec }
type CaseSpec = StrokeSpec & { id: string; setup?: string[]; repeat?: number }
export interface Corpus {
  canvas: { internalSize: number; background: string }
  generator: { sampleDtMs: number }
  pressureProfiles: Record<string, PressureSpec>
  paths: Record<string, PathSpec>
  setups: Record<string, StrokeSpec>
  cases: CaseSpec[]
}

// ── Expansion helpers (follow corpus.generator.rule exactly) ─────────────────
function pointAt(path: PathSpec, f: number): { x: number; y: number } {
  if (path.type === 'line' || path.type === 'dwell') {
    return { x: path.from[0] + (path.to[0] - path.from[0]) * f, y: path.from[1] + (path.to[1] - path.from[1]) * f }
  }
  // sine
  return { x: path.xFrom + (path.xTo - path.xFrom) * f, y: path.yMid + path.amplitude * Math.sin(2 * Math.PI * path.cycles * f) }
}

function pressureAt(profile: PressureSpec, f: number): { pressure: number; hasPressure: boolean } {
  if (profile.type === 'none')   return { pressure: 0, hasPressure: false }
  if (profile.type === 'const')  return { pressure: profile.value, hasPressure: true }
  return { pressure: profile.from + (profile.to - profile.from) * f, hasPressure: true } // linear
}

// ── Drive one stroke ─────────────────────────────────────────────────────────
function drawOneStroke(ctx: CanvasRenderingContext2D, corpus: Corpus, spec: StrokeSpec) {
  const settings: ToolSettings = { ...DEFAULT_SETTINGS[spec.tool], ...(spec.settings ?? {}) }
  const path = corpus.paths[spec.path]
  const profile = corpus.pressureProfiles[spec.pressure]
  if (!path) throw new Error(`unknown path "${spec.path}"`)
  if (!profile) throw new Error(`unknown pressure profile "${spec.pressure}"`)
  const dt = corpus.generator.sampleDtMs
  const eng = new StrokeEngine(new Canvas2DBackend(ctx), spec.tool, settings, DEFAULT_ASSIST, HARNESS_SEED)

  let t = 0
  if (path.type === 'dwell') {
    // Moving segment, then a stationary hold that drives StrokeEngine.tick() pooling
    // (watercolor). A real pointer fires no pointermove while still, but the host rAF
    // loop keeps calling tick(now) — replicated here at the corpus sample cadence.
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

/** Render a full corpus case (white bg → setups → main stroke ×repeat → `then`) into `ctx`. */
export function drawCase(ctx: CanvasRenderingContext2D, corpus: Corpus, c: CaseSpec) {
  const size = corpus.canvas.internalSize
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = corpus.canvas.background || '#ffffff'
  ctx.fillRect(0, 0, size, size)

  for (const name of c.setup ?? []) {
    const s = corpus.setups[name]
    if (!s) throw new Error(`unknown setup "${name}"`)
    drawOneStroke(ctx, corpus, s)
    if (s.then) drawOneStroke(ctx, corpus, s.then)
  }

  const repeat = c.repeat ?? 1
  for (let r = 0; r < repeat; r++) drawOneStroke(ctx, corpus, c)
  if (c.then) drawOneStroke(ctx, corpus, c.then)

  ctx.restore()
}
