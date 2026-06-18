import type {
  RendererBackend, GradientStop, Box, CompositeOp, RGBA, PixelRegion, BrushTexture,
} from '@drawie/core'
import { applyTextureMask } from './textures'

const clampI = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i)

/** One separable box-blur pass, horizontal then vertical, via a radius-independent running sum. */
function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, vertical: boolean) {
  const norm = 1 / (r * 2 + 1)
  const major = vertical ? w : h          // number of lines
  const minor = vertical ? h : w          // length of each line
  const step = vertical ? w : 1           // index stride within a line
  for (let m = 0; m < major; m++) {
    const base = vertical ? m : m * w
    let sum = 0
    for (let i = -r; i <= r; i++) sum += src[base + clampI(i, minor) * step]
    for (let k = 0; k < minor; k++) {
      dst[base + k * step] = sum * norm
      sum += src[base + clampI(k + r + 1, minor) * step] - src[base + clampI(k - r, minor) * step]
    }
  }
}

// Reused scratch (grow-only) so the per-frame blur during a live profibrush stroke doesn't churn the GC.
let _blurA: Float32Array | null = null
let _blurT: Float32Array | null = null

/** Soften the ALPHA channel of an RGBA buffer with a 3-pass box blur (≈ Gaussian sigma≈radius). */
function boxBlurAlpha(data: Uint8ClampedArray, w: number, h: number, radius: number) {
  if (radius < 1 || w < 1 || h < 1) return
  const n = w * h
  if (!_blurA || _blurA.length < n) { _blurA = new Float32Array(n); _blurT = new Float32Array(n) }
  const a = _blurA, t = _blurT!
  for (let i = 0; i < n; i++) a[i] = data[i * 4 + 3]
  for (let p = 0; p < 3; p++) {
    boxPass(a, t, w, h, radius, false) // horizontal
    boxPass(t, a, w, h, radius, true)  // vertical
  }
  for (let i = 0; i < n; i++) data[i * 4 + 3] = a[i]
}

/** Parse "#rrggbb" → [r,g,b]; fall back to the colour of any near-opaque pixel already in `data`. */
function rgbOf(color: string, data: Uint8ClampedArray): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim())
  if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] }
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) return [data[i], data[i + 1], data[i + 2]]
  return [0, 0, 0]
}

/**
 * Canvas2DBackend — the RendererBackend implemented against a CanvasRenderingContext2D.
 *
 * This is a faithful, op-for-op reproduction of the original direct-to-ctx engine:
 * each primitive maps onto exactly the save/composite/alpha/fill sequence the
 * pre-migration code performed, so output matches the Phase 0 baseline. It is the
 * transitional/parity backend — the SkiaBackend (Phase 4) implements the same
 * interface for web (CanvasKit) and native (react-native-skia).
 */
export class Canvas2DBackend implements RendererBackend {
  readonly canvas: HTMLCanvasElement

  // Scratch-surface pool (owner-side): free-list of throwaway canvases keyed by "WxH". The smudge/
  // waterdrop/textured-stamp tools allocate a temp surface PER STAMP; without pooling that was a
  // document.createElement('canvas') (+ GC) on every stamp — the dominant web smudge lag. Sizes are
  // constant within a stroke, so after the first stamp every createSurface() is a pool hit (clearRect).
  private scratchPool?: Map<string, HTMLCanvasElement[]>
  // Surface-side: set on a backend returned by createSurface() so dispose() can return its canvas.
  private pooledBy?: Canvas2DBackend
  private poolKey?: string
  // Reusable (grow-only) offscreen for blurred fillPath. A ctx.filter promotes its canvas to GPU-backed,
  // and a drawImage FROM a GPU-backed canvas promotes the DESTINATION too — which would flip the live layer
  // to GPU and make every later getImageData (brush build-up / smudge pickup) stall on a GPU→CPU readback.
  // Forcing this offscreen CPU-backed (willReadFrequently) keeps the filter + composite entirely on the CPU,
  // so the layer never flips and reads stay fast. blurCtx is created ONCE with the flag (it only applies to
  // the first getContext of a canvas).
  private blurCanvas?: HTMLCanvasElement
  private blurCtx?: CanvasRenderingContext2D

