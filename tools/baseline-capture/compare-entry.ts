/**
 * Browser entry for the Phase 2 PARITY harness. Renders each corpus case through
 * the NEW engine (StrokeEngine → Canvas2DBackend) and diffs it against the Phase 0
 * baseline PNG passed in from Node, returning quantified metrics.
 *
 * Two parity classes (see compare.mjs):
 *   - deterministic tools (pen/brush/marker/watercolor/eraser/smudge/waterdrop) draw
 *     no rng → expected to match the baseline to a tight pixel tolerance, proving the
 *     ctx→RendererBackend refactor is faithful.
 *   - stochastic tools (pencil/spray/drybrush/inkbrush + textured brush) draw from the
 *     seeded rng, which differs from the baseline's unseeded Math.random → verified by
 *     ink-coverage proximity instead of per-pixel diff.
 */
import { drawCase, type Corpus } from './replay'
import corpusJson from '../../docs/baseline/stroke-corpus.json'

const corpus = corpusJson as unknown as Corpus
const SIZE = corpus.canvas.internalSize

const canvas = document.createElement('canvas')
canvas.width = SIZE
canvas.height = SIZE
const ctx = canvas.getContext('2d', { willReadFrequently: true })!

const cmp = document.createElement('canvas')
cmp.width = SIZE
cmp.height = SIZE
const cctx = cmp.getContext('2d', { willReadFrequently: true })!

export interface CompareMetrics {
  id: string
  meanAbs: number    // mean abs channel diff over RGB channels, 0..255
  maxAbs: number     // worst single-channel abs diff, 0..255
  pctDiff: number    // % of pixels whose worst channel differs by > 16
  inkNew: number     // ink coverage of new render, 0..1
  inkBase: number    // ink coverage of baseline, 0..1
  inkRatio: number   // inkNew / inkBase (1 = identical mass)
  baseW: number      // baseline natural width (diagnostic)
}

declare global {
  interface Window {
    __caseIds: string[]
    __compare: (id: string) => Promise<CompareMetrics>
    __ready: boolean
  }
}

// Flatten an RGBA buffer onto white paper → straight RGB the user actually sees.
// This makes the comparison agnostic to whether a background is stored opaque-white
// or transparent (both flatten to white), and matches how a submitted PNG looks.
function flattenOverWhite(d: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray((d.length / 4) * 3)
  for (let i = 0, o = 0; i < d.length; i += 4, o += 3) {
    const a = d[i + 3] / 255
    out[o]     = d[i]     * a + 255 * (1 - a)
    out[o + 1] = d[i + 1] * a + 255 * (1 - a)
    out[o + 2] = d[i + 2] * a + 255 * (1 - a)
  }
  return out
}

function inkCoverage(rgb: Uint8ClampedArray): number {
  let ink = 0
  const n = rgb.length / 3
  for (let i = 0; i < rgb.length; i += 3) {
    // "ink" = any channel pulled meaningfully off white paper
    const off = Math.max(255 - rgb[i], 255 - rgb[i + 1], 255 - rgb[i + 2])
    if (off > 24) ink++
  }
  return ink / n
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`baseline decode failed: ${url}`))
    img.src = url
  })
}

window.__caseIds = corpus.cases.map((c) => c.id)

window.__compare = async (id: string): Promise<CompareMetrics> => {
  const c = corpus.cases.find((x) => x.id === id)
  if (!c) throw new Error(`no corpus case "${id}"`)

  // 1. render new output, flatten over white
  drawCase(ctx, corpus, c)
  const a = flattenOverWhite(ctx.getImageData(0, 0, SIZE, SIZE).data)

  // 2. load baseline by URL (Vite serves repo root), draw + flatten
  const img = await loadImage(`/docs/baseline/captures/${id}.png`)
  cctx.clearRect(0, 0, SIZE, SIZE)
  cctx.drawImage(img, 0, 0, SIZE, SIZE)
  const b = flattenOverWhite(cctx.getImageData(0, 0, SIZE, SIZE).data)

  // 3. diff over RGB
  let sumAbs = 0
  let maxAbs = 0
  let diffPixels = 0
  const nPx = a.length / 3
  for (let i = 0; i < a.length; i += 3) {
    let worst = 0
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(a[i + k] - b[i + k])
      sumAbs += d
      if (d > worst) worst = d
    }
    if (worst > maxAbs) maxAbs = worst
    if (worst > 16) diffPixels++
  }

  const inkNew = inkCoverage(a)
  const inkBase = inkCoverage(b)
  return {
    id,
    meanAbs: sumAbs / (nPx * 3),
    maxAbs,
    pctDiff: (diffPixels / nPx) * 100,
    inkNew,
    inkBase,
    inkRatio: inkBase > 1e-9 ? inkNew / inkBase : (inkNew < 1e-9 ? 1 : Infinity),
    baseW: img.naturalWidth,
  }
}

// Diagnostic: report WHERE a case differs (bbox of >16-diff pixels, worst pixel
// with both colours, and a coarse magnitude histogram). Used to root-cause parity gaps.
;(window as unknown as { __diag: (id: string) => Promise<unknown> }).__diag = async (id: string) => {
  const c = corpus.cases.find((x) => x.id === id)
  if (!c) throw new Error(`no corpus case "${id}"`)
  drawCase(ctx, corpus, c)
  const a = flattenOverWhite(ctx.getImageData(0, 0, SIZE, SIZE).data)
  const img = await loadImage(`/docs/baseline/captures/${id}.png`)
  cctx.clearRect(0, 0, SIZE, SIZE)
  cctx.drawImage(img, 0, 0, SIZE, SIZE)
  const b = flattenOverWhite(cctx.getImageData(0, 0, SIZE, SIZE).data)
  let minX = SIZE, minY = SIZE, maxX = -1, maxY = -1, worst = -1
  let worstA: number[] = [], worstB: number[] = [], worstXY = [0, 0]
  const buckets = [0, 0, 0, 0, 0] // 0-16, 16-32, 32-64, 64-128, 128-255
  for (let i = 0, px = 0; i < a.length; i += 3, px++) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i+1] - b[i+1]), Math.abs(a[i+2] - b[i+2]))
    buckets[d <= 16 ? 0 : d <= 32 ? 1 : d <= 64 ? 2 : d <= 128 ? 3 : 4]++
    if (d > 16) {
      const x = px % SIZE, y = (px / SIZE) | 0
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    if (d > worst) { worst = d; worstA = [a[i], a[i+1], a[i+2]]; worstB = [b[i], b[i+1], b[i+2]]; worstXY = [px % SIZE, (px / SIZE) | 0] }
  }
  return { id, bbox: [minX, minY, maxX, maxY], worst, worstXY, worstA, worstB, buckets }
}

window.__ready = true
