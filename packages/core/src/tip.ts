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
  const N = 14
  const bristles = Array.from({ length: N }, () => ({
    y: (rng() * 2 - 1) * 0.82,   // band centre across the short axis
    bw: 0.05 + rng() * 0.10,     // band half-width
    len: 0.78 + rng() * 0.22,    // reach along the long axis (0..1)
    amp: 0.55 + rng() * 0.45,    // band strength
  }))
  for (let py = 0; py < h; py++) {
    const ny = (py / (h - 1)) * 2 - 1
    for (let px = 0; px < w; px++) {
      const nx = (px / (w - 1)) * 2 - 1
      // Soft elliptical envelope; long axis weighted < 1 so the tip tapers to pointed ends.
      const env = Math.max(0, 1 - (nx * nx * 0.92 + ny * ny))
      let bristle = 0
      for (const b of bristles) {
        if (Math.abs(nx) > b.len) continue
        const d = (ny - b.y) / b.bw
        bristle = Math.max(bristle, b.amp * Math.exp(-d * d))
      }
      const a = Math.pow(env, 0.75) * (0.22 + 0.78 * bristle)
      const i = (py * w + px) * 4
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255
      data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255)
    }
  }
  cache = { data, width: w, height: h }
  return cache
}
