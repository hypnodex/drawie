import type { AssistSettings, ToolId, ToolSettings, StrokePoint, InputPoint } from './types'
import type { RendererBackend, GradientStop, PixelRegion } from './renderer'
import { mulberry32, type Rng } from './rng'

// InputPoint is a shared data contract in ./types; re-exported here so existing
// `import { InputPoint } from '@drawie/core'` (and legacy engine) call sites keep working.
export type { InputPoint }

const DEFAULT_ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5,
  shapeAssist: false, shapeStrength: 0.6,
  perfectShape: true, holdToSnap: false, holdDelay: 500,
}

/**
 * StrokeEngine renders a single stroke onto a RendererBackend using distance-based
 * stamping with smoothed input. Each tool implements its own stamp/segment style;
 * the outer interpolation/pressure logic is shared.
 *
 * The engine is framework-agnostic: it touches no DOM API, no CanvasRenderingContext2D,
 * no ImageData/DOMMatrix. All painting goes through `backend`, and all randomness goes
 * through a seeded `rng`, so identical (input + seed) yields identical marks on every
 * platform.
 */
export class StrokeEngine {
  private last: StrokePoint | null = null
  private spacingLeft = 0
  private smoothX = 0
  private smoothY = 0
  private smoothP = 0
  private startedAt = 0
  // Last raw cursor input — used to pump trailing stamps when smoothing is high
  private lastRawX = 0
  private lastRawY = 0
  private prevStampX = 0
  private prevStampY = 0
  private prevStampDia = 0
  private hasPrevStamp = false
  // bucket: fill the whole layer once per stroke (a tap), not per stamp
  private bucketFilled = false

  // smudge tool needs to carry color from the underlying canvas
  private smudgePicked: PixelRegion | null = null
  private smudgePickedAt: { x: number; y: number } | null = null

  // watercolor dwell pooling
  private lastMoveAt = 0
  private dwellGrowth = 0
  private dwellAnchor: { x: number; y: number; pressure: number } | null = null

  // paint depletion (dilution + persistence)
  private inkRemaining = 1

  // reusable offscreen stamp surface for textured tools
  private tempStamp: RendererBackend | null = null

  // raw input points captured during the stroke — used for post-process refinement
  private rawPoints: InputPoint[] = []

  // seeded randomness — every stochastic site (pencil/spray/bristles) draws from this
  private rng: Rng

  // bristle brush state (drybrush / inkbrush) — generated once per stroke so the
  // streaks stay continuous as the brush travels.
  private bristles: { off: number; w: number; dry: number; seed: number }[] = []
  private bristleDist = 0

  /**
   * @param backend  paint target (Canvas2DBackend on web, SkiaBackend on native).
   * @param seed     per-stroke seed; stored in the retained model (Phase 3) so the
   *                 stroke replays bit-identically. Defaults to 1 for callers that
   *                 don't care about reproducibility.
   */
  constructor(
    private backend: RendererBackend,
    private tool: ToolId,
    private settings: ToolSettings,
    private assist: AssistSettings = DEFAULT_ASSIST,
    seed = 1,
  ) {
    this.rng = mulberry32(seed)
  }

  begin(p: InputPoint) {
    this.startedAt = p.t
    const pressure = this.derivePressure(p, 0)
    this.smoothX = p.x
    this.smoothY = p.y
    this.smoothP = pressure
    const sp: StrokePoint = { x: p.x, y: p.y, pressure, t: 0 }
    this.last = sp
    this.spacingLeft = 0
    this.hasPrevStamp = false
    this.lastMoveAt = p.t
    this.dwellGrowth = 0
    this.dwellAnchor = null
    this.inkRemaining = 1
    this.lastRawX = p.x
    this.lastRawY = p.y
    this.rawPoints = [{ ...p }]
    this.bucketFilled = false
    if (this.tool === 'drybrush' || this.tool === 'inkbrush') {
      this.bristleDist = 0
      this.generateBristles(this.tool === 'inkbrush')
    } else if (this.tool === 'oil') {
      this.bristleDist = 0 // oil uses bristleDist for its streak noise, but not the bristle set
    }
    this.stamp(sp)
  }

