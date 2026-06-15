// Deterministic stroke generator for the dev simulation harness. Produces ModelStroke-shaped strokes
// (NOT a 2D painter like apps/web mockTiles.ts) so the SAME data feeds the cross-platform replay
// pipeline on both web and native. Seeded via mulberry32 so a given seed reproduces the same art.
//
// Dev-only — only ever reached behind the simulation flag (see simulateNeighbors.ts).

import { mulberry32, DEFAULT_SETTINGS, DEFAULT_ASSIST, type Rng, type ToolId, type ModelStroke, type StrokeSample } from '@drawie/core'
import { ARTBOARD } from './types'

/** On-brand palette (lifted DOM-free from mockTiles.ts so the generator has no DOM dependency). */
const PALETTE = [
  '#2f5742', '#5c8a6c', '#264363', '#0d1a2d', '#d6ee5a',
  '#b9d530', '#ef476f', '#ffd166', '#118ab2', '#7c8cff',
]

/** Visible tools that read well in a thin sliver. */
const SIM_TOOLS: ToolId[] = ['brush', 'pencil', 'marker', 'inkbrush']

/** Axis-aligned region (tile-local) to keep a generated path inside. */
export interface Region { x0: number; y0: number; x1: number; y1: number }

const FULL: Region = { x0: 0, y0: 0, x1: ARTBOARD, y1: ARTBOARD }

export interface GenStrokeOpts {
  /** Keep the path within this region (default: the whole tile). */
  region?: Region
  /** Approx ms between captured samples (controls drawing speed). */
  sampleMs?: number
}

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v }

/**
 * Generate one wandering stroke. The path is a chain of quadratic-ish hops (same idea as the
 * mock-tile line strokes) sampled into many points with monotonically increasing `t`, so the
 * receiver's incremental replay reproduces a hand-drawn feel.
 */
export function genStroke(rng: Rng, opts: GenStrokeOpts = {}): ModelStroke {
  const region = opts.region ?? FULL
  const sampleMs = opts.sampleMs ?? 24
  const tool = SIM_TOOLS[Math.floor(rng() * SIM_TOOLS.length)]
  const color = PALETTE[Math.floor(rng() * PALETTE.length)]
  const w = region.x1 - region.x0
  const h = region.y1 - region.y0
  const span = Math.min(w, h)
  const size = clamp(span * (0.04 + rng() * 0.08), 4, 120)
  const settings = { ...DEFAULT_SETTINGS[tool], color, size }
  const seed = (rng() * 0xffffffff) >>> 0

  const samples: StrokeSample[] = []
  let x = region.x0 + rng() * w
  let y = region.y0 + rng() * h
  let t = 0
  const pushSample = (px: number, py: number) => {
    samples.push({
      x: clamp(px, region.x0, region.x1),
      y: clamp(py, region.y0, region.y1),
      pressure: 0.6 + rng() * 0.3,
      hasPressure: true,
      t,
    })
    t += sampleMs
  }
  pushSample(x, y)

  const segs = 3 + Math.floor(rng() * 5)
  for (let s = 0; s < segs; s++) {
    const nx = x + (rng() - 0.5) * w * 0.5
    const ny = y + (rng() - 0.5) * h * 0.5
    const cx = (x + nx) / 2 + (rng() - 0.5) * span * 0.2
    const cy = (y + ny) / 2 + (rng() - 0.5) * span * 0.2
    const steps = 5 + Math.floor(rng() * 6)
    for (let i = 1; i <= steps; i++) {
      const u = i / steps
      // Quadratic Bézier from (x,y) via control (cx,cy) to (nx,ny).
      const px = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * nx
      const py = (1 - u) * (1 - u) * y + 2 * (1 - u) * u * cy + u * u * ny
      pushSample(px, py)
    }
    x = nx; y = ny
  }

  return { toolId: tool, settings, assist: DEFAULT_ASSIST, seed, samples }
}

/** A pre-generated set of strokes for the "self-drawing painting" mode. */
export function genPainting(seed: number, strokeCount: number, region?: Region): ModelStroke[] {
  const rng = mulberry32(seed)
  const out: ModelStroke[] = []
  for (let i = 0; i < strokeCount; i++) out.push(genStroke(rng, { region }))
  return out
}
