import type {
  RendererBackend, GradientStop, Box, CompositeOp, RGBA, PixelRegion, BrushTexture,
} from '@drawie/core'
import {
  Skia, BlendMode, PaintStyle, StrokeCap, StrokeJoin, TileMode, AlphaType, ColorType,
  type SkSurface, type SkCanvas, type SkPaint, type SkColor,
} from '@shopify/react-native-skia'
import { getTexturePixels } from './textures'

/**
 * RNSkiaBackend — the RendererBackend implemented against @shopify/react-native-skia,
 * so the SAME @drawie/core StrokeEngine + retained model that run on web (Canvas2D /
 * CanvasKit) also render on iOS/Android. It is a near 1:1 mirror of the web SkiaBackend
 * (packages/renderer/src/skia.ts); the differences are only RN-Skia's API shape:
 *   - factories: `Skia.Surface.MakeOffscreen` / `Skia.Paint()` (vs `ck.MakeSurface` / `new ck.Paint()`)
 *   - colours are SkColor (int) via `Skia.Color(cssString)` (vs Color4f Float32Array)
 *   - readback is `SkImage.readPixels` off a snapshot (RN-Skia has no Canvas.readPixels)
 *
 * ⚠️ DEVICE-PENDING: this file cannot be built or verified in a headless environment
 * (react-native-skia is a native module needing a dev client + device). It is written
 * against the documented RN-Skia API and mirrors the proven web backend; the spots most
 * likely to need a tweak on first device run are tagged `VERIFY:` below.
 */
export class RNSkiaBackend implements RendererBackend {
  readonly surface: SkSurface
  private skc: SkCanvas
  private paint: SkPaint
  private owned: boolean

  constructor(surface: SkSurface, owned = false) {
    this.surface = surface
    this.skc = surface.getCanvas()
    this.paint = Skia.Paint()
    this.owned = owned
  }

  get width() { return this.surface.width() }
  get height() { return this.surface.height() }

  /** Parse '#rrggbb' | 'rgb()' | 'rgba()' | 'transparent' → SkColor, with an alpha multiplier. */
  private color(str: string, alphaMul = 1): SkColor {
    if (str === 'transparent') return Skia.Color('rgba(0,0,0,0)')
    if (str[0] === '#' && alphaMul >= 1) return Skia.Color(str)
    let r = 0, g = 0, b = 0, a = 1
    if (str[0] === '#') {
      r = parseInt(str.slice(1, 3), 16); g = parseInt(str.slice(3, 5), 16); b = parseInt(str.slice(5, 7), 16)
    } else {
      const m = str.slice(str.indexOf('(') + 1, str.indexOf(')')).split(',').map((s) => parseFloat(s))
      r = m[0] || 0; g = m[1] || 0; b = m[2] || 0; a = m.length > 3 ? m[3] : 1
    }
    return Skia.Color(`rgba(${r}, ${g}, ${b}, ${a * alphaMul})`)
  }

  private blend(c?: CompositeOp): BlendMode {
    switch (c) {
      case 'multiply': return BlendMode.Multiply
      case 'destination-out': return BlendMode.DstOut
      case 'destination-in': return BlendMode.DstIn
      default: return BlendMode.SrcOver
    }
  }

  private info(w: number, h: number) {
    return { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul }
  }

  fillCircle(x: number, y: number, r: number, color: string, alpha: number, composite?: CompositeOp) {
    const p = this.paint
    p.setShader(null)
    p.setStyle(PaintStyle.Fill)
    p.setAntiAlias(true)
    p.setBlendMode(this.blend(composite))
    p.setColor(this.color(color, alpha))
    this.skc.drawCircle(x, y, r, p)
  }

  strokeLine(x0: number, y0: number, x1: number, y1: number, width: number, color: string, alpha: number, composite?: CompositeOp) {
    const p = this.paint
    p.setShader(null)
    p.setStyle(PaintStyle.Stroke)
    p.setStrokeWidth(width)
    p.setStrokeCap(StrokeCap.Round)
    p.setStrokeJoin(StrokeJoin.Round)
    p.setAntiAlias(true)
    p.setBlendMode(this.blend(composite))
    p.setColor(this.color(color, alpha))
    // VERIFY: RN-Skia drawLine takes (x0,y0,x1,y1,paint).
    this.skc.drawLine(x0, y0, x1, y1, p)
  }

