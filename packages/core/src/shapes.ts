import type { InputPoint } from './types'

/**
 * QuickShape-like detection + clean path generation.
 *
 * `analyzeShape` looks at a raw stroke and returns a discriminator describing
 * which canonical shape (if any) the user roughly drew. `generateShapePath`
 * turns that descriptor back into a dense `InputPoint[]` so the existing
 * StrokeEngine can stamp the cleaned-up version with the same brush.
 */

export type ShapeKind =
  | 'line'
  | 'circle'
  | 'ellipse'
  | 'arc'
  | 'rectangle'
  | 'square'
  | 'triangle'
  | 'freeform'

export type DetectedShape =
  | { kind: 'line'; from: Pt; to: Pt }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'arc'; cx: number; cy: number; r: number; startAngle: number; endAngle: number; ccw: boolean }
  | { kind: 'rectangle'; x: number; y: number; w: number; h: number }
  | { kind: 'square'; x: number; y: number; size: number }
  | { kind: 'triangle'; a: Pt; b: Pt; c: Pt }
  | { kind: 'freeform' }

interface Pt { x: number; y: number }

interface DetectOptions {
  /** 0..1 — higher = more aggressive snapping (lower thresholds). */
  strength: number
  /** When true, prefer mathematically exact shapes; when false, keep slight hand-drawn variance. */
  perfect: boolean
}

// ─── Detection ─────────────────────────────────────────────────────────────

export function analyzeShape(raw: InputPoint[], opt: DetectOptions): DetectedShape | null {
  if (raw.length < 6) return null

  const pts: Pt[] = raw.map((p) => ({ x: p.x, y: p.y }))
  const bbox = boundingBox(pts)
  const diag = Math.hypot(bbox.w, bbox.h)
  if (diag < 8) return null // dot-ish, leave alone

  const resampled = resampleEven(pts, Math.max(2, diag * 0.02))
  if (resampled.length < 4) return null

  const pathLen = polylineLength(resampled)
  const first = resampled[0]
  const last = resampled[resampled.length - 1]
  const closingDist = dist(first, last)
  const closed = closingDist < diag * 0.18

  const s = opt.strength

  // ─── Straight line ───
  // Path length ≈ direct distance
  const directDist = dist(first, last)
  if (!closed && pathLen > 0) {
    // strictness: subtle (0) → 0.96, strong (1) → 0.88
    const lineRatioMin = lerp(0.96, 0.88, s)
    if (directDist / pathLen >= lineRatioMin) {
      return { kind: 'line', from: first, to: last }
    }
  }

  // ─── Closed shapes ───
  if (closed) {
    // 1. Circle / Ellipse — radii from centroid are uniform-ish
    const center = centroid(resampled)
    const radii = resampled.map((p) => dist(p, center))
    const avgR = mean(radii)
    const stdRel = stddev(radii) / Math.max(1, avgR)
    const ellipseTol = lerp(0.10, 0.24, s)
    if (stdRel < ellipseTol && avgR > 4) {
      const aspect = bbox.w / Math.max(1, bbox.h)
      const circleAspectTol = lerp(0.12, 0.22, s)
      if (Math.abs(aspect - 1) < circleAspectTol) {
        return { kind: 'circle', cx: center.x, cy: center.y, r: (bbox.w + bbox.h) / 4 }
      }
      return { kind: 'ellipse', cx: center.x, cy: center.y, rx: bbox.w / 2, ry: bbox.h / 2 }
    }

    // 2. Polygon by simplification — count surviving corners
    const epsilon = diag * lerp(0.04, 0.10, s)
    const simplified = simplifyDP(resampled, epsilon)
    // simplified[0] == simplified[last] for closed; drop the duplicate
    const verts = simplified[0].x === simplified[simplified.length - 1].x &&
                  simplified[0].y === simplified[simplified.length - 1].y
                ? simplified.slice(0, -1)
                : simplified

    if (verts.length === 3) {
      return { kind: 'triangle', a: verts[0], b: verts[1], c: verts[2] }
    }
    if (verts.length === 4 && looksRectangular(verts, lerp(20, 30, s))) {
      const ax = Math.min(...verts.map((p) => p.x))
      const ay = Math.min(...verts.map((p) => p.y))
      const aw = Math.max(...verts.map((p) => p.x)) - ax
      const ah = Math.max(...verts.map((p) => p.y)) - ay
      const aspect = aw / Math.max(1, ah)
      const squareTol = lerp(0.12, 0.22, s)
      if (Math.abs(aspect - 1) < squareTol) {
        return { kind: 'square', x: ax, y: ay, size: (aw + ah) / 2 }
      }
      return { kind: 'rectangle', x: ax, y: ay, w: aw, h: ah }
    }
  } else {
    // ─── Open curve — arc detection ───
    const fit = fitCircleLeastSquares(resampled)
    if (fit) {
      const residuals = resampled.map((p) => Math.abs(dist(p, { x: fit.cx, y: fit.cy }) - fit.r))
      const meanRes = mean(residuals)
      const relRes = meanRes / Math.max(1, fit.r)
      const arcTol = lerp(0.06, 0.14, s)
      if (relRes < arcTol && fit.r < diag * 5) {
        const startAngle = Math.atan2(first.y - fit.cy, first.x - fit.cx)
        const endAngle = Math.atan2(last.y - fit.cy, last.x - fit.cx)
        const ccw = signedSweepIsCCW(resampled, fit.cx, fit.cy)
        return { kind: 'arc', cx: fit.cx, cy: fit.cy, r: fit.r, startAngle, endAngle, ccw }
      }
    }
  }

  return null  // freeform fallback (caller can smooth via Chaikin)
}