  extend(p: InputPoint) {
    if (!this.last) { this.begin(p); return }
    const t = p.t - this.startedAt
    this.lastRawX = p.x
    this.lastRawY = p.y
    this.rawPoints.push({ ...p })

    // Low-pass smooth raw input — gives painterly strokes even with noisy pointer.
    // Stroke Stabilization (Functions popover) lowers the EMA factor so the
    // stamp position lags behind the cursor and curves clean up.
    // During shape-assist replay the EMA is bypassed since the generated point
    // sequence is already exact.
    const baseA = this.tool === 'pen' ? 0.7 : 0.55
    const a = this.assist.bypassInputSmoothing
      ? 1
      : this.assist.stabilize
        ? baseA * (1 - this.assist.stabilizeStrength * 0.85)
        : baseA
    this.smoothX = this.smoothX * (1 - a) + p.x * a
    this.smoothY = this.smoothY * (1 - a) + p.y * a

    const dx = this.smoothX - this.last.x
    const dy = this.smoothY - this.last.y
    const dist = Math.hypot(dx, dy)
    if (dist < 0.4) return

    // Movement detected — reset dwell state for watercolor pooling
    if (dist > 1.2) {
      this.lastMoveAt = p.t
      this.dwellGrowth = 0
      this.dwellAnchor = null
    }

    const dt = Math.max(1, t - this.last.t)
    const speed = dist / dt
    const pressure = this.derivePressure(p, speed)
    this.smoothP = this.smoothP * 0.6 + pressure * 0.4

    const dia = this.brushDiameter(this.smoothP)
    const spacing = Math.max(0.6, dia * this.spacingFactor())

    let traveled = 0
    let safety = 0
    while (traveled + this.spacingLeft < dist && safety++ < 5000) {
      const step = this.spacingLeft > 0 ? this.spacingLeft : spacing
      traveled += step
      this.spacingLeft = 0
      const f = traveled / dist
      const sx = this.last.x + dx * f
      const sy = this.last.y + dy * f
      const sp = this.last.pressure + (this.smoothP - this.last.pressure) * f
      this.stamp({ x: sx, y: sy, pressure: sp, t })
    }
    const consumed = dist - traveled
    this.spacingLeft = Math.max(0, spacing - consumed)

    this.last = { x: this.smoothX, y: this.smoothY, pressure: this.smoothP, t }
  }

  end() {
    // When stabilization is high the stroke trails behind the cursor; pump
    // stamps along the remaining gap so the stroke actually finishes where the
    // user lifted the pointer.
    if (this.assist.stabilize && this.last) {
      const gx = this.lastRawX - this.last.x
      const gy = this.lastRawY - this.last.y
      const gap = Math.hypot(gx, gy)
      if (gap > 1) {
        const baseDia = this.brushDiameter(this.last.pressure)
        const spacing = Math.max(0.6, baseDia * this.spacingFactor())
        const steps = Math.min(64, Math.ceil(gap / spacing))
        for (let i = 1; i <= steps; i++) {
          const f = i / steps
          this.stamp({
            x: this.last.x + gx * f,
            y: this.last.y + gy * f,
            pressure: this.last.pressure,
            t: 0,
          })
        }
      }
    }
    this.last = null
    this.smudgePicked = null
    this.smudgePickedAt = null
    this.hasPrevStamp = false
    this.dwellAnchor = null
    this.dwellGrowth = 0
    this.tempStamp?.dispose?.()
    this.tempStamp = null
  }

  /** Raw input points (untouched by realtime smoothing) — used for post-stroke refinement. */
  getRawPoints(): InputPoint[] {
    return this.rawPoints
  }

  /**
   * Per-frame tick driven by the host while the stroke is active.
   * Only meaningful for tools that respond to dwell (watercolor) — others ignore.
   */
  tick(now: number) {
    if (this.tool !== 'watercolor') return
    if (!this.last) return
    const dt = now - this.lastMoveAt
    if (dt < 90) return
    if (!this.dwellAnchor) {
      this.dwellAnchor = { x: this.last.x, y: this.last.y, pressure: this.last.pressure }
    }
    const cap = this.settings.size * 1.1
    this.dwellGrowth = Math.min(cap, this.dwellGrowth + (cap - this.dwellGrowth) * 0.04 + 0.35)
    this.stampWatercolorPool(this.dwellAnchor, this.dwellGrowth)
  }

  // ── shape helpers ───────────────────────────────────────────────────

  private spacingFactor(): number {
    switch (this.tool) {
      case 'pen':        return 0.05
      case 'pencil':     return 0.08
      case 'brush':      return 0.10
      case 'marker':     return 0.06
      case 'watercolor': return 0.08
      case 'spray':      return 0.16
      case 'eraser':     return 0.10
      case 'smudge':     return 0.14
      case 'waterdrop':  return 0.9
      case 'drybrush':   return 0.05
      case 'inkbrush':   return 0.05
      case 'impasto':    return 0.07
      case 'oil':        return 0.045
      case 'bucket':     return 0.9
    }
  }

  private brushDiameter(pressure: number): number {
    const { size, pressureSim } = this.settings
    if (!pressureSim) return size
    return size * (0.35 + 0.65 * pressure)
  }

  private derivePressure(p: InputPoint, speed: number): number {
    if (!this.settings.pressureSim) return 1
    if (p.hasPressure && p.pressure > 0.001) {
      // smooth raw stylus pressure a little
      return Math.max(0.05, Math.min(1, p.pressure))
    }
    // Simulate from movement speed: slower = heavier
    const norm = Math.min(1, speed / 2.0)
    return Math.max(0.2, 1 - norm * 0.7)
  }

  // ── stamping ────────────────────────────────────────────────────────

