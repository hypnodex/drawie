// Texture/Profi brush — decoupled into geometry (STEP 1) + texture overlay (STEP 2).
//
// STEP 1: a clean, continuous, variable-width FILLED ribbon from the input points + pressure, in the
// spirit of perfect-freehand. SPEED-INDEPENDENT: the input is streamlined (EMA) then resampled to uniform
// arc length with Catmull-Rom, so a fast scribble and a slow curve produce the same geometry.
//
// STEP 2: a FEW thin semi-transparent lengthwise STREAK lines follow the same resampled centerline, each
// offset across the stroke width along the local normal, with seeded per-streak colour/opacity variation +
// a slow drift along its length. They ride ON TOP of the solid ribbon — adding the smeared/brushy texture
// WITHOUT defining the geometry, so continuity is preserved. Flat (Route A, no height/lighting).
import type { RendererBackend } from './renderer'
import type { ToolSettings } from './types'
import { mulberry32 } from './rng'
import { DEFAULT_TEX } from './defaults'

export interface FreehandInput { x: number; y: number; pressure: number }

export interface FreehandOptions {
  size: number       // full stroke width at full pressure
  thinning: number   // 0..1 — how much low pressure thins the stroke
  streamline: number // 0..1 — input smoothing
  taperStart: number // fade-in taper distance at the START of the path (px); 0 = blunt start
  taperEnd: number   // fade-out taper distance at the END of the path (px); 0 = blunt end
  minPressure: number
  angle: number      // flat-brush angle in RADIANS (for angle-based width)
  angleWidth: number // 0..1 — how much the width varies with travel angle (0 = round)
}

/** A resampled centerline point with its local normal, half-width radius, and running length. */
export interface SpinePoint { x: number; y: number; nx: number; ny: number; radius: number; len: number }

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)
const cr = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

/** STEP 1 geometry: streamline → Catmull-Rom resample → per-point normal + pressure-thinned, tapered radius. */
export function buildSpine(input: FreehandInput[], opt: FreehandOptions): SpinePoint[] {
  if (input.length === 0) return []
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

  if (sm.length === 1) return [{ x: sm[0].x, y: sm[0].y, nx: 0, ny: 1, radius: radiusAt(sm[0].pressure), len: 0 }]

  // resample to uniform arc length via Catmull-Rom
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
  const len: number[] = [0]
  for (let i = 1; i < rs.length; i++) len.push(len[i - 1] + Math.hypot(rs[i].x - rs[i - 1].x, rs[i].y - rs[i - 1].y))
  const total = len[len.length - 1]

  const spine: SpinePoint[] = []
  for (let i = 0; i < rs.length; i++) {
    const p = rs[i]
    const a = rs[Math.max(0, i - 1)], b = rs[Math.min(rs.length - 1, i + 1)]
    let tx = b.x - a.x, ty = b.y - a.y
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl
    let radius = radiusAt(p.pressure)
    // angle-based width (flat brush): thin when travelling along `angle`, wide across it.
    if (opt.angleWidth > 0) {
      const c = Math.cos(Math.atan2(ty, tx) - opt.angle)
      const wMin = 1 - opt.angleWidth * 0.85
      radius *= Math.sqrt(1 - c * c + wMin * wMin * c * c) // sqrt(sin² + wMin²·cos²)
    }
    if (opt.taperStart > 0 || opt.taperEnd > 0) {
      const ts = opt.taperStart > 0 ? clamp01(len[i] / opt.taperStart) : 1
      const te = opt.taperEnd > 0 ? clamp01((total - len[i]) / opt.taperEnd) : 1
      const tp = Math.min(ts, te)
      radius *= tp * tp * (3 - 2 * tp)
    }
    spine.push({ x: p.x, y: p.y, nx: -ty, ny: tx, radius: Math.max(0.2, radius), len: len[i] })
  }
  return spine
}