// ─── Path generation for replay ────────────────────────────────────────────

/**
 * Convert a detected shape back into a dense sequence of InputPoints that the
 * existing StrokeEngine can stamp. We seed pressure from the original stroke
 * (median pressure or 1) so brush dynamics that depend on pressure still apply.
 */
export function generateShapePath(
  shape: DetectedShape,
  rawForPressure: InputPoint[],
  perfect: boolean,
): InputPoint[] {
  const baseT = rawForPressure[0]?.t ?? 0
  const pressure = medianPressure(rawForPressure)
  const hasPressure = rawForPressure.some((p) => p.hasPressure)

  // Slight hand-drawn variation — used when perfect=false. We jitter the
  // perimeter sample positions by up to ~0.5px so the result reads as
  // "intentional" rather than mechanical.
  const wob = perfect ? 0 : 0.8

  const ip = (x: number, y: number, idx: number): InputPoint => ({
    x: x + (wob ? (Math.sin(idx * 1.7) * wob + Math.cos(idx * 0.9) * wob * 0.6) : 0),
    y: y + (wob ? (Math.cos(idx * 2.1) * wob + Math.sin(idx * 1.3) * wob * 0.6) : 0),
    pressure,
    hasPressure,
    t: baseT + idx,
  })

  switch (shape.kind) {
    case 'line': {
      const out: InputPoint[] = []
      const N = Math.max(8, Math.round(dist(shape.from, shape.to) / 2))
      for (let i = 0; i <= N; i++) {
        const t = i / N
        out.push(ip(
          shape.from.x + (shape.to.x - shape.from.x) * t,
          shape.from.y + (shape.to.y - shape.from.y) * t,
          i,
        ))
      }
      return out
    }

    case 'circle': {
      const out: InputPoint[] = []
      const N = Math.max(48, Math.round(2 * Math.PI * shape.r / 2))
      for (let i = 0; i <= N + 4; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2
        out.push(ip(shape.cx + Math.cos(a) * shape.r, shape.cy + Math.sin(a) * shape.r, i))
      }
      return out
    }

    case 'ellipse': {
      const out: InputPoint[] = []
      const perim = Math.PI * (3 * (shape.rx + shape.ry) - Math.sqrt((3 * shape.rx + shape.ry) * (shape.rx + 3 * shape.ry)))
      const N = Math.max(48, Math.round(perim / 2))
      for (let i = 0; i <= N + 4; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2
        out.push(ip(shape.cx + Math.cos(a) * shape.rx, shape.cy + Math.sin(a) * shape.ry, i))
      }
      return out
    }

    case 'arc': {
      const out: InputPoint[] = []
      let span = shape.endAngle - shape.startAngle
      if (shape.ccw) {
        if (span < 0) span += Math.PI * 2
      } else {
        if (span > 0) span -= Math.PI * 2
      }
      const N = Math.max(20, Math.round(Math.abs(span) * shape.r / 2))
      for (let i = 0; i <= N; i++) {
        const a = shape.startAngle + (span * i) / N
        out.push(ip(shape.cx + Math.cos(a) * shape.r, shape.cy + Math.sin(a) * shape.r, i))
      }
      return out
    }

    case 'rectangle':
    case 'square': {
      const w = shape.kind === 'square' ? shape.size : shape.w
      const h = shape.kind === 'square' ? shape.size : shape.h
      const x = shape.x, y = shape.y
      const corners: Pt[] = [
        { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y },
      ]
      const out: InputPoint[] = []
      let idx = 0
      for (let s = 0; s < 4; s++) {
        const a = corners[s], b = corners[s + 1]
        const len = dist(a, b)
        const N = Math.max(6, Math.round(len / 2))
        for (let i = 0; i < N; i++) {
          const t = i / N
          out.push(ip(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, idx++))
        }
      }
      out.push(ip(corners[0].x, corners[0].y, idx))
      return out
    }

    case 'triangle': {
      const a = shape.a, b = shape.b, c = shape.c
      const corners: Pt[] = [a, b, c, a]
      const out: InputPoint[] = []
      let idx = 0
      for (let s = 0; s < 3; s++) {
        const p1 = corners[s], p2 = corners[s + 1]
        const len = dist(p1, p2)
        const N = Math.max(8, Math.round(len / 2))
        for (let i = 0; i < N; i++) {
          const t = i / N
          out.push(ip(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t, idx++))
        }
      }
      out.push(ip(corners[0].x, corners[0].y, idx))
      return out
    }

    case 'freeform':
      return rawForPressure
  }
}

