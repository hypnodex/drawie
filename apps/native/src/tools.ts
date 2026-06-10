import type { ToolId, ToolSettings, ToolSettingsMap } from '@drawie/core'

/**
 * Per-tool default settings — copied from the web app's DEFAULT_SETTINGS
 * (apps/web DrawingScreen / tools/baseline-capture replay) so native draws each
 * tool with the SAME settings as the /draw?skia=1 reference. These should be
 * hoisted into @drawie/core so web + native share one source — a small follow-up.
 */
const COMMON = {
  hardness: 0.6, shape: 'circle' as const, texture: 'none' as const,
  blending: 0, dilution: 0, persistence: 0.7, buildUp: false,
}

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
}

export const TOOL_IDS: ToolId[] = [
  'brush', 'drybrush', 'inkbrush', 'pencil', 'pen', 'marker', 'watercolor', 'spray', 'eraser', 'smudge', 'waterdrop',
]

/**
 * A selectable brush preset = a base tool + its settings. The first 11 are the tools
 * with their defaults (texture 'none'); the trailing ones exercise the textured-stamp
 * path (maskWithTexture) which no default tool uses, so we can compare grain against
 * the web /draw?skia=1 reference. Selecting a preset only changes what the NEXT stroke
 * uses — the canvas keeps its pixels, so readback tools (eraser/smudge/waterdrop) can
 * act on strokes laid down with another preset.
 */
export type Preset = { key: string; label: string; tool: ToolId; settings: ToolSettings }

export const PRESETS: Preset[] = [
  ...TOOL_IDS.map((id) => ({ key: id, label: id, tool: id, settings: DEFAULT_SETTINGS[id] })),
  { key: 'brush+canvas', label: 'brush·canvas', tool: 'brush', settings: { ...DEFAULT_SETTINGS.brush, texture: 'canvas' } },
  { key: 'drybrush+grain', label: 'dry·grain', tool: 'drybrush', settings: { ...DEFAULT_SETTINGS.drybrush, texture: 'grain' } },
  { key: 'brush+speckle', label: 'brush·speckle', tool: 'brush', settings: { ...DEFAULT_SETTINGS.brush, texture: 'speckle' } },
]
