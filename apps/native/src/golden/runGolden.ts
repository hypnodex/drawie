import { Image } from 'react-native'
import { Skia, ColorType, AlphaType, type SkImage } from '@shopify/react-native-skia'
import { RNSkiaBackend } from '../render/RNSkiaBackend'
import { drawCase, type Corpus, type CaseSpec } from './drive'
import { CAPTURES } from './captures'
import corpusJson from './corpus.json'

/**
 * Phase 6 golden runner — renders each corpus case through RNSkiaBackend, decodes the matching
 * Canvas2D baseline PNG, and diffs full-res with the SAME metrics as the web Skia golden
 * (skia-golden-entry.ts): meanAbs / maxAbs / pctDiff over white-flattened RGB, plus the ink ratio.
 * One variable changes vs the web run — RN-Skia vs CanvasKit rasterisation — so the numbers are
 * directly comparable to the web golden (det avg ~0.24, worst ~1.5/255).
 */

const corpus = corpusJson as unknown as Corpus
export const SIZE = corpus.canvas.internalSize
export const CASES = corpus.cases

// Tools whose stamps use rng (even seeded, RN-Skia's own draw order/AA can shift them) — reported
// but not hard-failed, mirroring skia-golden.mjs's STOCHASTIC set + the textured cases.
const STOCHASTIC = new Set(['pencil', 'spray', 'drybrush', 'inkbrush'])
export const isStochastic = (c: CaseSpec) => STOCHASTIC.has(c.tool) || c.id.includes('texture')

export interface GoldenResult {
  id: string; tool: string; stochastic: boolean
  meanAbs: number; maxAbs: number; pctDiff: number; inkA: number; inkB: number; inkRatio: number
  error?: string
}

function flattenWhite(d: Uint8Array | Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray((d.length / 4) * 3)
  for (let i = 0, o = 0; i < d.length; i += 4, o += 3) {
    const a = d[i + 3] / 255
    out[o] = d[i] * a + 255 * (1 - a)
    out[o + 1] = d[i + 1] * a + 255 * (1 - a)
    out[o + 2] = d[i + 2] * a + 255 * (1 - a)
  }
  return out
}
function inkOf(rgb: Uint8ClampedArray): number {
  let n = 0
  for (let i = 0; i < rgb.length; i += 3) if (Math.max(255 - rgb[i], 255 - rgb[i + 1], 255 - rgb[i + 2]) > 24) n++
  return n / (rgb.length / 3)
}

async function decodeBaseline(id: string): Promise<Uint8ClampedArray> {
  const mod = CAPTURES[id]
  if (mod == null) throw new Error('no bundled baseline')
  const uri = Image.resolveAssetSource(mod).uri
  const data = await Skia.Data.fromURI(uri)
  let img: SkImage | null = null
  try {
    img = Skia.Image.MakeImageFromEncoded(data)
    if (!img) throw new Error('decode failed')
    const w = img.width(), h = img.height()
    const px = img.readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul }) as Uint8Array | null
    if (!px) throw new Error('readPixels failed')
    if (w !== SIZE || h !== SIZE) throw new Error(`baseline ${w}x${h} != ${SIZE}`)
    return flattenWhite(px)
  } finally {
    img?.dispose?.()
    data.dispose?.()
  }
}

/** Run one case end-to-end. Never throws — a failure is captured in `error`. */
export async function runCase(c: CaseSpec): Promise<GoldenResult> {
  const stochastic = isStochastic(c)
  const base = { id: c.id, tool: c.tool, stochastic, meanAbs: 0, maxAbs: 0, pctDiff: 0, inkA: 0, inkB: 0, inkRatio: 0 }
  const backend = new RNSkiaBackend(Skia.Surface.Make(SIZE, SIZE)!, true)
  try {
    drawCase(backend, corpus, c)
    backend.flush?.()
    const region = backend.getRegion(0, 0, SIZE, SIZE)
    if (!region) throw new Error('surface readback failed')
    const a = flattenWhite(region.data)
    const b = await decodeBaseline(c.id)

    let sum = 0, max = 0, diff = 0
    for (let i = 0; i < a.length; i += 3) {
      const da = Math.abs(a[i] - b[i]), dg = Math.abs(a[i + 1] - b[i + 1]), db = Math.abs(a[i + 2] - b[i + 2])
      sum += da + dg + db
      const d = Math.max(da, dg, db)
      if (d > max) max = d
      if (d > 16) diff++
    }
    const n = a.length / 3
    const inkA = inkOf(a), inkB = inkOf(b)
    return { ...base, meanAbs: sum / (n * 3), maxAbs: max, pctDiff: (diff / n) * 100, inkA, inkB, inkRatio: inkB > 1e-9 ? inkA / inkB : inkA < 1e-9 ? 1 : Infinity }
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) }
  } finally {
    backend.dispose?.()
  }
}