  constructor(private ctx: CanvasRenderingContext2D) {
    this.canvas = ctx.canvas
  }

  get width() { return this.canvas.width }
  get height() { return this.canvas.height }

  fillCircle(x: number, y: number, r: number, color: string, alpha: number, composite?: CompositeOp) {
    const ctx = this.ctx
    ctx.save()
    if (composite) ctx.globalCompositeOperation = composite
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  strokeLine(
    x0: number, y0: number, x1: number, y1: number,
    width: number, color: string, alpha: number, composite?: CompositeOp,
  ) {
    const ctx = this.ctx
    ctx.save()
    if (composite) ctx.globalCompositeOperation = composite
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    ctx.restore()
  }

  strokePolyline(pts: number[], width: number, color: string, alpha: number, composite?: CompositeOp) {
    if (pts.length < 4) return
    const ctx = this.ctx
    ctx.save()
    if (composite) ctx.globalCompositeOperation = composite
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
    ctx.stroke()
    ctx.restore()
  }

  fillRect(x: number, y: number, w: number, h: number, color: string, alpha: number, composite?: CompositeOp) {
    const ctx = this.ctx
    ctx.save()
    if (composite) ctx.globalCompositeOperation = composite
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
    ctx.restore()
  }

  fillPath(pts: number[], color: string, alpha: number, composite?: CompositeOp, blur = 0) {
    if (pts.length < 6) return
    const ctx = this.ctx

    if (blur > 0) {
      // Render the blurred fill OFFSCREEN (so ctx.filter never touches the live layer — see blurCanvas).
      // Bounding box of the polygon, padded for the blur spread.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i], y = pts[i + 1]
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
      const pad = Math.ceil(blur * 3) + 2
      const bx = Math.floor(minX - pad), by = Math.floor(minY - pad)
      const bw = Math.ceil(maxX + pad) - bx, bh = Math.ceil(maxY + pad) - by
      if (bw <= 0 || bh <= 0) return
      if (!this.blurCanvas) {
        this.blurCanvas = document.createElement('canvas')
        this.blurCtx = this.blurCanvas.getContext('2d', { willReadFrequently: true })!
      }
      const c = this.blurCanvas
      const bctx = this.blurCtx!
      if (c.width < bw || c.height < bh) { c.width = Math.max(c.width, bw); c.height = Math.max(c.height, bh) }
      bctx.clearRect(0, 0, bw, bh)
      // Fill the ribbon SHARP (no ctx.filter — that would GPU-promote this canvas, and a drawImage from a
      // GPU canvas promotes the layer too). Then soften in pure JS so everything stays CPU.
      bctx.fillStyle = color
      bctx.beginPath()
      bctx.moveTo(pts[0] - bx, pts[1] - by)
      for (let i = 2; i < pts.length; i += 2) bctx.lineTo(pts[i] - bx, pts[i + 1] - by)
      bctx.closePath()
      bctx.fill('nonzero')
      // Box-blur the ALPHA channel (the ribbon is a solid colour, so blurring alpha is fringe-free and
      // closely matches a Gaussian blur(Npx) with 3 passes at radius≈N), then re-solidify RGB to the fill
      // colour so softened edge pixels don't darken.
      const img = bctx.getImageData(0, 0, bw, bh)
      boxBlurAlpha(img.data, bw, bh, Math.max(1, Math.round(blur)))
      const [cr, cg, cb] = rgbOf(color, img.data)
      const d = img.data
      for (let i = 0; i < d.length; i += 4) { d[i] = cr; d[i + 1] = cg; d[i + 2] = cb }
      bctx.putImageData(img, 0, 0) // putImageData keeps this offscreen CPU-backed
      ctx.save()
      if (composite) ctx.globalCompositeOperation = composite
      ctx.globalAlpha = alpha
      ctx.drawImage(c, 0, 0, bw, bh, bx, by, bw, bh) // src-rect form ignores the grow-only canvas's extra area
      ctx.restore()
      return
    }

    ctx.save()
    if (composite) ctx.globalCompositeOperation = composite
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
    ctx.closePath()
    ctx.fill('nonzero')
    ctx.restore()
  }

  fillRadialGradient(
    cx: number, cy: number, rInner: number, rOuter: number,
    stops: GradientStop[], box: Box,
    composite?: CompositeOp, globalAlpha = 1,
  ) {
    const ctx = this.ctx
    ctx.save()
    if (composite) ctx.globalCompositeOperation = composite
    ctx.globalAlpha = globalAlpha
    const grad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter)
    for (const s of stops) grad.addColorStop(s.offset, s.color)
    ctx.fillStyle = grad
    ctx.fillRect(box.x, box.y, box.w, box.h)
    ctx.restore()
  }

