import { DEFAULT_SETTINGS, type ToolId, type ToolSettings } from '@drawie/core'

// Per-tool defaults now live in @drawie/core (shared with web); re-exported here so the rest
// of the native app keeps a single import site for tool config.
export { DEFAULT_SETTINGS }

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
