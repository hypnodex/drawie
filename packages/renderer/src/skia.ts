import type {
  RendererBackend, GradientStop, Box, CompositeOp, RGBA, PixelRegion, BrushTexture,
} from '@drawie/core'
import type { CanvasKit, Surface, Canvas as SkCanvas, Paint, ImageInfo } from 'canvaskit-wasm'
import { getTexturePixels } from './textures'

/**
 * SkiaBackend — the RendererBackend implemented against CanvasKit (Skia compiled to
 * WASM on web; the same code path targets react-native-skia on native in Phase 5).
 *
 * One backend wraps one Skia Surface. createSurface() returns child SkiaBackends so
 * the engine's offscreen compose (textured stamp / smudge / waterdrop) maps onto Skia
 * surfaces. Readback (readPixel/getRegion) and putRegion keep the engine's per-pixel
 * effect math (waterdrop displacement, blur) running in portable TS — pixel-identical
 * to Canvas2D. The vector primitives differ only by Skia-vs-Canvas2D antialiasing,
 * which the Phase 4 golden test bounds to tolerance.
 *
 * API note (verified against canvaskit-wasm 0.41.1, not memory): pixel readback is
 * `Canvas.readPixels`, NOT `Surface.readPixels`.
 */
export class SkiaBackend implements RendererBackend {
  private ck: CanvasKit
  readonly surface: Surface
  private skc: SkCanvas
  private paint: Paint
  private owned: boolean

  constructor(ck: CanvasKit, surface: Surface, owned = false) {
    this.ck = ck
    this.surface = surface
    this.skc = surface.getCanvas()
    this.paint = new ck.Paint()
    this.owned = owned
  }

  get width() { return this.surface.width() }
  get height() { return this.surface.height() }

  // ── colour + helpers ───────────────────────────────────────────────────────
  /** Parse '#rrggbb' | 'rgb(...)' | 'rgba(...)' | 'transparent' → CanvasKit Color4f. */
  private color4f(str: string, alphaMul = 1) {
    const ck = this.ck
    if (str === 'transparent') return ck.Color4f(0, 0, 0, 0)
    if (str[0] === '#') {
      const r = parseInt(str.slice(1, 3), 16) / 255
      const g = parseInt(str.slice(3, 5), 16) / 255
      const b = parseInt(str.slice(5, 7), 16) / 255
      return ck.Color4f(r, g, b, alphaMul)
    }
    // rgb(r, g, b) / rgba(r, g, b, a)
    const m = str.slice(str.indexOf('(') + 1, str.indexOf(')')).split(',').map((s) => parseFloat(s))
    return ck.Color4f((m[0] || 0) / 255, (m[1] || 0) / 255, (m[2] || 0) / 255, (m.length > 3 ? m[3] : 1) * alphaMul)
  }

  private blend(c?: CompositeOp) {
    const ck = this.ck
    switch (c) {
      case 'multiply': return ck.BlendMode.Multiply
      case 'destination-out': return ck.BlendMode.DstOut
      case 'destination-in': return ck.BlendMode.DstIn
      case 'destination-over': return ck.BlendMode.DstOver
      default: return ck.BlendMode.SrcOver
    }
  }

  private info(w: number, h: number): ImageInfo {
    const ck = this.ck
    return { width: w, height: h, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB }
  }

  // ── vector primitives ───────────────────────────────────────────────────────
  fillCircle(x: number, y: number, r: number, color: string, alpha: number, composite?: CompositeOp) {
    const p = this.paint
    p.setShader(null)
    p.setStyle(this.ck.PaintStyle.Fill)
    p.setAntiAlias(true)
    p.setBlendMode(this.blend(composite))
    p.setColor(this.color4f(color, alpha))
    this.skc.drawCircle(x, y, r, p)
  }

  strokeLine(x0: number, y0: number, x1: number, y1: number, width: number, color: string, alpha: number, composite?: CompositeOp) {
    const ck = this.ck
    const p = this.paint
    p.setShader(null)
    p.setStyle(ck.PaintStyle.Stroke)
    p.setStrokeWidth(width)
    p.setStrokeCap(ck.StrokeCap.Round)
    p.setStrokeJoin(ck.StrokeJoin.Round)
    p.setAntiAlias(true)
    p.setBlendMode(this.blend(composite))
    p.setColor(this.color4f(color, alpha))
    this.skc.drawLine(x0, y0, x1, y1, p)
  }

  fillRect(x: number, y: number, w: number, h: number, color: string, alpha: number, composite?: CompositeOp) {
    const p = this.paint
    p.setShader(null)
    p.setStyle(this.ck.PaintStyle.Fill)
    p.setAntiAlias(false)
    p.setBlendMode(this.blend(composite))
    p.setColor(this.color4f(color, alpha))
    this.skc.drawRect(this.ck.XYWHRect(x, y, w, h), p)
  }

