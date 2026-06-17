import * as React from 'react'
import Svg, { Path, Rect, Circle } from 'react-native-svg'
import type { ToolId } from '@drawie/core'

type IconProps = { size?: number; color?: string }

/** Solid (filled) glyph — the drawing tools. Ported 1:1 from the web icons.tsx. */
function Solid({ size = 20, color = '#000', children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      {children}
    </Svg>
  )
}

/** Stroke glyph — the action icons (undo/redo/trash/etc.). */
function Stroke({ size = 20, color = '#000', children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  )
}

// ── Tool glyphs (solid) ──────────────────────────────────────────────────────
export const BrushIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M20.9 3.1a2.2 2.2 0 0 0-3.1 0l-6.6 6.6 3.1 3.1 6.6-6.6a2.2 2.2 0 0 0 0-3.1z" />
    <Path d="M9.7 11.1c-1.6-.3-3.2.2-4.4 1.4-1.5 1.5-1.6 4.6-2.3 6.4-.2.6.4 1.2 1 1 1.8-.7 4.9-.8 6.4-2.3 1.2-1.2 1.7-2.8 1.4-4.4l-2.1-2.1z" />
  </Solid>
)
export const ProfiBrushIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M21 3.2a1.7 1.7 0 0 0-2.4 0l-8.1 8.1 2.4 2.4 8.1-8.1a1.7 1.7 0 0 0 0-2.4z" />
    <Path d="M9.7 12.1l2.2 2.2-3.4 3.4-3.9 1.6c-.5.2-1-.3-.8-.8l1.6-3.9 4.3-2.5z" />
  </Solid>
)
export const DryBrushIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M18.4 2.9a2 2 0 0 1 2.7 2.7l-6.2 6.2-2.7-2.7 6.2-6.2z" />
    <Path d="M11.5 10.1l2.4 2.4-4.6 4.6c-.5.5-1.2.7-1.9.5l1-2.6-2.6 1c-.2-.7 0-1.4.5-1.9l4.6-4.6z" />
  </Solid>
)
export const InkBrushIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M16 2.8l5.2 5.2-2.4 1.1-3.9-3.9L16 2.8z" />
    <Path d="M14.3 6.4 17.6 9.7 8.4 18.9c-1.4 1.4-4.9 2.6-4.9 2.6s1.2-3.5 2.6-4.9l8.2-9.2z" />
  </Solid>
)
export const PencilIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M3 21l1-4.2L14.8 6 18 9.2 7.2 20 3 21z" />
    <Path d="M16.2 4.6l1.1-1.1a1.7 1.7 0 0 1 2.4 0l.8.8a1.7 1.7 0 0 1 0 2.4l-1.1 1.1-3.2-3.2z" />
  </Solid>
)
export const PenIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M19.8 4.2a2 2 0 0 0-2.8 0l-1.3 1.3 2.8 2.8 1.3-1.3a2 2 0 0 0 0-2.8z" />
    <Path d="M14.4 6.8 5 16.2l-1.9 4.9a.5.5 0 0 0 .6.6l4.9-1.9 9.4-9.4-3.6-3.6zm-7.8 11.8-1.2-1.2.7-2 2.5 2.5-2 .7z" fillRule="evenodd" clipRule="evenodd" />
  </Solid>
)
export const MarkerIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M16.9 3.5l3.6 3.6a1 1 0 0 1 0 1.4l-2 2-5-5 2-2a1 1 0 0 1 1.4 0z" />
    <Path d="M12.1 6.2l5.7 5.7-6.5 6.5-1 .3-3.4.9a.6.6 0 0 1-.7-.7l.9-3.4.3-1 4.7-8.3z" />
  </Solid>
)
export const WatercolorIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M12 2.7c3.1 4.1 6.3 7.5 6.3 11.3a6.3 6.3 0 1 1-12.6 0C5.7 10.2 8.9 6.8 12 2.7zm0 8.6a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z" fillRule="evenodd" clipRule="evenodd" />
  </Solid>
)
export const SprayIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M13.5 7H18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
    <Path d="M14 2.8h3.2v3.2H14z" />
    <Circle cx="6" cy="8" r="1" />
    <Circle cx="3.6" cy="11" r="1" />
    <Circle cx="6.8" cy="12.2" r="1" />
    <Circle cx="4" cy="15" r="1" />
    <Circle cx="6.4" cy="16.6" r="0.9" />
  </Solid>
)
export const EraserIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M8.7 20.4 3.6 15.3a2 2 0 0 1 0-2.8L12.7 3.4a2 2 0 0 1 2.8 0l4.9 4.9a2 2 0 0 1 0 2.8l-9 9H8.7z" />
    <Rect x="3" y="20.2" width="18" height="1.8" rx="0.9" />
  </Solid>
)
export const SmudgeIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M3.5 13.2c.3-3 4.2-4.2 6.8-2.6 2 1.2 4 1.2 5.4-.2 1-1 1-2.6 2.3-2.9 1.6-.3 2.8 1.3 2.3 2.8-1 3.3-4.8 4.9-8 3.6-1.9-.8-3.6-.6-4.4.8-.7 1.2-2.6.9-2.6-.5 0-.5.1-1 .2-1z" />
  </Solid>
)
export const WaterdropIcon = (p: IconProps) => (
  <Solid {...p}>
    <Path d="M12 3.2C8.7 7.8 6.3 10.9 6.3 14.1a5.7 5.7 0 0 0 11.4 0C17.7 10.9 15.3 7.8 12 3.2z" />
  </Solid>
)
export const ImpastoIcon = (p: IconProps) => (
  <Solid {...p}>
    {/* thick raised paint swipe — a blob with an offset shadow ridge to read as depth */}
    <Path d="M4.5 16.8c2.2-5 6.4-9.2 11.2-10.1 2.3-.4 4.3.9 4.3 3 0 4.3-5.2 8.5-11.4 9.6-2.5.4-4.8-.4-4.1-2.5z" opacity={0.9} />
    <Path d="M6.2 15.2c1.9-3.6 5-6.5 8.8-7.3 1.5-.3 2.7.4 2.7 1.8 0 2.9-3.7 5.7-8.2 6.5-1.8.3-3.6-.1-3.3-1z" />
  </Solid>
)
export const OilIcon = (p: IconProps) => (
  <Solid {...p}>
    {/* dragged oil-paint streak with bristle lines */}
    <Path d="M3.5 15c2-4.4 6-8.3 10.8-9.3 2.6-.5 5 .7 5.6 2.8.6 2.4-1 4.6-3.6 5.8-3.9 1.8-8.6 2.3-12.8 2.6-.7 0-1.3-1.1-1-1.9z" opacity={0.92} />
    <Path d="M5 13.4c2.6-.2 5.2-.5 7.6-1.2M6 15c2.4-.2 4.8-.6 7-1.4M5.6 11.6c2.2-.5 4.4-1.2 6.4-2.2" stroke="#000" strokeWidth={0.7} strokeOpacity={0.25} fill="none" strokeLinecap="round" />
  </Solid>
)
export const BucketIcon = (p: IconProps) => (
  <Solid {...p}>
    {/* paint bucket */}
    <Path d="M5 9h14l-1.4 9.3a2 2 0 0 1-2 1.7H8.4a2 2 0 0 1-2-1.7L5 9z" />
    <Path d="M5.2 9 12 2.6 18.8 9" fill="none" stroke={p.color ?? '#000'} strokeWidth={1.6} strokeLinejoin="round" />
    <Circle cx={12} cy={5} r={1.3} />
  </Solid>
)

