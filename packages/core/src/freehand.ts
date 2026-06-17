// Texture/Profi brush — STEP 1 geometry: a clean, continuous, variable-width FILLED stroke outline from
// the input points + pressure, in the spirit of perfect-freehand. SPEED-INDEPENDENT: the input is
// streamlined (EMA) then resampled to uniform arc length with Catmull-Rom, so a fast scribble and a slow
// curve produce the same geometry. Returns a flat CLOSED polygon [x0,y0,x1,y1,...] for backend.fillPath.
import type { RendererBackend } from './renderer'
import type { ToolSettings } from './types'

export interface FreehandInput { x: number; y: number; pressure: number }

export interface FreehandOptions {
  size: number       // full stroke width at full pressure
  thinning: number   // 0..1 — how much low pressure thins the stroke
  streamline: number // 0..1 — input smoothing
  taper: number      // taper distance at each end (px) → rounded ends
  minPressure: number
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)
const cr = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

export function getStrokeOutline(input: FreehandInput[], opt: FreehandOptions): number[] {
  if (input.length === 0) return []
  // 1) streamline (EMA) + drop too-close points
  const s = clamp01(opt.streamline)
  const sm: FreehandInput[] = [{ ...input[0] }]
  for (let i = 1; i < input.length; i++) {
    const prev = sm[sm.length - 1]
    const x = prev.x + (input[i].x - prev.x) * (1 - s)
    const y = prev.y + (input[i].y - prev.y) * (1 - s)
    const pr = prev.pressure + (input[i].pressure - prev.pressure) * (1 - s)
    if (i < input.length - 1 && Math.hypot(x - prev.x, y - prev.y) < 1) continue
    sm.push({ x, y, pressure: pr })
  }

  const radiusAt = (pressure: number) => Math.max(0.2, (opt.size / 2) * (1 - opt.thinning * (1 - Math.max(opt.minPressure, pressure))))

  if (sm.length === 1) { // a dot
    const r = radiusAt(sm[0].pressure)
    const out: number[] = []
    for (let a = 0; a < Math.PI * 2 - 1e-3; a += Math.PI / 12) out.push(sm[0].x + Math.cos(a) * r, sm[0].y + Math.sin(a) * r)
    return out
  }

  // 2) resample to uniform arc length via Catmull-Rom → smooth curve, independent of input density/speed
  const STEP = 3
  const rs: FreehandInput[] = [{ ...sm[0] }]
  const n = sm.length
  for (let i = 0; i < n - 1; i++) {
    const p0 = sm[Math.max(0, i - 1)], p1 = sm[i], p2 = sm[i + 1], p3 = sm[Math.min(n - 1, i + 2)]
    const steps = Math.max(1, Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / STEP))
    for (let k = 1; k <= steps; k++) {
      const t = k / steps
      rs.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), y: cr(p0.y, p1.y, p2.y, p3.y, t), pressure: p1.pressure + (p2.pressure - p1.pressure) * t })
    }
  }

  // 3) running length
  const len: number[] = [0]
  for (let i = 1; i < rs.length; i++) len.push(len[i - 1] + Math.hypot(rs[i].x - rs[i - 1].x, rs[i].y - rs[i - 1].y))
  const total = len[len.length - 1]

  // 4) variable-width outline (left edge forward + right edge backward → closed polygon)
  const left: number[] = [], right: number[] = []
  for (let i = 0; i < rs.length; i++) {
    const p = rs[i]
    const a = rs[Math.max(0, i - 1)], b = rs[Math.min(rs.length - 1, i + 1)]
    let tx = b.x - a.x, ty = b.y - a.y
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl
    const nx = -ty, ny = tx
    let radius = radiusAt(p.pressure)
    if (opt.taper > 0) {
      const tp = Math.min(clamp01(len[i] / opt.taper), clamp01((total - len[i]) / opt.taper))
      radius *= tp * tp * (3 - 2 * tp) // smoothstep taper to a rounded point at each end
    }
    radius = Math.max(0.2, radius)
    left.push(p.x + nx * radius, p.y + ny * radius)
    right.push(p.x - nx * radius, p.y - ny * radius)
  }
  const outline: number[] = []
  for (let i = 0; i < left.length; i += 2) outline.push(left[i], left[i + 1])
  for (let i = right.length - 2; i >= 0; i -= 2) outline.push(right[i], right[i + 1])
  return outline
}

/** Default freehand options derived from the tool settings. */
export function freehandOptions(settings: ToolSettings): FreehandOptions {
  return {
    size: settings.size,
    thinning: settings.pressureSim ? 0.5 : 0,
    streamline: 0.5,
    taper: settings.size * 0.5,
    minPressure: 0.06,
  }
}

/**
 * STEP 1 render: one clean, continuous, variable-width FILLED ribbon. No texture yet. `seed` is unused
 * for now (reserved for the STEP 2 streak overlay). Renders through the shared RendererBackend so web
 * (CanvasKit) and native (react-native-skia) are identical.
 */
export function renderProfiStroke(backend: RendererBackend, pts: FreehandInput[], settings: ToolSettings, _seed = 1) {
  if (!backend.fillPath || pts.length === 0) return
  const outline = getStrokeOutline(pts, freehandOptions(settings))
  if (outline.length < 6) return
  const color = settings.color === 'transparent' ? '#000000' : settings.color
  backend.fillPath(outline, color, settings.opacity)
}
