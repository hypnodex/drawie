import type { BrushTexture } from '@drawie/core'

/**
 * Procedurally-generated grain textures used as alpha masks on brush/marker
 * stamps. Each texture is a small grayscale-alpha canvas designed to tile
 * seamlessly via createPattern('repeat'). The RGB stays at 255; only the
 * alpha channel varies, so a destination-in composite removes brush pixels
 * proportionally to the texture's transparency.
 */

const cache = new Map<BrushTexture, HTMLCanvasElement>()
const SIZE = 96

export function getTextureCanvas(id: BrushTexture): HTMLCanvasElement | null {
  if (id === 'none') return null
  const cached = cache.get(id)
  if (cached) return cached
  const c = makeTexture(id)
  cache.set(id, c)
  return c
}

function makeTexture(id: BrushTexture): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(SIZE, SIZE)
  const d = img.data

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4
      d[i] = 255
      d[i + 1] = 255
      d[i + 2] = 255
      d[i + 3] = alphaFor(id, x, y)
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function alphaFor(id: BrushTexture, x: number, y: number): number {
  switch (id) {
    case 'canvas': {
      // Cross-hatched weave: stripes intersecting with noise.
      const warp = (x % 4) < 2 ? 235 : 200
      const weft = (y % 4) < 2 ? 235 : 200
      const woven = Math.round((warp + weft) / 2)
      const noise = Math.random() * 30
      return clamp(woven - noise, 60, 255)
    }
    case 'grain': {
      // Fine paper grain — subtle, mostly opaque
      return 200 + Math.floor(Math.random() * 55)
    }
    case 'noise': {
      // High-contrast TV static
      return 90 + Math.floor(Math.random() * 165)
    }
    case 'speckle': {
      // Sparse holes — like a sponge
      return Math.random() < 0.18 ? 30 + Math.floor(Math.random() * 60)
                                  : 230 + Math.floor(Math.random() * 25)
    }
    default:
      return 255
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Apply a texture mask to a destination context within a stamp rectangle.
 * The pattern is aligned to world coordinates so neighbouring stamps share
 * the same texture (stamps don't drift as the stroke moves).
 */
export function applyTextureMask(
  ctx: CanvasRenderingContext2D,
  texture: BrushTexture,
  rectX: number, rectY: number,
  width: number, height: number,
  worldX: number, worldY: number,
) {
  if (texture === 'none') return
  const tex = getTextureCanvas(texture)
  if (!tex) return
  const pat = ctx.createPattern(tex, 'repeat')
  if (!pat) return
  // Align pattern to world space so adjacent stamps line up
  if (typeof (pat as CanvasPattern).setTransform === 'function') {
    const m = new DOMMatrix().translate(-worldX, -worldY)
    pat.setTransform(m)
  }
  const prev = ctx.globalCompositeOperation
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = pat
  ctx.fillRect(rectX, rectY, width, height)
  ctx.restore()
  ctx.globalCompositeOperation = prev
}
