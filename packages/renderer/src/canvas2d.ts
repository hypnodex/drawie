import type {
  RendererBackend, GradientStop, Box, CompositeOp, RGBA, PixelRegion, BrushTexture,
} from '@drawie/core'
import { applyTextureMask } from './textures'

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

  fillRect(x: number, y: number, w: number, h: number, color: string, alpha: number, composite?: CompositeOp) {
    const ctx = this.ctx
    ctx.save()
    if (composite) ctx.globalCompositeOperation = composite
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
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
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    return new Canvas2DBackend(ctx)
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