  fillRadialGradient(
    cx: number, cy: number, rInner: number, rOuter: number,
    stops: GradientStop[], box: Box, composite?: CompositeOp, globalAlpha = 1,
  ) {
    const ck = this.ck
    // CanvasKit's radial gradient has a single radius. Emulate Canvas2D's
    // (r0..r1) by remapping each stop offset into [r0/r1 .. 1] and making the
    // [0 .. r0/r1] core solid with the first colour. globalAlpha is baked into
    // each stop's alpha (paint alpha doesn't reliably modulate a shader).
    const t0 = rOuter > 0 ? rInner / rOuter : 0
    const colors = [this.color4f(stops[0].color, globalAlpha)]
    const pos = [0]
    for (const s of stops) {
      colors.push(this.color4f(s.color, globalAlpha))
      pos.push(t0 + s.offset * (1 - t0))
    }
    const shader = ck.Shader.MakeRadialGradient([cx, cy], rOuter, colors, pos, ck.TileMode.Clamp)
    const p = this.paint
    p.setStyle(ck.PaintStyle.Fill)
    p.setAntiAlias(true)
    p.setBlendMode(this.blend(composite))
    p.setShader(shader)
    this.skc.drawRect(ck.XYWHRect(box.x, box.y, box.w, box.h), p)
    p.setShader(null)
    shader.delete()
  }

  // ── pixel access ──────────────────────────────────────────────────────────
  readPixel(x: number, y: number): RGBA | null {
    const px = this.skc.readPixels(x, y, this.info(1, 1)) as Uint8Array | null
    if (!px) return null
    return { r: px[0], g: px[1], b: px[2], a: px[3] / 255 }
  }

  getRegion(x: number, y: number, w: number, h: number): PixelRegion | null {
    const px = this.skc.readPixels(x, y, this.info(w, h)) as Uint8Array | null
    if (!px) return null
    return { data: new Uint8ClampedArray(px.buffer.slice(px.byteOffset, px.byteOffset + px.byteLength)), width: w, height: h }
  }

  putRegion(region: PixelRegion, x: number, y: number) {
    const img = this.ck.MakeImage(this.info(region.width, region.height), region.data, region.width * 4)
    if (!img) return
    const p = this.paint
    p.setShader(null)
    p.setBlendMode(this.ck.BlendMode.Src) // replace dest pixels (putImageData semantics)
    p.setAlphaf(1)
    this.skc.drawImage(img, x, y, p)
    img.delete()
  }

  // ── offscreen compose ───────────────────────────────────────────────────────
  createSurface(w: number, h: number): RendererBackend {
    const s = this.ck.MakeSurface(w, h)!
    const child = new SkiaBackend(this.ck, s, true)
    child.clear()
    return child
  }

  drawSurface(src: RendererBackend, dx: number, dy: number, composite?: CompositeOp, globalAlpha = 1) {
    const img = (src as SkiaBackend).surface.makeImageSnapshot()
    const p = this.paint
    p.setShader(null)
    p.setBlendMode(this.blend(composite))
    p.setAlphaf(globalAlpha)
    this.skc.drawImage(img, dx, dy, p)
    p.setAlphaf(1)
    img.delete()
  }

  clear() {
    this.skc.clear(this.ck.TRANSPARENT)
  }

  // ── texture mask ────────────────────────────────────────────────────────────
  maskWithTexture(texture: BrushTexture, rectX: number, rectY: number, w: number, h: number, worldX: number, worldY: number) {
    const tex = getTexturePixels(texture)
    if (!tex) return
    const S = tex.size
    const td = tex.data
    const ox = Math.floor(rectX + worldX)
    const oy = Math.floor(rectY + worldY)
    const mask = new Uint8ClampedArray(w * h * 4)
    for (let yy = 0; yy < h; yy++) {
      const ty = (((yy + oy) % S) + S) % S
      for (let xx = 0; xx < w; xx++) {
        const tx = (((xx + ox) % S) + S) % S
        const mi = (yy * w + xx) * 4
        mask[mi] = 255; mask[mi + 1] = 255; mask[mi + 2] = 255
        mask[mi + 3] = td[(ty * S + tx) * 4 + 3]
      }
    }
    const img = this.ck.MakeImage(this.info(w, h), mask, w * 4)
    if (!img) return
    const p = this.paint
    p.setShader(null)
    p.setBlendMode(this.ck.BlendMode.DstIn)
    p.setAlphaf(1)
    this.skc.drawImage(img, rectX, rectY, p)
    img.delete()
  }

  /** Present the surface to its backing canvas (software surface) / flush GPU work. */
  flush() {
    this.surface.flush()
  }

  /** Free WASM-side resources. Call on temp surfaces after use (web app / native). */
  dispose() {
    this.paint.delete()
    if (this.owned) this.surface.delete()
  }
}
