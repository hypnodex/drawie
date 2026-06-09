import { AssistSettings, ToolId, ToolSettings, StrokePoint, type InputPoint } from '@drawie/core'
import { applyTextureMask } from './textures'

// InputPoint now lives in @drawie/core (shared data contract); re-exported here so
// existing `import { InputPoint } from '../drawing/engine'` call sites keep working.
export type { InputPoint }

const DEFAULT_ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5,
  shapeAssist: false, shapeStrength: 0.6,
  perfectShape: true, holdToSnap: false, holdDelay: 500,
}

/**
 * StrokeEngine renders a single stroke onto a target 2D context using
 * distance-based stamping with smoothed input. Each tool implements its
 * own stamp/segment style; the outer interpolation/pressure logic is shared.
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

  // smudge tool needs to carry color from the underlying canvas
  private smudgePicked: ImageData | null = null
  private smudgePickedAt: { x: number; y: number } | null = null

  // watercolor dwell pooling
  private lastMoveAt = 0
  private dwellGrowth = 0
  private dwellAnchor: { x: number; y: number; pressure: number } | null = null

  // paint depletion (dilution + persistence)
  private inkRemaining = 1

  // reusable offscreen stamp canvas for textured tools
  private tempStamp: HTMLCanvasElement | null = null

  // raw input points captured during the stroke — used for post-process refinement
  private rawPoints: InputPoint[] = []

  // bristle brush state (drybrush / inkbrush) — generated once per stroke so the
  // streaks stay continuous as the brush travels.
  private bristles: { off: number; w: number; dry: number; seed: number }[] = []
  private bristleDist = 0

  constructor(
    private ctx: CanvasRenderingContext2D,
    private tool: ToolId,
    private settings: ToolSettings,
    private assist: AssistSettings = DEFAULT_ASSIST,
  ) {}

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
    if (this.tool === 'drybrush' || this.tool === 'inkbrush') {
      this.bristleDist = 0
      this.generateBristles(this.tool === 'inkbrush')
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

  /** Sample a 3×3 average from the destination canvas at p; returns null on transparent. */
  private sampleDest(x: number, y: number): { r: number; g: number; b: number; a: number } | null {
    try {
      const cx = Math.max(0, Math.min(this.ctx.canvas.width - 1, Math.round(x)))
      const cy = Math.max(0, Math.min(this.ctx.canvas.height - 1, Math.round(y)))
      const img = this.ctx.getImageData(cx, cy, 1, 1).data
      return { r: img[0], g: img[1], b: img[2], a: img[3] / 255 }
    } catch {
      return null
    }
  }

  /** Mix brush color toward sampled destination color by `amount` (0..1). */
  private blendColor(brushHex: string, x: number, y: number, amount: number): string {
    if (amount <= 0.001) return brushHex
    const dst = this.sampleDest(x, y)
    if (!dst || dst.a < 0.05) return brushHex
    const src = this.hexToRgb(brushHex)
    const t = amount * dst.a
    return this.rgbToHex(
      src.r * (1 - t) + dst.r * t,
      src.g * (1 - t) + dst.g * t,
      src.b * (1 - t) + dst.b * t,
    )
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
  ): { color: string; alpha: number; composite?: GlobalCompositeOperation } {
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

  private rgbDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
    const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b
    return Math.sqrt(dr * dr + dg * dg + db * db)
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
    composite?: GlobalCompositeOperation,
    target?: CanvasRenderingContext2D,
  ) {
    const ctx = target ?? this.ctx
    const shape = this.settings.shape
    const hardness = this.settings.hardness
    // Hardness controls when the solid portion ends; rest is the soft falloff.
    const innerStop = 0.04 + hardness * 0.86
    const reach = r * (shape === 'square' ? 1 : 1.04)

    ctx.save()
    if (composite) ctx.globalCompositeOperation = composite
    ctx.globalAlpha = alpha

    if (shape === 'square') {
      ctx.fillStyle = color
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    } else {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, reach)
      grad.addColorStop(0, this.withAlpha(color, 1))
      grad.addColorStop(innerStop, this.withAlpha(color, 1))
      grad.addColorStop(1, this.withAlpha(color, 0))
      ctx.fillStyle = grad
      ctx.fillRect(x - reach - 1, y - reach - 1, reach * 2 + 2, reach * 2 + 2)
    }
    ctx.restore()
  }

  // PEN — crisp solid stroke, segment-based for clean lines
  private stampPen(p: StrokePoint, r: number) {
    const ctx = this.ctx
    const alpha = this.settings.opacity * (this.settings.pressureSim ? (0.6 + 0.4 * p.pressure) : 1)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.settings.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    if (this.hasPrevStamp) {
      ctx.strokeStyle = this.settings.color
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.max(1, (r * 2 + this.prevStampDia) / 2)
      ctx.beginPath()
      ctx.moveTo(this.prevStampX, this.prevStampY)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  // PENCIL — small textured stamps with alpha noise
  private stampPencil(p: StrokePoint, r: number) {
    const ctx = this.ctx
    const baseAlpha = this.settings.opacity * (this.settings.pressureSim ? (0.4 + 0.6 * p.pressure) : 0.85)
    // Multiple jittered micro-dots within radius for grainy feel
    const dots = 4
    ctx.save()
    ctx.fillStyle = this.settings.color
    for (let i = 0; i < dots; i++) {
      const ang = Math.random() * Math.PI * 2
      const rr = Math.random() * r * 0.65
      const dx = Math.cos(ang) * rr
      const dy = Math.sin(ang) * rr
      const dotR = r * (0.18 + Math.random() * 0.22)
      ctx.globalAlpha = baseAlpha * (0.35 + Math.random() * 0.65)
      ctx.beginPath()
      ctx.arc(p.x + dx, p.y + dy, dotR, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
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
   * Draw a stamp into an offscreen canvas, apply the configured texture as an
   * alpha mask, then composite the result onto the main canvas. The texture's
   * pattern is aligned in world space so neighbouring stamps share grain.
   */
  private stampTextured(
    p: StrokePoint, r: number, color: string, alpha: number,
    mainComposite?: GlobalCompositeOperation,
  ) {
    const stampDia = Math.max(6, Math.ceil(r * 2.5))
    if (!this.tempStamp) this.tempStamp = document.createElement('canvas')
    if (this.tempStamp.width !== stampDia) {
      this.tempStamp.width = this.tempStamp.height = stampDia
    }
    const tctx = this.tempStamp.getContext('2d')!
    tctx.clearRect(0, 0, stampDia, stampDia)
    // Draw the shaped stamp centered inside the temp canvas
    this.fillShape(stampDia / 2, stampDia / 2, r, color, alpha, undefined, tctx)
    // Mask it with the texture, world-aligned
    applyTextureMask(
      tctx, this.settings.texture,
      0, 0, stampDia, stampDia,
      p.x - stampDia / 2, p.y - stampDia / 2,
    )
    // Composite onto main
    const ctx = this.ctx
    ctx.save()
    if (mainComposite) ctx.globalCompositeOperation = mainComposite
    ctx.drawImage(this.tempStamp, p.x - stampDia / 2, p.y - stampDia / 2)
    ctx.restore()
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
    const ctx = this.ctx
    const c = this.settings.color
    const density = this.settings.strength
    const targetAlpha = this.settings.opacity * (this.settings.pressureSim ? (0.4 + 0.6 * p.pressure) : 1)
    const particleCount = Math.max(1, Math.floor(density * r * 0.7))
    ctx.save()
    ctx.fillStyle = c
    for (let i = 0; i < particleCount; i++) {
      const ang = Math.random() * Math.PI * 2
      // sqrt for even areal distribution; bias slightly inward
      const dist = Math.pow(Math.random(), 0.7) * r
      const px = p.x + Math.cos(ang) * dist
      const py = p.y + Math.sin(ang) * dist
      const pr = 0.4 + Math.random() * 1.6
      ctx.globalAlpha = targetAlpha * (0.25 + Math.random() * 0.55)
      ctx.beginPath()
      ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // ERASER — soft-edge destination-out
  private stampEraser(p: StrokePoint, r: number) {
    const ctx = this.ctx
    const soft = this.settings.softness
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(Math.max(0.05, 1 - soft), 'rgba(0,0,0,1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(p.x - r - 1, p.y - r - 1, r * 2 + 2, r * 2 + 2)
    ctx.restore()
  }

  // SMUDGE — sample pixels at previous position, redraw at current with reduced alpha
  private stampSmudge(p: StrokePoint, r: number) {
    const ctx = this.ctx
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
    // Blend the picked patch toward the new position
    ctx.save()
    ctx.globalAlpha = strength * 0.8
    // We need to put-then-draw via a temp canvas to preserve alpha + soft edge
    const tmp = document.createElement('canvas')
    tmp.width = size; tmp.height = size
    const tctx = tmp.getContext('2d')!
    tctx.putImageData(buf, 0, 0)
    // soft mask
    tctx.globalCompositeOperation = 'destination-in'
    const grad = tctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.6, 'rgba(0,0,0,0.85)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    tctx.fillStyle = grad
    tctx.fillRect(0, 0, size, size)
    ctx.drawImage(tmp, p.x - size / 2, p.y - size / 2)
    ctx.restore()
    // Re-capture from the new spot for next step
    this.captureSmudgeBuffer(p.x + dx * 0.3, p.y + dy * 0.3, r)
  }

  private captureSmudgeBuffer(x: number, y: number, r: number) {
    const ctx = this.ctx
    const size = Math.max(6, Math.ceil(r * 2))
    const sx = Math.max(0, Math.floor(x - size / 2))
    const sy = Math.max(0, Math.floor(y - size / 2))
    const w = Math.min(size, ctx.canvas.width - sx)
    const h = Math.min(size, ctx.canvas.height - sy)
    if (w <= 0 || h <= 0) { this.smudgePicked = null; return }
    try {
      this.smudgePicked = ctx.getImageData(sx, sy, w, h)
      this.smudgePickedAt = { x, y }
    } catch {
      this.smudgePicked = null
    }
  }

  // ── Build-up ─────────────────────────────────────────────────────────

  /**
   * Per-pixel darkening post-pass for the build-up effect.
   *
   * Separating this from the stamp gradient solves two problems:
   *   1. Non-uniformity — the gradient stamp darkens the centre more than the
   *      edges because multiply alpha is weighted by the gradient. Here every
   *      opaque pixel inside the stroke body gets exactly the same `dk`, so
   *      there are no "hotspot rings" after repeated overstrokes.
   *   2. Hue drift — the multiply composite pushes colours toward the brush hue
   *      over time. Direct `pixel *= (1-dk)` darkens neutrally toward black
   *      regardless of the brush colour.
   *
   * `kBase ≈ 0.003`: each stamp darkens by 0.3 %, so ~80 overstrokes produce
   * ~22 % darkening and 200+ overstrokes can reach near-black. Each step is
   * well below the visual threshold — no discrete jumps.
   */
  private applyBuildUp(p: StrokePoint, r: number) {
    const ctx = this.ctx
    const cx = p.x, cy = p.y
    const margin = Math.ceil(r) + 1
    const x0 = Math.max(0, Math.floor(cx - margin))
    const y0 = Math.max(0, Math.floor(cy - margin))
    const x1 = Math.min(ctx.canvas.width,  Math.ceil(cx + margin))
    const y1 = Math.min(ctx.canvas.height, Math.ceil(cy + margin))
    const w = x1 - x0, h = y1 - y0
    if (w <= 0 || h <= 0) return

    let img: ImageData
    try { img = ctx.getImageData(x0, y0, w, h) } catch { return }

    const d = img.data
    const hex = this.settings.color === 'transparent' ? '#000000' : this.settings.color
    const brushRgb = this.hexToRgb(hex)
    // Darker brush colours build up slightly faster (more pigment density).
    const brushLuma = (brushRgb.r * 0.299 + brushRgb.g * 0.587 + brushRgb.b * 0.114) / 255
    const kBase = 0.003 + (1 - brushLuma) * 0.002  // 0.003 (white) … 0.005 (black)

    // Flat darkening inside 80 % of radius; smooth linear fade out to the edge.
    // This avoids gradient-centre hotspots while keeping a soft perimeter.
    const flatZone = r * 0.80
    const r2 = r * r

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = (x0 + px) - cx, dy = (y0 + py) - cy
        const dist2 = dx * dx + dy * dy
        if (dist2 >= r2) continue

        const idx = (py * w + px) * 4
        // Only darken well-painted pixels so the first stroke is unaffected.
        if (d[idx + 3] < 220) continue

        const dist = Math.sqrt(dist2)
        const falloff = dist <= flatZone
          ? 1
          : 1 - (dist - flatZone) / (r - flatZone)

        const dk = kBase * falloff
        d[idx]     = Math.max(0, d[idx]     * (1 - dk) | 0)
        d[idx + 1] = Math.max(0, d[idx + 1] * (1 - dk) | 0)
        d[idx + 2] = Math.max(0, d[idx + 2] * (1 - dk) | 0)
        // Alpha stays unchanged — only RGB channels darken.
      }
    }

    ctx.putImageData(img, x0, y0)
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
      const jitter = (Math.random() - 0.5) * (2 / count)         // break regularity
      const off = Math.max(-1, Math.min(1, base + jitter))
      arr.push({
        off,
        w: 0.4 + Math.random() * 1.3,
        dry: 0.55 + Math.random() * 0.45,
        seed: Math.random() * 1000,
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
    const ctx = this.ctx
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

    ctx.save()
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
      ctx.globalAlpha = Math.min(1, baseAlpha * (0.45 + flick * 0.55) * b.dry)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(bx, by, Math.max(0.4, bw), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
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
    const ctx = this.ctx
    const { strength } = this.settings
    const cx = p.x, cy = p.y

    // The drop boundary is enlarged to 1.4 r because the irregular edge can
    // extend up to ~35 % beyond the nominal radius.
    const outerR = r * 1.38
    const margin = Math.ceil(outerR) + 2
    const x0 = Math.max(0, Math.floor(cx - margin))
    const y0 = Math.max(0, Math.floor(cy - margin))
    const x1 = Math.min(ctx.canvas.width,  Math.ceil(cx + margin))
    const y1 = Math.min(ctx.canvas.height, Math.ceil(cy + margin))
    const w = x1 - x0, h = y1 - y0
    if (w <= 0 || h <= 0) return

    let src: ImageData
    try { src = ctx.getImageData(x0, y0, w, h) } catch { return }

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

    // Composite with soft irregular mask.
    const outImg = new ImageData(dst, w, h)
    const tmp = document.createElement('canvas')
    tmp.width = w; tmp.height = h
    const tctx = tmp.getContext('2d')!
    tctx.putImageData(outImg, 0, 0)

    tctx.globalCompositeOperation = 'destination-in'
    const maskGrad = tctx.createRadialGradient(cx - x0, cy - y0, r * 0.1, cx - x0, cy - y0, outerR)
    maskGrad.addColorStop(0,    'rgba(0,0,0,1)')
    maskGrad.addColorStop(0.75, 'rgba(0,0,0,0.95)')
    maskGrad.addColorStop(1,    'rgba(0,0,0,0)')
    tctx.fillStyle = maskGrad
    tctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.drawImage(tmp, x0, y0)
    ctx.restore()

    // Ink tint — skipped in water-only mode.
    if (this.settings.color !== 'transparent') {
      const inkAlpha = this.settings.opacity * 0.18
      ctx.save()
      const inkGrad = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, outerR)
      inkGrad.addColorStop(0,    this.withAlpha(this.settings.color, inkAlpha))
      inkGrad.addColorStop(0.65, this.withAlpha(this.settings.color, inkAlpha * 0.45))
      inkGrad.addColorStop(1,    this.withAlpha(this.settings.color, 0))
      ctx.fillStyle = inkGrad
      ctx.fillRect(cx - outerR - 1, cy - outerR - 1, (outerR + 1) * 2, (outerR + 1) * 2)
      ctx.restore()
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