  private stamp(point: StrokePoint) {
    const dia = this.brushDiameter(point.pressure)
    const r = Math.max(0.3, dia / 2)
    switch (this.tool) {
      case 'pen':        this.stampPen(point, r);        break
      case 'pencil':     this.stampPencil(point, r);     break
      case 'brush':      this.stampBrush(point, r);      break
      case 'marker':     this.stampMarker(point, r);     break
      case 'watercolor': this.stampWatercolor(point, r); break
      case 'spray':      this.stampSpray(point, r);      break
      case 'eraser':     this.stampEraser(point, r);     break
      case 'smudge':     this.stampSmudge(point, r);     break
      case 'waterdrop':  this.stampWaterdrop(point, r);  break
      case 'drybrush':   this.stampBristle(point, r, false); break
      case 'inkbrush':   this.stampBristle(point, r, true);  break
      case 'impasto':    this.stampImpasto(point, r);    break
      case 'oil':        this.stampOil(point, r);        break
      case 'bucket':     this.stampBucket(point);        break
    }
    this.prevStampX = point.x
    this.prevStampY = point.y
    this.prevStampDia = dia
    this.hasPrevStamp = true
  }

  private withAlpha(hex: string, a: number): string {
    const { r, g, b } = this.hexToRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    }
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
    return `#${h(r)}${h(g)}${h(b)}`
  }

  /** Darken (amt<0) or lighten (amt>0) a hex colour toward black/white. Used by impasto's
   *  shadow (darker) + highlight (lighter) to fake a raised paint edge. */
  private shade(hex: string, amt: number): string {
    const { r, g, b } = this.hexToRgb(hex)
    if (amt < 0) { const k = 1 + amt; return this.rgbToHex(r * k, g * k, b * k) }
    return this.rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt)
  }

  // IMPASTO — opaque paint with faked depth: a darker shadow offset down-right + a lighter
  // highlight offset up-left (light from top-left), with the colour on top. Overlapping stamps
  // leave the shadow on the lower-right edge and the highlight on the upper-left, so a built-up
  // stroke reads like a thick, raised ridge of real paint.
  private stampImpasto(p: StrokePoint, r: number) {
    const targetAlpha = this.settings.opacity * (this.settings.pressureSim ? (0.55 + 0.45 * p.pressure) : 1)
    const stampAlpha = this.applyDilution(0.55 * targetAlpha)
    const { color, alpha } = this.resolveStamp(p, stampAlpha)
    const off = Math.max(1, r * 0.2) // extrude depth scales with brush size
    this.fillShape(p.x + off, p.y + off, r, this.shade(color, -0.45), alpha * 0.95)        // shadow (bottom-right)
    this.fillShape(p.x - off * 0.65, p.y - off * 0.65, r * 0.9, this.shade(color, 0.55), alpha * 0.7) // highlight (top-left)
    this.fillShape(p.x, p.y, r, color, alpha)                                              // paint body
  }

  // BUCKET (fill whole layer) — one tap floods the entire active layer with the colour. Filled once
  // per stroke (begin already stamps the first point), so a quick tap is enough; opacity is honoured.
  private stampBucket(_p: StrokePoint) {
    if (this.bucketFilled) return
    this.bucketFilled = true
    const color = this.settings.color === 'transparent' ? '#ffffff' : this.settings.color
    // destination-over → fill lands UNDER existing strokes (only unpainted areas take the colour),
    // so this sets the BACKGROUND colour without covering the artwork.
    this.backend.fillRect(0, 0, this.backend.width, this.backend.height, color, this.settings.opacity, 'destination-over')
  }

  // OIL PAINT — thick bristled paint with a glossy sheen + depth, modelled on the reference photos:
  // dense bristles give the streaky body, ~per-bristle shade variation gives the dragged-paint look,
  // a stable subset of central bristles paints a bright highlight (wet sheen), and the outer bristles
  // darken for a raised edge. "Amount of colour" is the opacity × dilution.
  private stampOil(p: StrokePoint, r: number) {
    const color = this.settings.color === 'transparent' ? '#000000' : this.settings.color
    let dx = p.x - this.prevStampX
    let dy = p.y - this.prevStampY
    let len = Math.hypot(dx, dy)
    if (!this.hasPrevStamp || len < 1e-4) { dx = 1; dy = 0; len = 1 }
    else { this.bristleDist += len }
    dx /= len; dy /= len
    const perpX = -dy, perpY = dx
    const baseAlpha = this.settings.opacity * (this.settings.pressureSim ? (0.7 + 0.3 * p.pressure) : 1)
    const a = this.applyDilution(baseAlpha)
    // Smooth opaque paint body (soft round stamp that builds up to full) — the reference is creamy
    // and soft-edged, not a dry bristle scatter.
    this.fillShape(p.x, p.y, r, color, Math.min(1, a * 0.55))
    // A few SOFT tonal streaks across the width → the gentle dragged-paint variation.
    for (let i = -2; i <= 2; i++) {
      const off = (i / 2) * r * 0.72
      const sx = p.x + perpX * off
      const sy = p.y + perpY * off
      const v = this.smoothNoise(this.bristleDist * 0.05 + i * 9.3, i * 3.1) - 0.5
      this.fillShape(sx, sy, r * 0.26, this.shade(color, v * 0.28), a * 0.22)
    }
    // Glossy sheen — one soft lighter streak offset to a side (wet-paint highlight).
    this.fillShape(p.x + perpX * (-r * 0.42), p.y + perpY * (-r * 0.42), r * 0.3, this.shade(color, 0.5), a * 0.22)
  }

  /** Sample the destination colour at p; returns null on transparent / out of bounds. */
  private sampleDest(x: number, y: number): { r: number; g: number; b: number; a: number } | null {
    const cx = Math.max(0, Math.min(this.backend.width - 1, Math.round(x)))
    const cy = Math.max(0, Math.min(this.backend.height - 1, Math.round(y)))
    const px = this.backend.readPixel(cx, cy)
    if (!px) return null
    return { r: px.r, g: px.g, b: px.b, a: px.a }
  }

  /**
   * Decide per-stamp color and alpha — honoring build-up (pigment darken) and
   * blending (wet-on-wet). When build-up is on and the destination is already
   * saturated with a similar color, push it slightly toward black so repeated
   * passes physically deepen the pigment.
   */
  private resolveStamp(
    p: StrokePoint,
    baseAlpha: number,
  ): { color: string; alpha: number } {
    const brushRgb = this.hexToRgb(this.settings.color)
    const dst = this.sampleDest(p.x, p.y)
    const blending = this.settings.blending

    // Build-up: stamp a slightly-darker version of the destination pixel.
    // Using the DESTINATION (not the brush colour) as the base means the effect
    // is self-reinforcing — each stroke finds the area a little darker and
    // pushes it darker still.  There is no re-lightening because the stamp
    // colour IS already the darkened value; source-over blends it correctly.
    // k=0.02 per stamp × 0.26 base alpha ≈ 0.5 % net darkening per stamp —
    // invisible per stamp, clearly cumulative across multiple strokes.
    if (this.settings.buildUp && dst && dst.a > 0.85) {
      const k = 0.02
      return {
        color: this.rgbToHex(
          Math.max(0, dst.r * (1 - k)),
          Math.max(0, dst.g * (1 - k)),
          Math.max(0, dst.b * (1 - k)),
        ),
        alpha: baseAlpha,
      }
    }

    if (blending > 0.001 && dst && dst.a > 0.05) {
      const t = blending * dst.a
      const r = brushRgb.r * (1 - t) + dst.r * t
      const g = brushRgb.g * (1 - t) + dst.g * t
      const b = brushRgb.b * (1 - t) + dst.b * t
      return { color: this.rgbToHex(r, g, b), alpha: baseAlpha }
    }

    return { color: this.settings.color, alpha: baseAlpha }
  }

  /** Apply dilution to the per-stamp alpha and drain ink for the next stamp. */
  private applyDilution(baseAlpha: number): number {
    const d = this.settings.dilution
    const persistence = this.settings.persistence
    if (d <= 0.001) return baseAlpha
    const drain = (1 - persistence) * 0.012 + 0.002
    this.inkRemaining = Math.max(0, this.inkRemaining - drain)
    // dilution interpolates between full alpha and inkRemaining * alpha
    return baseAlpha * (1 - d + d * this.inkRemaining)
  }

  /** Generic shaped stamp respecting hardness + shape; used by brush/marker/watercolor variants. */
  private fillShape(
    x: number, y: number, r: number, color: string, alpha: number,
    composite?: 'multiply',
    target?: RendererBackend,
  ) {
    const tgt = target ?? this.backend
    const shape = this.settings.shape
    const hardness = this.settings.hardness
    // Hardness controls when the solid portion ends; rest is the soft falloff.
    const innerStop = 0.04 + hardness * 0.86
    const reach = r * (shape === 'square' ? 1 : 1.04)

    if (shape === 'square') {
      tgt.fillRect(x - r, y - r, r * 2, r * 2, color, alpha, composite)
    } else {
      const stops: GradientStop[] = [
        { offset: 0,         color: this.withAlpha(color, 1) },
        { offset: innerStop, color: this.withAlpha(color, 1) },
        { offset: 1,         color: this.withAlpha(color, 0) },
      ]
      tgt.fillRadialGradient(
        x, y, 0, reach, stops,
        { x: x - reach - 1, y: y - reach - 1, w: reach * 2 + 2, h: reach * 2 + 2 },
        composite, alpha,
      )
    }
  }

  // PEN — crisp solid stroke, segment-based for clean lines
  private stampPen(p: StrokePoint, r: number) {
    const alpha = this.settings.opacity * (this.settings.pressureSim ? (0.6 + 0.4 * p.pressure) : 1)
    this.backend.fillCircle(p.x, p.y, r, this.settings.color, alpha)
    if (this.hasPrevStamp) {
      const width = Math.max(1, (r * 2 + this.prevStampDia) / 2)
      this.backend.strokeLine(this.prevStampX, this.prevStampY, p.x, p.y, width, this.settings.color, alpha)
    }
  }

  // PENCIL — small textured stamps with alpha noise
  private stampPencil(p: StrokePoint, r: number) {
    const baseAlpha = this.settings.opacity * (this.settings.pressureSim ? (0.4 + 0.6 * p.pressure) : 0.85)
    // Multiple jittered micro-dots within radius for grainy feel
    const dots = 4
    for (let i = 0; i < dots; i++) {
      const ang = this.rng() * Math.PI * 2
      const rr = this.rng() * r * 0.65
      const dx = Math.cos(ang) * rr
      const dy = Math.sin(ang) * rr
      const dotR = r * (0.18 + this.rng() * 0.22)
      const alpha = baseAlpha * (0.35 + this.rng() * 0.65)
      this.backend.fillCircle(p.x + dx, p.y + dy, dotR, this.settings.color, alpha)
    }
  }

  // BRUSH — soft stamp; wet paint widens falloff, blending + build-up handled in resolveStamp
  private stampBrush(p: StrokePoint, r: number) {
    const wet = this.settings.wetPaint
    const targetAlpha = this.settings.opacity * (this.settings.pressureSim ? (0.5 + 0.5 * p.pressure) : 1)
    const baseStampAlpha = (wet ? 0.18 : 0.26) * targetAlpha
    const stampAlpha = this.applyDilution(baseStampAlpha)
    const r2 = wet ? r * 1.25 : r
    const { color, alpha } = this.resolveStamp(p, stampAlpha)
    if (this.settings.texture === 'none') {
      this.fillShape(p.x, p.y, r2, color, alpha)
    } else {
      this.stampTextured(p, r2, color, alpha)
    }
  }

  // MARKER — wide multiply-blended stamp; honors hardness/shape
  private stampMarker(p: StrokePoint, r: number) {
    const alpha = this.settings.opacity * (this.settings.pressureSim ? (0.6 + 0.4 * p.pressure) : 1)
    const stampAlpha = this.applyDilution(0.13 * alpha)
    const { color, alpha: a } = this.resolveStamp(p, stampAlpha)
    if (this.settings.texture === 'none') {
      this.fillShape(p.x, p.y, r, color, a, 'multiply')
    } else {
      this.stampTextured(p, r, color, a, 'multiply')
    }
  }

  /**
   * Draw a stamp into an offscreen surface, apply the configured texture as an
   * alpha mask, then composite the result onto the main canvas. The texture's
   * pattern is aligned in world space so neighbouring stamps share grain.
   */
  private stampTextured(
    p: StrokePoint, r: number, color: string, alpha: number,
    mainComposite?: 'multiply',
  ) {
    const stampDia = Math.max(6, Math.ceil(r * 2.5))
    if (!this.tempStamp || this.tempStamp.width !== stampDia) {
      this.tempStamp?.dispose?.()
      this.tempStamp = this.backend.createSurface(stampDia, stampDia)
    }
    const temp = this.tempStamp
    temp.clear()
    // Draw the shaped stamp centered inside the temp surface
    this.fillShape(stampDia / 2, stampDia / 2, r, color, alpha, undefined, temp)
    // Mask it with the texture, world-aligned
    temp.maskWithTexture(
      this.settings.texture,
      0, 0, stampDia, stampDia,
      p.x - stampDia / 2, p.y - stampDia / 2,
    )
    // Composite onto main
    this.backend.drawSurface(temp, p.x - stampDia / 2, p.y - stampDia / 2, mainComposite)
  }

  // WATERCOLOR — soft pigment, intentionally wet. Pools when the pointer dwells.
  private stampWatercolor(p: StrokePoint, r: number) {
    const targetAlpha = this.settings.opacity * (this.settings.pressureSim ? (0.45 + 0.55 * p.pressure) : 0.85)
    const baseStampAlpha = 0.14 * targetAlpha
    const stampAlpha = this.applyDilution(baseStampAlpha)
    const { color, alpha } = this.resolveStamp(p, stampAlpha)
    this.fillShape(p.x, p.y, r * 1.25, color, alpha)
  }

  // WATERCOLOR pool — driven by tick() while pointer is stationary.
  // Repeated low-alpha stamps grow opacity & spread at the anchor.
  private stampWatercolorPool(p: { x: number; y: number }, growth: number) {
    const baseR = this.settings.size / 2
    const r = baseR + growth
    const sp: StrokePoint = { x: p.x, y: p.y, pressure: 1, t: 0 }
    const { color, alpha } = this.resolveStamp(sp, 0.07 * this.settings.opacity)
    this.fillShape(p.x, p.y, r * 1.55, color, alpha)
  }

  // SPRAY — scattered particles within a radius around the cursor.
  // `strength` is used as density (particles per stamp), `size` as spread radius.
  private stampSpray(p: StrokePoint, r: number) {
    const c = this.settings.color
    const density = this.settings.strength
    const targetAlpha = this.settings.opacity * (this.settings.pressureSim ? (0.4 + 0.6 * p.pressure) : 1)
    const particleCount = Math.max(1, Math.floor(density * r * 0.7))
    for (let i = 0; i < particleCount; i++) {
      const ang = this.rng() * Math.PI * 2
      // sqrt for even areal distribution; bias slightly inward
      const dist = Math.pow(this.rng(), 0.7) * r
      const px = p.x + Math.cos(ang) * dist
      const py = p.y + Math.sin(ang) * dist
      const pr = 0.4 + this.rng() * 1.6
      const alpha = targetAlpha * (0.25 + this.rng() * 0.55)
      this.backend.fillCircle(px, py, pr, c, alpha)
    }
  }

  // ERASER — soft-edge destination-out
  private stampEraser(p: StrokePoint, r: number) {
    const soft = this.settings.softness
    const stops: GradientStop[] = [
      { offset: 0,                      color: 'rgba(0,0,0,1)' },
      { offset: Math.max(0.05, 1 - soft), color: 'rgba(0,0,0,1)' },
      { offset: 1,                      color: 'rgba(0,0,0,0)' },
    ]
    this.backend.fillRadialGradient(
      p.x, p.y, 0, r, stops,
      { x: p.x - r - 1, y: p.y - r - 1, w: r * 2 + 2, h: r * 2 + 2 },
      'destination-out',
    )
  }

  // SMUDGE — sample pixels at previous position, redraw at current with reduced alpha
  private stampSmudge(p: StrokePoint, r: number) {
    const strength = this.settings.strength
    if (!this.smudgePickedAt) {
      this.captureSmudgeBuffer(p.x, p.y, r)
      return
    }
    const buf = this.smudgePicked
    if (!buf) return
    const size = buf.width
    const dx = p.x - this.smudgePickedAt.x
    const dy = p.y - this.smudgePickedAt.y
    // Blend the picked patch toward the new position via a temp surface so the
    // soft radial edge is preserved.
    const tmp = this.backend.createSurface(size, size)
    tmp.putRegion(buf, 0, 0)
    // soft mask (destination-in)
    const stops: GradientStop[] = [
      { offset: 0,   color: 'rgba(0,0,0,1)' },
      { offset: 0.6, color: 'rgba(0,0,0,0.85)' },
      { offset: 1,   color: 'rgba(0,0,0,0)' },
    ]
    tmp.fillRadialGradient(
      size / 2, size / 2, 0, size / 2, stops,
      { x: 0, y: 0, w: size, h: size },
      'destination-in',
    )
    this.backend.drawSurface(tmp, p.x - size / 2, p.y - size / 2, undefined, strength * 0.8)
    tmp.dispose?.()
    // Re-capture from the new spot for next step
    this.captureSmudgeBuffer(p.x + dx * 0.3, p.y + dy * 0.3, r)
  }

  private captureSmudgeBuffer(x: number, y: number, r: number) {
    const size = Math.max(6, Math.ceil(r * 2))
    const sx = Math.max(0, Math.floor(x - size / 2))
    const sy = Math.max(0, Math.floor(y - size / 2))
    const w = Math.min(size, this.backend.width - sx)
    const h = Math.min(size, this.backend.height - sy)
    if (w <= 0 || h <= 0) { this.smudgePicked = null; return }
    const region = this.backend.getRegion(sx, sy, w, h)
    if (region) {
      this.smudgePicked = region
      this.smudgePickedAt = { x, y }
    } else {
      this.smudgePicked = null
    }
  }

  // ── Bristle brushes (Dry Brush / Ink Brush) ──────────────────────────

  /**
   * Generate a fixed set of bristles for one stroke. Each bristle has a stable
   * perpendicular offset across the brush width, a thickness, a base opacity,
   * and a noise seed. Keeping them fixed for the whole stroke is what makes the
   * dry streaks continuous instead of a fizzy random mess each stamp.
   */
  private generateBristles(heavy: boolean) {
    const count = heavy ? 30 : 16
    const arr: { off: number; w: number; dry: number; seed: number }[] = []
    for (let i = 0; i < count; i++) {
      const base = (i / (count - 1)) * 2 - 1                     // evenly -1..1
      const jitter = (this.rng() - 0.5) * (2 / count)            // break regularity
      const off = Math.max(-1, Math.min(1, base + jitter))
      arr.push({
        off,
        w: 0.4 + this.rng() * 1.3,
        dry: 0.55 + this.rng() * 0.45,
        seed: this.rng() * 1000,
      })
    }
    this.bristles = arr
  }

  /**
   * Dry-bristle stamp. Distributes the bristles across the axis perpendicular
   * to the travel direction, then paints a small dot per bristle — but lifts
   * bristles off the paper (skips them) according to a smooth noise sampled
   * along the travelled distance. That produces the characteristic streaky,
   * broken-coverage, ragged-edge ink-brush look.
   *
   *   - `heavy` (Ink Brush): more bristles, lower skip threshold → dense black
   *     body with only the edges breaking up.
   *   - otherwise (Dry Brush): fewer bristles, high skip threshold → sparse,
   *     scratchy streaks.
   *
   * The "Dryness" slider (settings.strength) scales the skip threshold.
   */
  private stampBristle(p: StrokePoint, r: number, heavy: boolean) {
    const color = this.settings.color === 'transparent' ? '#000000' : this.settings.color

    // Travel direction (from the previous stamp). Fallback to horizontal at the
    // very start of a stroke before any movement is known.
    let dx = p.x - this.prevStampX
    let dy = p.y - this.prevStampY
    let len = Math.hypot(dx, dy)
    if (!this.hasPrevStamp || len < 1e-4) { dx = 1; dy = 0; len = 1 }
    else { this.bristleDist += len }
    dx /= len; dy /= len
    const perpX = -dy, perpY = dx

    const baseAlpha = this.settings.opacity *
      (this.settings.pressureSim ? (0.5 + 0.5 * p.pressure) : 1)
    const dryness = this.settings.strength

    for (const b of this.bristles) {
      // Position across the width + gentle wander along the stroke.
      const wobble = (this.smoothNoise(this.bristleDist * 0.05 + b.seed, b.seed) - 0.5) * r * 0.14
      const off = b.off * r + wobble
      const bx = p.x + perpX * off
      const by = p.y + perpY * off

      // Flicker: continuous along the stroke because it samples noise indexed by
      // travelled distance. Edges (|off| near 1) skip more → ragged perimeter.
      const flick = this.smoothNoise(this.bristleDist * 0.08 + b.seed * 1.7, b.seed * 0.3)
      const edge = Math.abs(b.off)
      const skip = (heavy ? 0.12 : 0.42) * dryness * (0.55 + edge * 0.95)
      if (flick < skip) continue

      const bw = r * (heavy ? (0.05 + b.w * 0.05) : (0.03 + b.w * 0.035))
      const alpha = Math.min(1, baseAlpha * (0.45 + flick * 0.55) * b.dry)
      this.backend.fillCircle(bx, by, Math.max(0.4, bw), color, alpha)
    }
  }

  // ── Waterdrop ────────────────────────────────────────────────────────

  /**
   * Waterdrop — applies a radial outward displacement to existing pixels,
   * then blurs to simulate wet paint spreading.
   *
   *   - "size" controls the radius of the drop.
   *   - "strength" controls how far colors are pushed outward (0 = none, 1 = max).
   *
   * The algorithm reads a circular patch, displaces each pixel outward from the
   * center (by sampling from a position closer to the center), then applies a
   * box-blur pass for colour bleeding, and writes back with a soft radial mask.
   */
  private stampWaterdrop(p: StrokePoint, r: number) {
    const { strength } = this.settings
    const cx = p.x, cy = p.y

    // The drop boundary is enlarged to 1.4 r because the irregular edge can
    // extend up to ~35 % beyond the nominal radius.
    const outerR = r * 1.38
    const margin = Math.ceil(outerR) + 2
    const x0 = Math.max(0, Math.floor(cx - margin))
    const y0 = Math.max(0, Math.floor(cy - margin))
    const x1 = Math.min(this.backend.width,  Math.ceil(cx + margin))
    const y1 = Math.min(this.backend.height, Math.ceil(cy + margin))
    const w = x1 - x0, h = y1 - y0
    if (w <= 0 || h <= 0) return

    const src = this.backend.getRegion(x0, y0, w, h)
    if (!src) return

    const sd = src.data
    const dst = new Uint8ClampedArray(sd.length)
    const maxPush = r * Math.min(1, strength) * 0.45

    // Noise spatial frequency: ~0.8 samples per radius unit gives organic blobs.
    const noiseFreq = 0.8 / Math.max(1, r)
    // Seed the noise by drop position so repeated drops at the same spot
    // look slightly different and adjacent drops don't mirror each other.
    const nsX = ((cx * 0.137 + cy * 0.051) % 100 + 100) % 100
    const nsY = ((cx * 0.071 - cy * 0.093) % 100 + 100) % 100

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const canX = x0 + px, canY = y0 + py
        const dx = canX - cx, dy = canY - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        const di = (py * w + px) * 4

        if (dist < 0.5) {
          dst[di] = sd[di]; dst[di+1] = sd[di+1]; dst[di+2] = sd[di+2]; dst[di+3] = sd[di+3]
          continue
        }

        // ── Irregular boundary ────────────────────────────────────────────
        // Sample noise along the unit direction from centre to get per-angle
        // reach variation (0.65r … 1.35r).  Using 3× the base frequency gives
        // 3-5 lobes, which looks like a natural water splat.
        const angle = Math.atan2(dy, dx)
        const bndN = this.smoothNoise(
          (cx + Math.cos(angle) * r) * noiseFreq * 3 + nsX,
          (cy + Math.sin(angle) * r) * noiseFreq * 3 + nsY,
        )
        const effectiveR = r * (0.65 + bndN * 0.70)   // 0.65r … 1.35r

        if (dist >= effectiveR) {
          dst[di] = sd[di]; dst[di+1] = sd[di+1]; dst[di+2] = sd[di+2]; dst[di+3] = sd[di+3]
          continue
        }

        // ── Displacement with turbulence ──────────────────────────────────
        const t       = dist / effectiveR
        const falloff = 1 - t * t            // full at centre, zero at boundary

        // Angular turbulence: rotate the outward push direction by ±60°.
        // Two independent noise channels give full 2-D vector turbulence.
        const turbN = this.smoothNoise(
          canX * noiseFreq + nsX + 20,
          canY * noiseFreq + nsY + 20,
        )
        const turbAngle = (turbN * 2 - 1) * Math.PI / 3  // ±60°
        const sa = Math.sin(turbAngle), ca = Math.cos(turbAngle)
        const baseDirX = dx / dist, baseDirY = dy / dist
        const turbDirX = baseDirX * ca - baseDirY * sa
        const turbDirY = baseDirX * sa + baseDirY * ca

        // Magnitude variation: 0.35× … 1.65× so some fingers extend further.
        const magnN = this.smoothNoise(
          canX * noiseFreq + nsX + 60,
          canY * noiseFreq + nsY + 60,
        )
        const magnMod    = 0.35 + magnN * 1.30
        const displacement = maxPush * falloff * magnMod

        const sampX = canX - turbDirX * displacement
        const sampY = canY - turbDirY * displacement

        // ── Bilinear sample ───────────────────────────────────────────────
        const lx = sampX - x0, ly = sampY - y0
        const x1f = Math.max(0, Math.min(w - 1, lx))
        const y1f = Math.max(0, Math.min(h - 1, ly))
        const xi = Math.floor(x1f), yi = Math.floor(y1f)
        const x2 = Math.min(w - 1, xi + 1), y2 = Math.min(h - 1, yi + 1)
        const fx = x1f - xi, fy = y1f - yi

        for (let c = 0; c < 4; c++) {
          const tl = sd[(yi * w + xi) * 4 + c]
          const tr = sd[(yi * w + x2) * 4 + c]
          const bl = sd[(y2 * w + xi) * 4 + c]
          const br = sd[(y2 * w + x2) * 4 + c]
          dst[di + c] = Math.round(
            tl * (1 - fx) * (1 - fy) +
            tr * fx       * (1 - fy) +
            bl * (1 - fx) * fy +
            br * fx       * fy,
          )
        }
      }
    }

    // Blur for colour bleeding — radius scaled to outer reach.
    const blurR = Math.max(1, Math.round(r * 0.04 + strength * 3))
    this.boxBlurInCircle(dst, w, h, cx - x0, cy - y0, outerR * 0.92, blurR)

    // Composite with soft irregular mask via an offscreen surface.
    const outImg: PixelRegion = { data: dst, width: w, height: h }
    const tmp = this.backend.createSurface(w, h)
    tmp.putRegion(outImg, 0, 0)
    const maskStops: GradientStop[] = [
      { offset: 0,    color: 'rgba(0,0,0,1)' },
      { offset: 0.75, color: 'rgba(0,0,0,0.95)' },
      { offset: 1,    color: 'rgba(0,0,0,0)' },
    ]
    tmp.fillRadialGradient(
      cx - x0, cy - y0, r * 0.1, outerR, maskStops,
      { x: 0, y: 0, w, h },
      'destination-in',
    )
    this.backend.drawSurface(tmp, x0, y0)
    tmp.dispose?.()

    // Ink tint — skipped in water-only mode.
    if (this.settings.color !== 'transparent') {
      const inkAlpha = this.settings.opacity * 0.18
      const inkStops: GradientStop[] = [
        { offset: 0,    color: this.withAlpha(this.settings.color, inkAlpha) },
        { offset: 0.65, color: this.withAlpha(this.settings.color, inkAlpha * 0.45) },
        { offset: 1,    color: this.withAlpha(this.settings.color, 0) },
      ]
      this.backend.fillRadialGradient(
        cx, cy, r * 0.05, outerR, inkStops,
        { x: cx - outerR - 1, y: cy - outerR - 1, w: (outerR + 1) * 2, h: (outerR + 1) * 2 },
      )
    }
  }

  /**
   * Value noise — smooth bilinear interpolation of a hash lattice.
   * Returns a value in [0, 1).  Fast enough for per-pixel inner loops at
   * typical waterdrop sizes (≤ 100 × 100 pixels).
   */
  private smoothNoise(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y)
    const fx = x - ix, fy = y - iy
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
    const h = (a: number, b: number) => {
      let n = ((a * 1619 ^ b * 31337 ^ 0xb5297a4d) * 0x68e31da4) | 0
      n = (n ^ (n >>> 16)) * 0x45d9f3b | 0
      return ((n ^ (n >>> 16)) >>> 0) / 0x100000000
    }
    return h(ix,   iy)   * (1 - ux) * (1 - uy)
         + h(ix+1, iy)   * ux       * (1 - uy)
         + h(ix,   iy+1) * (1 - ux) * uy
         + h(ix+1, iy+1) * ux       * uy
  }

  /** Box-blur pixels that lie inside the given circle radius. */
  private boxBlurInCircle(
    data: Uint8ClampedArray,
    w: number, h: number,
    cx: number, cy: number,
    r: number, blurR: number,
  ) {
    const src = new Uint8ClampedArray(data)
    const r2 = r * r
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = px - cx, dy = py - cy
        if (dx * dx + dy * dy > r2) continue
        let rr = 0, gg = 0, bb = 0, aa = 0, n = 0
        for (let ky = -blurR; ky <= blurR; ky++) {
          for (let kx = -blurR; kx <= blurR; kx++) {
            const nx = px + kx, ny = py + ky
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
            const si = (ny * w + nx) * 4
            rr += src[si]; gg += src[si+1]; bb += src[si+2]; aa += src[si+3]
            n++
          }
        }
        if (n > 0) {
          const di = (py * w + px) * 4
          data[di] = rr/n; data[di+1] = gg/n; data[di+2] = bb/n; data[di+3] = aa/n
        }
      }
    }
  }
}
