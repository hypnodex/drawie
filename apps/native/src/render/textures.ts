import type { BrushTexture } from '@drawie/core'
import { mulberry32, hashStringToSeed, type Rng } from '@drawie/core'

/**
 * DOM-free grain textures for the native Skia backend — the SAME seeded generation
 * as the web renderer's getTexturePixels (packages/renderer/src/textures.ts), kept
 * byte-identical so native grain matches web.
 *
 * NOTE: this duplicates the web generator. The clean follow-up is to hoist this pure,
 * DOM-free pixel generator into @drawie/core and have both the web renderer and this
 * native backend import it, so the two can't drift. Kept here for now so the verified
 * web package isn't refactored from a device-unverifiable change.
 */
const SIZE = 96
const pixelCache = new Map<BrushTexture, Uint8ClampedArray>()

export function getTexturePixels(id: BrushTexture): { data: Uint8ClampedArray; size: number } | null {
  if (id === 'none') return null
  let data = pixelCache.get(id)
  if (!data) {
    data = new Uint8ClampedArray(SIZE * SIZE * 4)
    const rand = mulberry32(hashStringToSeed(`texture:${id}`))
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const i = (y * SIZE + x) * 4
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255
        data[i + 3] = alphaFor(id, x, y, rand)
      }
    }
    pixelCache.set(id, data)
  }
  return { data, size: SIZE }
}

function alphaFor(id: BrushTexture, x: number, y: number, rand: Rng): number {
  switch (id) {
    case 'canvas': {
      const warp = (x % 4) < 2 ? 235 : 200
      const weft = (y % 4) < 2 ? 235 : 200
      const woven = Math.round((warp + weft) / 2)
      return clamp(woven - rand() * 30, 60, 255)
    }
    case 'grain': return 200 + Math.floor(rand() * 55)
    case 'noise': return 90 + Math.floor(rand() * 165)
    case 'speckle': return rand() < 0.18 ? 30 + Math.floor(rand() * 60) : 230 + Math.floor(rand() * 25)
    default: return 255
  }
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }
