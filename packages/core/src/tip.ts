// Texture-brush tip: a single elongated bristle/leaf ALPHA stamp, generated once (deterministic, fixed
// seed → byte-identical on web + native). RGB is white; only the alpha channel carries the shape, so a
// backend can tint it to the brush colour (SrcIn) at draw time. Long axis = X; the tip tapers to points
// at ±X (flat-brush ends) and has bristle streaks along X so a dragged stroke reads as bristled.
import { mulberry32 } from './rng'

export interface TipAlpha { data: Uint8ClampedArray; width: number; height: number }

const TIP_W = 96
const TIP_H = 36

let cache: TipAlpha | null = null

export function getTipAlpha(): TipAlpha {
  if (cache) return cache
  const w = TIP_W, h = TIP_H
  const data = new Uint8ClampedArray(w * h * 4)
  const rng = mulberry32(0x7e51b00c) // fixed seed → identical tip across platforms
  // A few faint bands give SUBTLE grain — NOT a wispy/feathery spray tip. The body stays solid; only the
  // alpha is gently modulated (0.86..1.0), so heavily-overlapping stamps build into a continuous stroke.
  const N = 9
  const bands = Array.from({ length: N }, () => ({
    y: (rng() * 2 - 1) * 0.8,    // band centre across the short axis
    bw: 0.08 + rng() * 0.12,     // band half-width
    amp: 0.4 + rng() * 0.6,      // band strength
  }))
  for (let py = 0; py < h; py++) {
    const ny = (py / (h - 1)) * 2 - 1
    for (let px = 0; px < w; px++) {
      const nx = (px / (w - 1)) * 2 - 1
      // Solid soft-edged ellipse (long axis weighted < 1 → slightly pointed flat-brush ends). Solid to
      // d≈0.74, then a smooth falloff to 0 at the edge.
      const d = Math.sqrt(nx * nx * 0.96 + ny * ny)
      let a = d >= 1 ? 0 : d <= 0.74 ? 1 : 1 - (d - 0.74) / 0.26
      a = a * a * (3 - 2 * a) // smoothstep the soft edge
      let grain = 0
      for (const b of bands) { const dd = (ny - b.y) / b.bw; grain += b.amp * Math.exp(-dd * dd) }
      a *= 0.86 + 0.14 * Math.min(1, grain) // faint grain only
      const i = (py * w + px) * 4
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255
      data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255)
    }
  }
  cache = { data, width: w, height: h }
  return cache
}
