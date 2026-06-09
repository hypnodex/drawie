/**
 * Procedural mock artwork for neighboring tiles and the mosaic reveal.
 * Deterministic per seed so re-renders show the same content.
 */

import { mulberry32 } from '@drawie/core'

// Editorial palettes — every swatch is from the Drawie design system
// (ink / sage / cream / accent). The procedural mock artwork stays on-brand.
const PALETTES: string[][] = [
  // Sage forward — green canvas
  ['#2f5742', '#5c8a6c', '#c4dab8', '#dfeacf', '#f3f7ec'],
  // Ink-lime contrast
  ['#0d1a2d', '#264363', '#5c8a6c', '#d6ee5a', '#e6f593'],
  // Pale mint study
  ['#ffffff', '#f3f7ec', '#dfeacf', '#c4dab8', '#5c8a6c'],
  // Deep editorial — navy + sage
  ['#0d1a2d', '#152c49', '#264363', '#2f5742', '#5c8a6c'],
  // Lime forward
  ['#d6ee5a', '#b9d530', '#e6f593', '#dfeacf', '#0d1a2d'],
  // Warm-cool balance
  ['#264363', '#5c8a6c', '#dfeacf', '#d6ee5a', '#f3f7ec'],
]

export function renderMockTile(
  ctx: CanvasRenderingContext2D,
  size: number,
  seed: number,
) {
  const rand = mulberry32(seed)
  const palette = PALETTES[Math.floor(rand() * PALETTES.length)]

  // base wash
  const bg = ctx.createLinearGradient(0, 0, size, size)
  bg.addColorStop(0, palette[0] + '40')
  bg.addColorStop(1, palette[(seed % 4) + 1] + '20')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  // organic shapes
  const shapeCount = 6 + Math.floor(rand() * 6)
  for (let i = 0; i < shapeCount; i++) {
    const color = palette[Math.floor(rand() * palette.length)]
    ctx.fillStyle = color + '88'
    ctx.beginPath()
    const cx = rand() * size
    const cy = rand() * size
    const r = size * (0.05 + rand() * 0.18)
    if (rand() < 0.5) {
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
    } else {
      // jagged blob
      const pts = 6 + Math.floor(rand() * 4)
      for (let p = 0; p < pts; p++) {
        const ang = (p / pts) * Math.PI * 2
        const rr = r * (0.7 + rand() * 0.6)
        const x = cx + Math.cos(ang) * rr
        const y = cy + Math.sin(ang) * rr
        if (p === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.closePath()
    }
    ctx.fill()
  }

  // wandering line strokes
  const strokes = 4 + Math.floor(rand() * 5)
  for (let i = 0; i < strokes; i++) {
    ctx.strokeStyle = palette[Math.floor(rand() * palette.length)] + 'cc'
    ctx.lineWidth = size * (0.005 + rand() * 0.015)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    let x = rand() * size
    let y = rand() * size
    ctx.moveTo(x, y)
    const segs = 5 + Math.floor(rand() * 8)
    for (let s = 0; s < segs; s++) {
      const nx = x + (rand() - 0.5) * size * 0.4
      const ny = y + (rand() - 0.5) * size * 0.4
      const cx = (x + nx) / 2 + (rand() - 0.5) * size * 0.1
      const cy = (y + ny) / 2 + (rand() - 0.5) * size * 0.1
      ctx.quadraticCurveTo(cx, cy, nx, ny)
      x = nx; y = ny
    }
    ctx.stroke()
  }

  // tiny dots speckle
  const dots = 30 + Math.floor(rand() * 30)
  for (let i = 0; i < dots; i++) {
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)] + 'aa'
    ctx.beginPath()
    ctx.arc(rand() * size, rand() * size, size * 0.004 + rand() * size * 0.008, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * Build an HTMLCanvasElement for a mock tile of `size` px with a given seed.
 */
export function makeMockTileCanvas(size: number, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  renderMockTile(ctx, size, seed)
  return c
}
