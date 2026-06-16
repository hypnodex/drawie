import type {
  RendererBackend, GradientStop, Box, CompositeOp, RGBA, PixelRegion, BrushTexture,
} from '@drawie/core'
import {
  Skia, BlendMode, PaintStyle, StrokeCap, StrokeJoin, TileMode, AlphaType, ColorType,
  FilterMode, MipmapMode,
  type SkSurface, type SkCanvas, type SkPaint, type SkColor, type SkImage, type SkData,
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
  // Texture tiles built ONCE per texture (not a fresh mask image per stamp). Kept alive for
  // the backend's lifetime; SkData held alongside the SkImage so it isn't GC'd out from under it.
  private textureTiles = new Map<BrushTexture, { img: SkImage; data: SkData } | null>()
  // fillCircle paint-state cache: bristle brushes (inkbrush/drybrush) issue up to 30 fillCircles
  // per stamp that share shader/style/AA/blend/colour — only ALPHA + position vary. Track the
  // cached state so each bristle costs just setAlphaf + drawCircle (≈2 JSI) instead of re-setting
  // the whole paint and re-parsing the colour string (≈8 JSI). Invalidated by any other paint op.
  private cValid = false
  private cColor = ''
  private cComposite: CompositeOp | undefined = undefined

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
      case 'destination-over': return BlendMode.DstOver
      default: return BlendMode.SrcOver
    }
  }

  private info(w: number, h: number) {
    return { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul }
  }

  fillCircle(x: number, y: number, r: number, color: string, alpha: number, composite?: CompositeOp) {
    const p = this.paint
    // Fast path for opaque '#rrggbb' (all bristle/pencil/spray dots): set the full paint state +
    // opaque colour ONCE, then vary only alpha per dot. setAlphaf replaces the colour's alpha, so
    // this is identical to setColor(colour@alpha) for opaque base colours.
    if (color.length === 7 && color[0] === '#') {
      if (!this.cValid || color !== this.cColor || composite !== this.cComposite) {
        p.setShader(null)
        p.setStyle(PaintStyle.Fill)
        p.setAntiAlias(true)
        p.setBlendMode(this.blend(composite))
        p.setColor(Skia.Color(color))
        this.cColor = color; this.cComposite = composite; this.cValid = true
      }
      p.setAlphaf(alpha)
      this.skc.drawCircle(x, y, r, p)
      return
    }
    // Uncommon (transparent / rgba-with-alpha): full path.
    p.setShader(null)
    p.setStyle(PaintStyle.Fill)
    p.setAntiAlias(true)
    p.setBlendMode(this.blend(composite))
    p.setColor(this.color(color, alpha))
    this.skc.drawCircle(x, y, r, p)
    this.cValid = false
  }

  strokeLine(x0: number, y0: number, x1: number, y1: number, width: number, color: string, alpha: number, composite?: CompositeOp) {
    const p = this.paint
    this.cValid = false
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
    this.cValid = false
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
    this.cValid = false
    p.setStyle(PaintStyle.Fill)
    p.setAntiAlias(true)
    p.setBlendMode(this.blend(composite))
    p.setAlphaf(1) // gradient bakes its own alpha; clear any leftover setAlphaf from fillCircle
    p.setShader(shader)
    this.skc.drawRect(Skia.XYWHRect(box.x, box.y, box.w, box.h), p)
    p.setShader(null)
    shader.dispose() // free the native shader — created per stamp; leaking these crashes
  }

  readPixel(x: number, y: number): RGBA | null {
    // BOUNDED read: SkCanvas.readPixels copies just the requested patch — NOT a full-surface
    // makeImageSnapshot per stamp (which made the readback tools degrade on a filled canvas).
    const px = this.skc.readPixels(x, y, this.info(1, 1)) as Uint8Array | null
    return px ? { r: px[0], g: px[1], b: px[2], a: px[3] / 255 } : null
  }

  getRegion(x: number, y: number, w: number, h: number): PixelRegion | null {
    // BOUNDED read (see readPixel) — smudge/waterdrop sample only their brush-sized patch.
    const px = this.skc.readPixels(x, y, this.info(w, h)) as Uint8Array | null
    return px ? { data: new Uint8ClampedArray(px), width: w, height: h } : null
  }

  putRegion(region: PixelRegion, x: number, y: number) {
    const data = Skia.Data.fromBytes(new Uint8Array(region.data.buffer, region.data.byteOffset, region.data.byteLength))
    const img = Skia.Image.MakeImage(
      { width: region.width, height: region.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
      data, region.width * 4,
    )
    if (!img) { data.dispose(); return }
    const p = this.paint
    this.cValid = false
    p.setShader(null)
    p.setBlendMode(BlendMode.Src) // replace dest pixels
    p.setAlphaf(1)
    this.skc.drawImage(img, x, y, p)
    img.dispose(); data.dispose()
  }

  createSurface(w: number, h: number): RendererBackend {
    // CPU/raster (Surface.Make) — temp compose surfaces are read back per stamp
    // (smudge/waterdrop getRegion); CPU keeps that cheap. See DrawCanvas.
    const s = Skia.Surface.Make(w, h)!
    const child = new RNSkiaBackend(s, true)
    child.clear()
    return child
  }

  drawSurface(src: RendererBackend, dx: number, dy: number, composite?: CompositeOp, globalAlpha = 1) {
    const img = (src as RNSkiaBackend).surface.makeImageSnapshot()
    const p = this.paint
    this.cValid = false
    p.setShader(null)
    p.setBlendMode(this.blend(composite))
    p.setAlphaf(globalAlpha)
    this.skc.drawImage(img, dx, dy, p)
    p.setAlphaf(1)
    img.dispose()
  }

  clear() {
    this.skc.clear(Skia.Color('rgba(0,0,0,0)'))
  }

  /** Replace the whole surface with a previously captured snapshot (undo/redo restore). */
  restoreFrom(img: SkImage) {
    this.skc.clear(Skia.Color('rgba(0,0,0,0)'))
    const p = this.paint
    this.cValid = false
    p.setShader(null)
    p.setBlendMode(BlendMode.SrcOver)
    p.setAlphaf(1)
    this.skc.drawImage(img, 0, 0, p)
  }

  /** Texture grain as a single repeat-tiled SkImage, built once per texture and cached. */
  private getTextureTile(texture: BrushTexture): SkImage | null {
    const cached = this.textureTiles.get(texture)
    if (cached !== undefined) return cached?.img ?? null
    const tex = getTexturePixels(texture)
    if (!tex) { this.textureTiles.set(texture, null); return null }
    const data = Skia.Data.fromBytes(new Uint8Array(tex.data.buffer, tex.data.byteOffset, tex.data.byteLength))
    const img = Skia.Image.MakeImage(
      { width: tex.size, height: tex.size, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
      data, tex.size * 4,
    )
    if (!img) { data.dispose(); this.textureTiles.set(texture, null); return null }
    this.textureTiles.set(texture, { img, data })
    return img
  }

  maskWithTexture(texture: BrushTexture, rectX: number, rectY: number, w: number, h: number, worldX: number, worldY: number) {
    const tile = this.getTextureTile(texture)
    if (!tile) return
    // Repeat-tiled grain shader, masked onto the stamp with DstIn. No per-stamp pixel array /
    // image build — the tile is cached. localMatrix reproduces the OLD per-stamp texture coords
    // exactly (at device x = rectX+xx it samples tile[(xx+ox) mod S], ox = floor(rectX+worldX)),
    // so the grain is byte-for-byte the same; Nearest filtering matches the old index sampling.
    const ox = Math.floor(rectX + worldX), oy = Math.floor(rectY + worldY)
    const m = Skia.Matrix().translate(rectX - ox, rectY - oy)
    const shader = tile.makeShaderOptions(TileMode.Repeat, TileMode.Repeat, FilterMode.Nearest, MipmapMode.None, m)
    const p = this.paint
    this.cValid = false
    p.setShader(shader)
    p.setBlendMode(BlendMode.DstIn)
    p.setAlphaf(1)
    this.skc.drawRect(Skia.XYWHRect(rectX, rectY, w, h), p)
    p.setShader(null)
    shader.dispose() // cheap wrapper (no pixel data); the tile image stays cached
  }

  flush() {
    // VERIFY: on-screen presentation depends on how the surface is displayed
    // (makeImageSnapshot → <Image>, or a useCanvasRef draw loop). See DrawCanvas.tsx.
    this.surface.flush?.()
  }

  dispose() {
    for (const t of this.textureTiles.values()) { t?.img.dispose(); t?.data.dispose() }
    this.textureTiles.clear()
    if (this.owned) this.surface.dispose?.()
  }
}
