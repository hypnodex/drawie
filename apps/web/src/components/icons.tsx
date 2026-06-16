import { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

/** Solid (filled, no-stroke) base — used by the drawing-tool glyphs. */
const solid = (p: SVGProps<SVGSVGElement>) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  stroke: 'none' as const,
  ...p,
})

export const BrushIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M20.9 3.1a2.2 2.2 0 0 0-3.1 0l-6.6 6.6 3.1 3.1 6.6-6.6a2.2 2.2 0 0 0 0-3.1z" />
    <path d="M9.7 11.1c-1.6-.3-3.2.2-4.4 1.4-1.5 1.5-1.6 4.6-2.3 6.4-.2.6.4 1.2 1 1 1.8-.7 4.9-.8 6.4-2.3 1.2-1.2 1.7-2.8 1.4-4.4l-2.1-2.1z" />
  </svg>
)

export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M3 21l1-4.2L14.8 6 18 9.2 7.2 20 3 21z" />
    <path d="M16.2 4.6l1.1-1.1a1.7 1.7 0 0 1 2.4 0l.8.8a1.7 1.7 0 0 1 0 2.4l-1.1 1.1-3.2-3.2z" />
  </svg>
)

export const PenIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M19.8 4.2a2 2 0 0 0-2.8 0l-1.3 1.3 2.8 2.8 1.3-1.3a2 2 0 0 0 0-2.8z" />
    <path d="M14.4 6.8 5 16.2l-1.9 4.9a.5.5 0 0 0 .6.6l4.9-1.9 9.4-9.4-3.6-3.6zm-7.8 11.8-1.2-1.2.7-2 2.5 2.5-2 .7z" fillRule="evenodd" clipRule="evenodd" />
  </svg>
)

export const MarkerIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M16.9 3.5l3.6 3.6a1 1 0 0 1 0 1.4l-2 2-5-5 2-2a1 1 0 0 1 1.4 0z" />
    <path d="M12.1 6.2l5.7 5.7-6.5 6.5-1 .3-3.4.9a.6.6 0 0 1-.7-.7l.9-3.4.3-1 4.7-8.3z" />
  </svg>
)

export const EraserIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M8.7 20.4 3.6 15.3a2 2 0 0 1 0-2.8L12.7 3.4a2 2 0 0 1 2.8 0l4.9 4.9a2 2 0 0 1 0 2.8l-9 9H8.7z" />
    <rect x="3" y="20.2" width="18" height="1.8" rx="0.9" />
  </svg>
)

export const WatercolorIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)} fillRule="evenodd" clipRule="evenodd">
    <path d="M12 2.7c3.1 4.1 6.3 7.5 6.3 11.3a6.3 6.3 0 1 1-12.6 0C5.7 10.2 8.9 6.8 12 2.7zm0 8.6a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z" />
  </svg>
)

export const SprayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M13.5 7H18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
    <path d="M14 2.8h3.2v3.2H14z" />
    <circle cx="6" cy="8" r="1" />
    <circle cx="3.6" cy="11" r="1" />
    <circle cx="6.8" cy="12.2" r="1" />
    <circle cx="4" cy="15" r="1" />
    <circle cx="6.4" cy="16.6" r="0.9" />
  </svg>
)

export const SmudgeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M3.5 13.2c.3-3 4.2-4.2 6.8-2.6 2 1.2 4 1.2 5.4-.2 1-1 1-2.6 2.3-2.9 1.6-.3 2.8 1.3 2.3 2.8-1 3.3-4.8 4.9-8 3.6-1.9-.8-3.6-.6-4.4.8-.7 1.2-2.6.9-2.6-.5 0-.5.1-1 .2-1z" />
  </svg>
)

export const UndoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 010 12H9" />
  </svg>
)

export const RedoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H10a6 6 0 000 12h5" />
  </svg>
)

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" />
    <path d="M9 7V4h6v3" />
  </svg>
)

export const RevealIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

export const PressureIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 19c2-6 6-9 14-9" />
    <path d="M15 7l4 3-3 4" />
  </svg>
)

export const WetIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z" />
  </svg>
)

export const BuildUpIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="15" width="18" height="5" rx="1" opacity="0.45" />
    <rect x="5" y="10" width="14" height="5" rx="1" opacity="0.7" />
    <rect x="7" y="5"  width="10" height="5" rx="1" />
  </svg>
)

export const EyeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const EyeOffIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.2C11 6.1 11.5 6 12 6c6.5 0 10 6 10 6a17 17 0 01-3.4 3.9" />
    <path d="M6.2 6.4A17 17 0 002 12s3.5 7 10 7a10 10 0 005-1.3" />
    <path d="M9.9 9.9a3 3 0 104.2 4.2" />
  </svg>
)

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const LayersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 17l9 5 9-5" opacity="0.6" />
  </svg>
)

export const MergeDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v10" />
    <path d="M8 9l4 4 4-4" />
    <path d="M4 18h16" />
  </svg>
)

export const SunIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
  </svg>
)

export const MoonIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M21 12.8A8 8 0 1111.2 3a6 6 0 009.8 9.8z" />
  </svg>
)

export const WandIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 21l9-9" />
    <path d="M12 12l6-6 3 3-6 6z" />
    <path d="M16 4l1.5-1.5M18 2v1.5M21 5h-1.5M20.5 7.5L19 6" />
  </svg>
)

export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export const ClockIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const SaveIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M7 4v5h9V4" />
    <rect x="8" y="13" width="8" height="5" />
  </svg>
)

export const SendIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 11L21 4l-7 18-3-8z" />
    <path d="M11 14l4-4" />
  </svg>
)

export const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
)

export const CheckCircleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l3 3 5-6" />
  </svg>
)

export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M7 5l12 7-12 7z" fill="currentColor" />
  </svg>
)

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const DryBrushIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M18.4 2.9a2 2 0 0 1 2.7 2.7l-6.2 6.2-2.7-2.7 6.2-6.2z" />
    {/* split / forked dry bristle head */}
    <path d="M11.5 10.1l2.4 2.4-4.6 4.6c-.5.5-1.2.7-1.9.5l1-2.6-2.6 1c-.2-.7 0-1.4.5-1.9l4.6-4.6z" />
  </svg>
)

export const InkBrushIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M16 2.8l5.2 5.2-2.4 1.1-3.9-3.9L16 2.8z" />
    {/* broad ink head tapering to a dry point */}
    <path d="M14.3 6.4 17.6 9.7 8.4 18.9c-1.4 1.4-4.9 2.6-4.9 2.6s1.2-3.5 2.6-4.9l8.2-9.2z" />
  </svg>
)

export const WaterdropIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M12 3.2C8.7 7.8 6.3 10.9 6.3 14.1a5.7 5.7 0 0 0 11.4 0C17.7 10.9 15.3 7.8 12 3.2z" />
  </svg>
)
export const ImpastoIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...solid(p)}>
    <path d="M4.5 16.8c2.2-5 6.4-9.2 11.2-10.1 2.3-.4 4.3.9 4.3 3 0 4.3-5.2 8.5-11.4 9.6-2.5.4-4.8-.4-4.1-2.5z" opacity={0.9} />
    <path d="M6.2 15.2c1.9-3.6 5-6.5 8.8-7.3 1.5-.3 2.7.4 2.7 1.8 0 2.9-3.7 5.7-8.2 6.5-1.8.3-3.6-.1-3.3-1z" />
  </svg>
)