/**
 * When no shape was detected, smooth the freeform path with iterative
 * Chaikin corner-cutting so the result still feels intentional.
 */
export function smoothFreeform(raw: InputPoint[], strength: number): InputPoint[] {
  if (raw.length < 3) return raw
  const deduped = dedup(raw, 0.5)
  if (deduped.length < 3) return raw
  const iterations = Math.max(1, Math.min(6, Math.round(2 + strength * 4)))
  let pts = deduped
  for (let i = 0; i < iterations; i++) {
    if (pts.length > 4000) break
    pts = chaikinOnce(pts)
  }
  return pts
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function mean(xs: number[]): number { return xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length) }
function stddev(xs: number[]): number {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, xs.length))
}
function dist(a: Pt, b: Pt) { return Math.hypot(b.x - a.x, b.y - a.y) }
function centroid(pts: Pt[]): Pt {
  let sx = 0, sy = 0
  for (const p of pts) { sx += p.x; sy += p.y }
  return { x: sx / pts.length, y: sy / pts.length }
}
function boundingBox(pts: Pt[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
function polylineLength(pts: Pt[]): number {
  let L = 0
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i])
  return L
}
function resampleEven(pts: Pt[], spacing: number): Pt[] {
  if (pts.length < 2) return pts.slice()
  const out: Pt[] = [pts[0]]
  let acc = 0
  let prev = pts[0]
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i]
    const segLen = dist(prev, cur)
    if (segLen === 0) { prev = cur; continue }
    let dx = cur.x - prev.x, dy = cur.y - prev.y
    let traveled = -acc
    while (traveled + spacing <= segLen) {
      traveled += spacing
      const t = traveled / segLen
      out.push({ x: prev.x + dx * t, y: prev.y + dy * t })
    }
    acc = segLen - traveled
    prev = cur
  }
  out.push(pts[pts.length - 1])
  return out
}
function dedup(points: InputPoint[], minDist: number): InputPoint[] {
  const out: InputPoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const a = out[out.length - 1]
    const b = points[i]
    if (Math.hypot(b.x - a.x, b.y - a.y) >= minDist) out.push(b)
  }
  return out
}