  fillRect(x: number, y: number, w: number, h: number, color: string, alpha: number, composite?: CompositeOp) {
    const p = this.paint
    p.setShader(null)
    p.setStyle(PaintStyle.Fill)
    p.setAntiAlias(false)
    p.setBlendMode(this.blend(composite))
    p.setColor(this.color(color, alpha))
    this.skc.drawRect(Skia.XYWHRect(x, y, w, h), p)
  }

  fillRadialGradient(
    cx: number, cy: number, rInner: number, rOuter: number,
    stops: GradientStop[], box: Box, composite?: CompositeOp, globalAlpha = 1,
  ) {
    // Same (r0..r1) → single-radius remap as the web backend.
    const t0 = rOuter > 0 ? rInner / rOuter : 0
    const colors = [this.color(stops[0].color, globalAlpha)]
    const pos = [0]
    for (const s of stops) { colors.push(this.color(s.color, globalAlpha)); pos.push(t0 + s.offset * (1 - t0)) }
    // VERIFY: MakeRadialGradient(center: SkPoint, radius, colors: SkColor[], pos, tileMode, localMatrix?, flags?)
    const shader = Skia.Shader.MakeRadialGradient(Skia.Point(cx, cy), rOuter, colors, pos, TileMode.Clamp)
    const p = this.paint
    p.setStyle(PaintStyle.Fill)
    p.setAntiAlias(true)
    p.setBlendMode(this.blend(composite))
    p.setShader(shader)
    this.skc.drawRect(Skia.XYWHRect(box.x, box.y, box.w, box.h), p)
    p.setShader(null)
  }

  readPixel(x: number, y: number): RGBA | null {
    // VERIFY: RN-Skia reads back via an image snapshot (no Canvas.readPixels).
    const img = this.surface.makeImageSnapshot(Skia.XYWHRect(x, y, 1, 1))
    const px = img.readPixels(0, 0, this.info(1, 1)) as Uint8Array | null
    if (!px) return null
    return { r: px[0], g: px[1], b: px[2], a: px[3] / 255 }
  }

  getRegion(x: number, y: number, w: number, h: number): PixelRegion | null {
    const img = this.surface.makeImageSnapshot(Skia.XYWHRect(x, y, w, h))
    const px = img.readPixels(0, 0, this.info(w, h)) as Uint8Array | null
    if (!px) return null
    return { data: new Uint8ClampedArray(px), width: w, height: h }
  }

  putRegion(region: PixelRegion, x: number, y: number) {
    const data = Skia.Data.fromBytes(new Uint8Array(region.data.buffer, region.data.byteOffset, region.data.byteLength))
    const img = Skia.Image.MakeImage(
      { width: region.width, height: region.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
      data, region.width * 4,
    )
    if (!img) return
    const p = this.paint
    p.setShader(null)
    p.setBlendMode(BlendMode.Src) // replace dest pixels
    p.setAlphaf(1)
    this.skc.drawImage(img, x, y, p)
  }

  createSurface(w: number, h: number): RendererBackend {
    const s = Skia.Surface.MakeOffscreen(w, h)!
    const child = new RNSkiaBackend(s, true)
    child.clear()
    return child
  }

  drawSurface(src: RendererBackend, dx: number, dy: number, composite?: CompositeOp, globalAlpha = 1) {
    const img = (src as RNSkiaBackend).surface.makeImageSnapshot()
    const p = this.paint
    p.setShader(null)
    p.setBlendMode(this.blend(composite))
    p.setAlphaf(globalAlpha)
    this.skc.drawImage(img, dx, dy, p)
    p.setAlphaf(1)
  }

  clear() {
    this.skc.clear(Skia.Color('rgba(0,0,0,0)'))
  }

  maskWithTexture(texture: BrushTexture, rectX: number, rectY: number, w: number, h: number, worldX: number, worldY: number) {
    const tex = getTexturePixels(texture)
    if (!tex) return
    const S = tex.size, td = tex.data
    const ox = Math.floor(rectX + worldX), oy = Math.floor(rectY + worldY)
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
    const img = Skia.Image.MakeImage(
      { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
      Skia.Data.fromBytes(new Uint8Array(mask.buffer, mask.byteOffset, mask.byteLength)), w * 4,
    )
    if (!img) return
    const p = this.paint
    p.setShader(null)
    p.setBlendMode(BlendMode.DstIn)
    p.setAlphaf(1)
    this.skc.drawImage(img, rectX, rectY, p)
  }

  flush() {
    // VERIFY: on-screen presentation depends on how the surface is displayed
    // (makeImageSnapshot → <Image>, or a useCanvasRef draw loop). See DrawCanvas.tsx.
    this.surface.flush?.()
  }

  dispose() {
    if (this.owned) this.surface.dispose?.()
  }
}