/** Closed outline polygon (left edge forward + right edge backward) from a spine. */
export function outlineFromSpine(spine: SpinePoint[]): number[] {
  if (spine.length === 0) return []
  if (spine.length === 1) {
    const o = spine[0], out: number[] = []
    for (let ang = 0; ang < Math.PI * 2 - 1e-3; ang += Math.PI / 12) out.push(o.x + Math.cos(ang) * o.radius, o.y + Math.sin(ang) * o.radius)
    return out
  }
  const out: number[] = []
  for (let i = 0; i < spine.length; i++) out.push(spine[i].x + spine[i].nx * spine[i].radius, spine[i].y + spine[i].ny * spine[i].radius)
  for (let i = spine.length - 1; i >= 0; i--) out.push(spine[i].x - spine[i].nx * spine[i].radius, spine[i].y - spine[i].ny * spine[i].radius)
  return out
}

export function getStrokeOutline(input: FreehandInput[], opt: FreehandOptions): number[] {
  return outlineFromSpine(buildSpine(input, opt))
}

export function freehandOptions(settings: ToolSettings): FreehandOptions {
  const tex = settings.tex ?? DEFAULT_TEX
  return {
    size: settings.size,
    thinning: settings.pressureSim ? 0.5 : 0,
    streamline: tex.smoothing,
    taperStart: settings.size * tex.fadeIn,
    taperEnd: settings.size * tex.fadeOut,
    minPressure: 0.06,
    angle: tex.angle * Math.PI / 180,
    angleWidth: tex.angleWidth,
  }
}

// ── colour + noise helpers ───────────────────────────────────────────────────
const hx = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
function shiftColor(hex: string, hue: number, val: number, slow: number, amt: number): string {
  if (amt <= 0) return hex
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const k = amt * 40
  return `#${hx(r + (hue * 0.8 + slow) * k)}${hx(g + (val * 0.8 - slow * 0.4) * k)}${hx(b + (-hue * 0.6 + slow) * k)}`
}
// deterministic smooth 1-D noise in [0,1]
function noise1(x: number): number {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f)
  const h = (k: number) => { const s = Math.sin(k * 127.1) * 43758.5453; return s - Math.floor(s) }
  return h(i) * (1 - u) + h(i + 1) * u
}

/**
 * Render the Profi-brush stroke: STEP 1 the solid variable-width ribbon, then STEP 2 a few thin
 * semi-transparent lengthwise streaks on top (seeded → deterministic on web + native). Other tools
 * never call this.
 */
export function renderProfiStroke(backend: RendererBackend, pts: FreehandInput[], settings: ToolSettings, seed = 1, withStreaks = true) {
  if (!backend.fillPath || pts.length === 0) return
  const spine = buildSpine(pts, freehandOptions(settings))
  if (spine.length === 0) return
  const color = settings.color === 'transparent' ? '#000000' : settings.color

  // STEP 1 — solid ribbon
  const outline = outlineFromSpine(spine)
  if (outline.length >= 6) backend.fillPath(outline, color, settings.opacity)

  // STEP 2 — lengthwise streak overlay. Commit-time only by default (drawing N streak polylines every
  // frame on a growing stroke was the lag); the live preview shows just the ribbon.
  const tex = settings.tex ?? DEFAULT_TEX
  const N = Math.max(0, Math.min(16, Math.round(tex.bristles)))
  if (!withStreaks || !backend.strokeLine || spine.length < 2 || N === 0) return
  const cAmt = tex.colorRandom / 100
  const rng = mulberry32((seed >>> 0) || 1)
  for (let st = 0; st < N; st++) {
    const off = (rng() * 2 - 1) * 0.82      // across the width, inside the ribbon edge
    const hue = (rng() - 0.5) * 2
    const val = (rng() - 0.5) * 2
    const baseAlpha = 0.1 + rng() * 0.16    // faint
    const lw = 1.2 + rng() * 1.8            // thin
    const ns = rng() * 1000
    let px = 0, py = 0, has = false
    for (let i = 0; i < spine.length; i++) {
      const sp = spine[i]
      const ox = sp.x + sp.nx * off * sp.radius
      const oy = sp.y + sp.ny * off * sp.radius
      if (has) {
        const slow = noise1(sp.len * 0.018 + ns) - 0.5
        const col = shiftColor(color, hue, val, slow, cAmt)
        const a = Math.max(0, Math.min(1, baseAlpha * (0.6 + 0.7 * (slow + 0.5))))
        backend.strokeLine(px, py, ox, oy, lw, col, a)
      }
      px = ox; py = oy; has = true
    }
  }
}
