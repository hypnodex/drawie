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

export type BrushShape = 'circle' | 'square'

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
}

export type ToolSettingsMap = Record<ToolId, ToolSettings>

export interface StrokePoint {
  x: number
  y: number
  pressure: number   // 0..1
  t: number          // ms since stroke start
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