function simplifyDP(points: Pt[], epsilon: number): Pt[] {
  const n = points.length
  if (n <= 2) return points.slice()
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack: Array<[number, number]> = [[0, n - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()!
    let maxDist = 0
    let maxIdx = -1
    const a = points[first]
    const b = points[last]
    for (let i = first + 1; i < last; i++) {
      const d = perpDistance(points[i], a, b)
      if (d > maxDist) { maxDist = d; maxIdx = i }
    }
    if (maxIdx !== -1 && maxDist > epsilon) {
      keep[maxIdx] = 1
      stack.push([first, maxIdx])
      stack.push([maxIdx, last])
    }
  }
  const result: Pt[] = []
  for (let i = 0; i < n; i++) if (keep[i]) result.push(points[i])
  return result
}
function perpDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / Math.sqrt(len2)
}

function looksRectangular(verts: Pt[], maxAngleDevDeg: number): boolean {
  if (verts.length !== 4) return false
  for (let i = 0; i < 4; i++) {
    const a = verts[(i + 3) % 4]
    const b = verts[i]
    const c = verts[(i + 1) % 4]
    const v1 = { x: a.x - b.x, y: a.y - b.y }
    const v2 = { x: c.x - b.x, y: c.y - b.y }
    const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y)
    if (m1 === 0 || m2 === 0) return false
    const cosA = (v1.x * v2.x + v1.y * v2.y) / (m1 * m2)
    const ang = Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI
    if (Math.abs(ang - 90) > maxAngleDevDeg) return false
  }
  return true
}

/**
 * Least-squares circle fit. Uses the algebraic Kåsa method — fast, good enough
 * to seed an arc heuristic. Returns null if the system is degenerate.
 */
function fitCircleLeastSquares(pts: Pt[]): { cx: number; cy: number; r: number } | null {
  const n = pts.length
  if (n < 3) return null
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0
  let sumX3 = 0, sumY3 = 0, sumX1Y2 = 0, sumX2Y1 = 0
  for (const p of pts) {
    const x = p.x, y = p.y
    const x2 = x * x, y2 = y * y
    sumX += x; sumY += y
    sumX2 += x2; sumY2 += y2; sumXY += x * y
    sumX3 += x2 * x; sumY3 += y2 * y
    sumX1Y2 += x * y2; sumX2Y1 += x2 * y
  }
  const C = n * sumX2 - sumX * sumX
  const D = n * sumXY - sumX * sumY
  const E = n * sumX3 + n * sumX1Y2 - (sumX2 + sumY2) * sumX
  const G = n * sumY2 - sumY * sumY
  const H = n * sumX2Y1 + n * sumY3 - (sumX2 + sumY2) * sumY
  const denom = 2 * (C * G - D * D)
  if (Math.abs(denom) < 1e-6) return null
  const a = (E * G - D * H) / denom
  const b = (C * H - D * E) / denom
  const cx = a
  const cy = b
  // r as mean radial distance — more robust than the algebraic constant
  const r = mean(pts.map((p) => Math.hypot(p.x - cx, p.y - cy)))
  return { cx, cy, r }
}

function signedSweepIsCCW(pts: Pt[], cx: number, cy: number): boolean {
  // Sum of signed angle deltas from center; positive total → CCW.
  let total = 0
  let prev = Math.atan2(pts[0].y - cy, pts[0].x - cx)
  for (let i = 1; i < pts.length; i++) {
    const cur = Math.atan2(pts[i].y - cy, pts[i].x - cx)
    let d = cur - prev
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    total += d
    prev = cur
  }
  return total > 0
}

function medianPressure(raw: InputPoint[]): number {
  if (!raw.length) return 1
  const ps = raw.map((p) => p.pressure || 1).sort((a, b) => a - b)
  return ps[Math.floor(ps.length / 2)] || 1
}

function chaikinOnce(pts: InputPoint[]): InputPoint[] {
  const n = pts.length
  if (n < 3) return pts
  const out: InputPoint[] = [pts[0]]
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    out.push(mix(a, b, 0.25))
    out.push(mix(a, b, 0.75))
  }
  out.push(pts[n - 1])
  return out
}
function mix(a: InputPoint, b: InputPoint, t: number): InputPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    pressure: a.pressure + (b.pressure - a.pressure) * t,
    hasPressure: a.hasPressure || b.hasPressure,
    t: a.t + (b.t - a.t) * t,
  }
}
