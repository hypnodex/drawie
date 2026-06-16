// RendererBackend — the abstract paint surface the StrokeEngine draws onto.
//
// The engine NEVER touches a CanvasRenderingContext2D, the DOM, ImageData, or
// DOMMatrix directly; it expresses every mark as a call on this interface. A
// concrete backend (Canvas2DBackend today, SkiaBackend in Phase 4) maps these
// primitives onto its platform. Keeping the contract here in @drawie/core (rather
// than in @drawie/renderer) lets the framework-agnostic engine depend on it
// without a circular package dependency.
//
// The primitive set is deliberately minimal and was derived from auditing every
// ctx.* call the original Canvas-2D engine made:
//   - fillCircle      → pen nib, pencil/spray/bristle dots
//   - strokeLine      → pen connecting segment
//   - fillRect        → square stamp
//   - fillRadialGradient → soft disc (brush/marker/watercolor), eraser, smudge &
//                          waterdrop soft masks, waterdrop ink tint
//   - readPixel       → wet-on-wet / build-up destination sampling
//   - getRegion/putRegion → smudge pickup, waterdrop displacement buffer
//   - createSurface/drawSurface → offscreen compose (textured stamp, smudge,
//                          waterdrop) then blit back
//   - maskWithTexture → world-aligned grain mask (destination-in)
//
// Per-pixel effect math (waterdrop displacement, blur, value-noise) stays in the
// engine operating on a plain PixelRegion — no platform primitive needed, so it
// renders identically everywhere. Phase 4 may add a higher-level displace op for
// the Skia backend to run those on the GPU, but that is an optimisation layered
// on top of this contract, not a change to it.

import type { BrushTexture } from './types'

/** A sampled destination colour. `a` is normalised to 0..1 (unlike raw 0..255). */
export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

/** A rectangular block of RGBA pixels — a DOM-free stand-in for ImageData. */
export interface PixelRegion {
  data: Uint8ClampedArray // length = width * height * 4, premultiplied-by-alpha? No: straight RGBA
  width: number
  height: number
}

/** A radial-gradient colour stop. `color` is any CSS colour string (incl. rgba()). */
export interface GradientStop {
  offset: number // 0..1
  color: string
}

/** An axis-aligned fill rectangle. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** The composite (blend) modes the engine relies on. Subset of GlobalCompositeOperation. */
export type CompositeOp = 'source-over' | 'multiply' | 'destination-out' | 'destination-in' | 'destination-over'

/**
 * A drawing target. The main canvas is a RendererBackend; offscreen scratch
 * surfaces returned by createSurface() are also RendererBackends, so the same
 * primitive set composes onto both.
 */
export interface RendererBackend {
  readonly width: number
  readonly height: number

  // ── vector primitives ───────────────────────────────────────────────────
  /** Filled circle (round nib / particle dot). */
  fillCircle(x: number, y: number, r: number, color: string, alpha: number, composite?: CompositeOp): void

  /** Round-capped, round-joined line segment of the given width. */
  strokeLine(
    x0: number, y0: number, x1: number, y1: number,
    width: number, color: string, alpha: number, composite?: CompositeOp,
  ): void

  /** Axis-aligned filled rectangle (square stamp). */
  fillRect(x: number, y: number, w: number, h: number, color: string, alpha: number, composite?: CompositeOp): void

  /**
   * Radial-gradient fill from rInner..rOuter at (cx,cy) using `stops`, clipped to
   * `box`. `globalAlpha` multiplies the whole fill (matches ctx.globalAlpha).
   */
  fillRadialGradient(
    cx: number, cy: number, rInner: number, rOuter: number,
    stops: GradientStop[], box: Box,
    composite?: CompositeOp, globalAlpha?: number,
  ): void

  // ── pixel access ─────────────────────────────────────────────────────────
  /** Sample a single destination pixel; `a` normalised to 0..1. */
  readPixel(x: number, y: number): RGBA | null

  /** Read back a rectangular region of pixels (clamped to surface bounds). */
  getRegion(x: number, y: number, w: number, h: number): PixelRegion | null

  /** Write a pixel region at (x,y), overwriting destination pixels (source-over of raw RGBA). */
  putRegion(region: PixelRegion, x: number, y: number): void

  // ── offscreen compose ──────────────────────────────────────────────────────
  /** Allocate a transparent offscreen surface. */
  createSurface(w: number, h: number): RendererBackend

  /** Composite another surface onto this one at (dx,dy). */
  drawSurface(src: RendererBackend, dx: number, dy: number, composite?: CompositeOp, globalAlpha?: number): void

  /** Clear the whole surface to transparent. */
  clear(): void

  /** Release backend resources for a throwaway surface (Skia/native need this;
   *  Canvas2D GCs and omits it). The engine calls it on temp compose surfaces. */
  dispose?(): void

  /** Present buffered drawing to the display (Skia software surface → canvas).
   *  Canvas2D draws immediately and omits it. The host calls it after draws. */
  flush?(): void

  // ── texture mask ───────────────────────────────────────────────────────────
  /**
   * Destination-in mask the rect [rectX,rectY,w,h] of THIS surface with the given
   * procedural grain texture, aligned to world coordinates (worldX,worldY) so
   * neighbouring stamps share grain. No-op for texture 'none'.
   */
  maskWithTexture(
    texture: BrushTexture,
    rectX: number, rectY: number, w: number, h: number,
    worldX: number, worldY: number,
  ): void
}