// ── Action glyphs (stroke) ───────────────────────────────────────────────────
export const UndoIcon = (p: IconProps) => (<Stroke {...p}><Path d="M9 14L4 9l5-5" /><Path d="M4 9h10a6 6 0 010 12H9" /></Stroke>)
export const RedoIcon = (p: IconProps) => (<Stroke {...p}><Path d="M15 14l5-5-5-5" /><Path d="M20 9H10a6 6 0 000 12h5" /></Stroke>)
export const TrashIcon = (p: IconProps) => (<Stroke {...p}><Path d="M4 7h16" /><Path d="M10 11v6M14 11v6" /><Path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" /><Path d="M9 7V4h6v3" /></Stroke>)
export const SendIcon = (p: IconProps) => (<Stroke {...p}><Path d="M3 11L21 4l-7 18-3-8z" /><Path d="M11 14l4-4" /></Stroke>)
export const PlusIcon = (p: IconProps) => (<Stroke {...p}><Path d="M12 5v14M5 12h14" /></Stroke>)
export const EyeIcon = (p: IconProps) => (<Stroke {...p}><Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><Circle cx="12" cy="12" r="3" /></Stroke>)
export const EyeOffIcon = (p: IconProps) => (<Stroke {...p}><Path d="M3 3l18 18" /><Path d="M10.6 6.2C11 6.1 11.5 6 12 6c6.5 0 10 6 10 6a17 17 0 01-3.4 3.9" /><Path d="M6.2 6.4A17 17 0 002 12s3.5 7 10 7a10 10 0 005-1.3" /><Path d="M9.9 9.9a3 3 0 104.2 4.2" /></Stroke>)
export const MergeDownIcon = (p: IconProps) => (<Stroke {...p}><Path d="M12 3v10" /><Path d="M8 9l4 4 4-4" /><Path d="M4 18h16" /></Stroke>)
export const ChevronDownIcon = (p: IconProps) => (<Stroke {...p}><Path d="M6 9l6 6 6-6" /></Stroke>)
export const LayersIcon = (p: IconProps) => (<Stroke {...p}><Path d="M12 3l9 5-9 5-9-5 9-5z" /><Path d="M3 13l9 5 9-5" /></Stroke>)
export const CloseIcon = (p: IconProps) => (<Stroke {...p}><Path d="M6 6l12 12M18 6L6 18" /></Stroke>)
// Tool-toggle glyphs (stroke) — pressure / wet paint / build-up, ported from web.
export const PressureIcon = (p: IconProps) => (<Stroke {...p}><Path d="M5 19c2-6 6-9 14-9" /><Path d="M15 7l4 3-3 4" /></Stroke>)
export const WetIcon = (p: IconProps) => (<Stroke {...p}><Path d="M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z" /></Stroke>)
export const BuildUpIcon = (p: IconProps) => (
  <Svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill={p.color ?? '#000'} stroke="none">
    <Rect x={3} y={15} width={18} height={5} rx={1} opacity={0.45} />
    <Rect x={5} y={10} width={14} height={5} rx={1} opacity={0.7} />
    <Rect x={7} y={5} width={10} height={5} rx={1} />
  </Svg>
)
// Zoom glyphs (stroke) — used by the canvas zoom controls.
export const ZoomInIcon = (p: IconProps) => (<Stroke {...p}><Circle cx={11} cy={11} r={7} /><Path d="M21 21l-4.3-4.3" /><Path d="M11 8v6M8 11h6" /></Stroke>)
export const ZoomOutIcon = (p: IconProps) => (<Stroke {...p}><Circle cx={11} cy={11} r={7} /><Path d="M21 21l-4.3-4.3" /><Path d="M8 11h6" /></Stroke>)
export const FitIcon = (p: IconProps) => (<Stroke {...p}><Path d="M4 9V5a1 1 0 011-1h4" /><Path d="M20 9V5a1 1 0 00-1-1h-4" /><Path d="M4 15v4a1 1 0 001 1h4" /><Path d="M20 15v4a1 1 0 01-1 1h-4" /></Stroke>)
// Mosaic grid — "view the whole mosaic while drawing".
export const GridIcon = (p: IconProps) => (<Stroke {...p}><Rect x={3} y={3} width={18} height={18} rx={2} /><Path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></Stroke>)
// Eyedropper — sample a colour from the canvas.
export const EyedropperIcon = (p: IconProps) => (<Stroke {...p}><Path d="M19 5a2 2 0 0 0-2.8 0l-1.6 1.6-1-1-1.4 1.4 1 1L4 17.2V20h2.8l8.2-8.2 1 1 1.4-1.4-1-1L19 7.8A2 2 0 0 0 19 5z" /></Stroke>)
export const PlusSmallIcon = (p: IconProps) => (<Stroke {...p}><Circle cx={12} cy={12} r={9} /><Path d="M12 8v8M8 12h8" /></Stroke>)

/** Tool → glyph, in the web's TOOL_LIST order. */
export const TOOL_ICON: Record<ToolId, (p: IconProps) => React.ReactElement> = {
  brush: BrushIcon,
  profibrush: ProfiBrushIcon,
  drybrush: DryBrushIcon,
  inkbrush: InkBrushIcon,
  pencil: PencilIcon,
  pen: PenIcon,
  marker: MarkerIcon,
  watercolor: WatercolorIcon,
  spray: SprayIcon,
  eraser: EraserIcon,
  smudge: SmudgeIcon,
  waterdrop: WaterdropIcon,
  impasto: ImpastoIcon,
  oil: OilIcon,
  bucket: BucketIcon,
}