  readPixel(x: number, y: number): RGBA | null {
    try {
      const d = this.ctx.getImageData(x, y, 1, 1).data
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
    } catch {
      return null
    }
  }

  getRegion(x: number, y: number, w: number, h: number): PixelRegion | null {
    try {
      const img = this.ctx.getImageData(x, y, w, h)
      return { data: img.data, width: img.width, height: img.height }
    } catch {
      return null
    }
  }

  putRegion(region: PixelRegion, x: number, y: number) {
    // Build the ImageData via createImageData + .set() rather than the
    // `new ImageData(typedArray, w, h)` overload — the latter is fussy about the
    // typed array's backing-buffer generic across TS lib versions; .set() is not.
    const img = this.ctx.createImageData(region.width, region.height)
    img.data.set(region.data)
    this.ctx.putImageData(img, x, y)
  }

  createSurface(w: number, h: number): RendererBackend {
    const key = w + 'x' + h
    const pool = this.scratchPool ?? (this.scratchPool = new Map())
    const list = pool.get(key)
    let c = list && list.length ? list.pop()! : null
    if (!c) {
      c = document.createElement('canvas')
      c.width = w
      c.height = h
    }
    // willReadFrequently keeps the scratch canvas CPU-backed. This is CRITICAL: drawSurface() blits this
    // canvas onto the live layer via drawImage(), and a drawImage FROM a GPU-backed canvas flips the
    // DESTINATION (the layer) to GPU — after which every getImageData on the layer (brush build-up sample,
    // smudge pickup) stalls on a GPU→CPU readback (~0.5ms each → multi-second strokes). The flag only
    // applies to a canvas's FIRST getContext, so every scratch canvas must be created through here.
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.clearRect(0, 0, w, h) // wipe (reused canvas already matches the key size; fresh one starts clear)
    const surface = new Canvas2DBackend(ctx)
    surface.pooledBy = this
    surface.poolKey = key
    return surface
  }

  /** Return a createSurface() scratch canvas to its owner's pool for reuse (capped, so it can't grow
   *  unbounded). drawSurface()/getRegion() must not be called on this backend afterward. */
  dispose() {
    const owner = this.pooledBy
    if (!owner || !this.poolKey) return
    const pool = owner.scratchPool ?? (owner.scratchPool = new Map())
    const list = pool.get(this.poolKey) ?? []
    if (list.length < 4) {            // small cap: enough for any single stamp's concurrent surfaces
      list.push(this.canvas)
      pool.set(this.poolKey, list)
    }
    this.pooledBy = undefined
    this.poolKey = undefined
  }

  drawSurface(src: RendererBackend, dx: number, dy: number, composite?: CompositeOp, globalAlpha = 1) {
    const ctx = this.ctx
    ctx.save()
    if (composite) ctx.globalCompositeOperation = composite
    ctx.globalAlpha = globalAlpha
    ctx.drawImage((src as Canvas2DBackend).canvas, dx, dy)
    ctx.restore()
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  maskWithTexture(
    texture: BrushTexture,
    rectX: number, rectY: number, w: number, h: number,
    worldX: number, worldY: number,
  ) {
    applyTextureMask(this.ctx, texture, rectX, rectY, w, h, worldX, worldY)
  }
}
