import type { AssistSettings, ToolSettingsMap, TextureBrushSettings } from './types'

/** Default Texture-Brush (profibrush) params — perfect-freehand ribbon (STEP 1) + lengthwise streak
 *  overlay (STEP 2). `angle`/`angleWidth` give a flat-brush variable width (thin along the angle, wide
 *  across it); `bristles` is the streak count; `colorRandom` the per-streak painterly variation. */
export const DEFAULT_TEX: TextureBrushSettings = {
  bristles: 6, smoothing: 0.55, taper: 0.5, angle: 45, angleWidth: 0,
  spacing: 0.06, aspect: 2.6, rotate: 38, auto: false, dynamics: 0.35,
  fadeIn: 5, fadeOut: 8, inkFade: 0.1, colorRandom: 35, angleRandom: 0, scaleRandom: 0, jitter: 0.25,
}

/**
 * Canonical product defaults shared by web and native, so every tool starts identically on
 * both platforms (previously duplicated in apps/web DrawingScreen and apps/native tools.ts,
 * which risked drift). Values are tuned against the baseline parity corpus — keep them in
 * sync with docs/baseline if they change.
 *
 * NOTE: the StrokeEngine has its OWN internal DEFAULT_ASSIST fallback (engine.ts) for when no
 * assist is supplied; this DEFAULT_ASSIST is the app-level default the editor puts on the model.
 */
const COMMON = { hardness: 0.6, shape: 'circle' as const, texture: 'none' as const, blending: 0, dilution: 0, persistence: 0.7, buildUp: false }

export const DEFAULT_SETTINGS: ToolSettingsMap = {
  brush:      { color: '#7c8cff', size: 28, opacity: 0.85, softness: 0.5, strength: 0.6,  pressureSim: true,  wetPaint: false, ...COMMON, buildUp: true },
  drybrush:   { color: '#111318', size: 46, opacity: 0.95, softness: 0.5, strength: 0.65, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  inkbrush:   { color: '#0a0b0e', size: 64, opacity: 1.0,  softness: 0.5, strength: 0.5,  pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  pencil:     { color: '#0a0b0e', size: 6,  opacity: 0.85, softness: 0.5, strength: 0.6,  pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  pen:        { color: '#111318', size: 4,  opacity: 1.0,  softness: 0.5, strength: 0.6,  pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  marker:     { color: '#ffd166', size: 36, opacity: 0.6,  softness: 0.5, strength: 0.6,  pressureSim: false, wetPaint: false, ...COMMON, hardness: 0.75, buildUp: true },
  watercolor: { color: '#118ab2', size: 40, opacity: 0.85, softness: 0.5, strength: 0.6,  pressureSim: true,  wetPaint: true,  ...COMMON, hardness: 0.25, blending: 0.4, dilution: 0.3, buildUp: true },
  spray:      { color: '#ef476f', size: 60, opacity: 0.7,  softness: 0.5, strength: 0.6,  pressureSim: true,  wetPaint: false, ...COMMON },
  eraser:     { color: '#000000', size: 30, opacity: 1.0,  softness: 0.4, strength: 0.6,  pressureSim: false, wetPaint: false, ...COMMON },
  smudge:     { color: '#000000', size: 36, opacity: 1.0,  softness: 0.5, strength: 0.55, pressureSim: false, wetPaint: false, ...COMMON },
  waterdrop:  { color: 'transparent', size: 80, opacity: 0.7, softness: 0.5, strength: 0.6, pressureSim: false, wetPaint: false, ...COMMON },
  impasto:    { color: '#c0563b', size: 42, opacity: 1.0,  softness: 0.5, strength: 0.6,  pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  oil:        { color: '#e8732a', size: 46, opacity: 1.0,  softness: 0.5, strength: 0.6,  pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1, dilution: 0.25 },
  bucket:     { color: '#e8732a', size: 40, opacity: 1.0,  softness: 0.5, strength: 0.6,  pressureSim: false, wetPaint: false, ...COMMON },
  profibrush: { color: '#c4366b', size: 44, opacity: 0.95, softness: 0.5, strength: 0.6,  pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1, tex: { ...DEFAULT_TEX } },
}

export const DEFAULT_ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5,
  shapeAssist: false, shapeStrength: 0.6,
  perfectShape: true, holdToSnap: false, holdDelay: 500,
}
