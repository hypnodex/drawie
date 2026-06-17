export type ToolId =
  | 'brush'
  | 'pencil'
  | 'pen'
  | 'marker'
  | 'watercolor'
  | 'spray'
  | 'eraser'
  | 'smudge'
  | 'waterdrop'
  | 'drybrush'
  | 'inkbrush'
  | 'impasto'
  | 'oil'
  | 'bucket'
  | 'profibrush'

export type BrushShape = 'circle' | 'square'

/**
 * Sumopaint-style "Texture Brush" params (Route A — flat stamp-along-path, no height/lighting). Only the
 * `profibrush` tool reads these; every other tool ignores them. The directional character comes from an
 * anisotropic tip stamped along the (minimally-smoothed) path, each rotated to a fixed angle or the local
 * tangent + offset.
 */
export interface TextureBrushSettings {
  bristles: number    // STEP 2 — number of lengthwise streak lines over the ribbon
  smoothing: number   // 0..1 — input streamline (higher = smoother ribbon)
  taper: number       // 0..1.5 — end taper distance as a fraction of size (rounded/pointed ends)
  angle: number       // brush angle in DEGREES (the flat-brush orientation for angle-based width)
  angleWidth: number  // 0..1 — how much the width varies with travel angle (0 = round; 1 = strong flat-brush)
  spacing: number     // (legacy — unused by the freehand model)
  aspect: number      // (legacy — unused)
  rotate: number      // (legacy — unused; superseded by `angle`)
  auto: boolean       // (legacy — unused)
  dynamics: number    // 0..1 — velocity → size/opacity (faster ⇒ thinner/lighter)
  fadeIn: number      // OPACITY fade-in distance at the START of the path, as a fraction of size
  fadeOut: number     // OPACITY fade-out distance at the END of the path, as a fraction of size
  inkFade: number     // 0..1 — opacity fades across the whole stroke (paint running out)
  colorRandom: number // 0..100 — per-stamp hue/value jitter (subtle painterly variation)
  angleRandom: number // random per-stamp rotation in DEGREES (0 = clean)
  scaleRandom: number // 0..1 — per-stamp size jitter
  jitter: number      // 0..1 — random perpendicular offset of stamps (fraction of diameter)
}

export type BrushTexture = 'none' | 'canvas' | 'grain' | 'noise' | 'speckle'
export const BRUSH_TEXTURES: BrushTexture[] = ['none', 'canvas', 'grain', 'noise', 'speckle']

export interface ToolSettings {
  color: string
  size: number       // 1..120, in canvas pixels
  opacity: number    // 0..1
  softness: number   // 0..1, used by eraser/smudge
  strength: number   // 0..1, used by smudge
  hardness: number   // 0..1, edge falloff of the stamp (0 = very soft, 1 = crisp)
  shape: BrushShape  // stamp shape
  texture: BrushTexture // grain pattern masked onto each stamp
  blending: number   // 0..1, wet-on-wet — pull color from underneath into the stamp
  dilution: number   // 0..1, paint runs out over the stroke (1 = full effect)
  persistence: number // 0..1, how long paint lasts (1 = never depletes; 0 = depletes fast)
  buildUp: boolean   // pigment density — once a pixel is saturated, additional passes darken
  pressureSim: boolean
  wetPaint: boolean
  tex?: TextureBrushSettings // profibrush (Texture Brush) params; undefined for every other tool
}

export type ToolSettingsMap = Record<ToolId, ToolSettings>

export interface StrokePoint {
  x: number
  y: number
  pressure: number   // 0..1
  t: number          // ms since stroke start
}

/** Raw pointer sample fed into the StrokeEngine (canvas-space coordinates). */
export interface InputPoint {
  x: number          // canvas-space (offscreen pixels)
  y: number
  pressure: number   // 0..1; meaningful only when hasPressure is true
  hasPressure: boolean
  tiltX?: number     // stylus tilt (-90..90); retained in the model for native pens
  tiltY?: number     // (the current engine ignores tilt — captured for the future)
  t: number          // ms timestamp (absolute)
}

export interface Layer {
  id: string
  name: string
  visible: boolean
}

export const MAX_LAYERS = 3

/** Global assist / "Functions" knobs that affect drawing across all tools. */
export interface AssistSettings {
  // Realtime stroke stabilization (input lag — Procreate-style motion filter)
  stabilize: boolean
  stabilizeStrength: number  // 0..1

  // Post-stroke shape assist (QuickShape-like analysis + replacement)
  shapeAssist: boolean
  shapeStrength: number      // 0..1 — sensitivity / detection threshold
  perfectShape: boolean      // true: clean geometric primitive; false: keep slight hand-drawn feel
  holdToSnap: boolean        // true: only snap when user holds still after drawing
  holdDelay: number          // ms before hold-to-snap triggers

  /** Internal flag used during shape-assist replay — when true, the engine
   *  skips its baseline input EMA so the generated point sequence stamps exactly. */
  bypassInputSmoothing?: boolean
}
