import { useEffect, useRef, useState } from 'react'
import { Button, Separator, Tooltip } from '@heroui/react'
import { ToolId, ToolSettings, ToolSettingsMap } from '../../types'
import {
  BrushIcon, PencilIcon, PenIcon, MarkerIcon, WatercolorIcon, SprayIcon, EraserIcon, SmudgeIcon,
  WaterdropIcon, DryBrushIcon, InkBrushIcon, UndoIcon, RedoIcon, TrashIcon, RevealIcon, CloseIcon,
  ChevronDownIcon,
} from '../icons'

interface Props {
  tool: ToolId
  settingsMap: ToolSettingsMap

  popoverOpen: boolean
  popoverContent: React.ReactNode
  onToolButtonClick: (id: ToolId) => void
  onPopoverOutsideClose: () => void

  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onReveal: () => void

  allowedTools?: ToolId[]
}

const TOOL_LIST: { id: ToolId; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { id: 'brush',      label: 'Brush',      Icon: BrushIcon },
  { id: 'drybrush',   label: 'Dry Brush',  Icon: DryBrushIcon },
  { id: 'inkbrush',   label: 'Ink Brush',  Icon: InkBrushIcon },
  { id: 'pencil',     label: 'Pencil',     Icon: PencilIcon },
  { id: 'pen',        label: 'Ink Pen',    Icon: PenIcon },
  { id: 'marker',     label: 'Marker',     Icon: MarkerIcon },
  { id: 'watercolor', label: 'Watercolor', Icon: WatercolorIcon },
  { id: 'spray',      label: 'Spray',      Icon: SprayIcon },
  { id: 'eraser',     label: 'Eraser',     Icon: EraserIcon },
  { id: 'smudge',     label: 'Smudge',     Icon: SmudgeIcon },
  { id: 'waterdrop',  label: 'Waterdrop',  Icon: WaterdropIcon },
]

export function BottomToolbar({
  tool, settingsMap,
  popoverOpen, popoverContent, onToolButtonClick, onPopoverOutsideClose,
  canUndo, canRedo, onUndo, onRedo, onClear, onReveal,
  allowedTools,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const visibleTools = allowedTools && allowedTools.length > 0
    ? TOOL_LIST.filter((t) => allowedTools.includes(t.id))
    : TOOL_LIST

  // Collapse the inline tool row into a single selector when the viewport is
  // too narrow to hold every tool + the action buttons + the zoom bar.
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const compute = () => {
      const toolsW  = visibleTools.length * 60          // ~56px button + gap
      const fixedW  = 4 * 60 + 2 * 24 + 190 + 64        // actions + separators + zoom + margins
      setCollapsed(window.innerWidth < toolsW + fixedW)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [visibleTools.length])

  const activeMeta = TOOL_LIST.find((t) => t.id === tool) ?? visibleTools[0]

  useEffect(() => {
    if (!popoverOpen) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const wrap = wrapRef.current
      if (!wrap) return
      if (!wrap.contains(e.target as Node)) onPopoverOutsideClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [popoverOpen, onPopoverOutsideClose])

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none flex flex-col items-center gap-2 max-w-[calc(100vw-1.5rem)]"
    >
      {popoverOpen && popoverContent && (
        <div
          className="pointer-events-auto w-[min(78vw,340px)] max-h-[calc(100vh-7rem)] flex flex-col rounded-[24px] shadow-lg backdrop-blur bg-[var(--surface)]/95 text-[var(--foreground)]"
          role="dialog"
          aria-label="Settings popover"
        >
          {/* Tool grid — only in collapsed mode, so users can switch tools from
              inside the settings popover when the inline row is hidden. */}
          {collapsed && (
            <div className="px-4 pt-4">
              <div className="grid grid-cols-5 gap-1.5">
                {visibleTools.map((t) => {
                  const sel = t.id === tool
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { if (t.id !== tool) onToolButtonClick(t.id) }}
                      aria-pressed={sel}
                      title={t.label}
                      className={[
                        'aspect-square rounded-xl flex items-center justify-center transition active:scale-95',
                        sel
                          ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                          : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] text-[var(--foreground)]',
                      ].join(' ')}
                    >
                      <t.Icon className="size-6" />
                    </button>
                  )
                })}
              </div>
              <Separator className="mt-4" />
            </div>
          )}
          <div className="flex items-center justify-between px-5 pt-5 pb-1 shrink-0">
            <span className="font-mono text-[10px] text-[var(--muted)] select-none">
              Tap outside to close
            </span>
            <button
              type="button"
              onClick={onPopoverOutsideClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-secondary)] active:scale-90 transition-transform"
              aria-label="Close settings"
            >
              <CloseIcon width={18} height={18} />
            </button>
          </div>
          <div
            className="px-5 pb-5 overflow-y-auto drawie-hide-scrollbar overscroll-contain"
            style={{
              scrollBehavior: 'auto',
              // Disable scroll-anchoring + bake in scroll-padding so the
              // browser's "scroll focused element into view" doesn't jerk
              // the popover when a Switch / Slider gains focus near edges.
              overflowAnchor: 'none',
              scrollPaddingBlock: '120px',
            }}
          >
            {popoverContent}
          </div>
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-1.5 p-2 rounded-[1.75rem] shadow-lg backdrop-blur bg-[var(--surface)]/95">
        {collapsed ? (
          <ToolSelectButton
            meta={activeMeta}
            settings={settingsMap[tool]}
            active={popoverOpen}
            onClick={() => onToolButtonClick(tool)}
          />
        ) : (
          visibleTools.map((t) => (
            <ToolButton
              key={t.id}
              id={t.id}
              label={t.label}
              Icon={t.Icon}
              active={tool === t.id}
              settings={settingsMap[t.id]}
              onClick={() => onToolButtonClick(t.id)}
            />
          ))
        )}

        <Separator orientation="vertical" className="h-10 mx-1" />

        <ToolbarActionButton label="Undo" Icon={UndoIcon} onClick={onUndo} disabled={!canUndo} />
        <ToolbarActionButton label="Redo" Icon={RedoIcon} onClick={onRedo} disabled={!canRedo} />
        <ToolbarActionButton label="Clear active layer" Icon={TrashIcon} onClick={onClear} tone="danger" />

        <Separator orientation="vertical" className="h-10 mx-1" />

        <ToolbarActionButton label="Reveal Mosaic" Icon={RevealIcon} onClick={onReveal} tone="accent" />
      </div>
    </div>
  )
}

function ToolButton({
  id, label, Icon, active, settings, onClick,
}: {
  id: ToolId
  label: string
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  active: boolean
  settings: ToolSettings
  onClick: () => void
}) {
  const isTransparentDrop = id === 'waterdrop' && settings.color === 'transparent'
  const showsColor = id !== 'eraser' && id !== 'smudge' && !isTransparentDrop
  const dotPx = Math.round(6 + (Math.min(120, settings.size) / 120) * 8)

  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Button
          isIconOnly
          onPress={onClick}
          aria-label={label}
          aria-pressed={active}
          variant={active ? 'primary' : 'secondary'}
          className="relative w-14 h-14"
        >
          {/* size-8 (utilities layer) overrides HeroUI's default `& svg { size-5 }` */}
          <Icon className="size-8" />
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-[var(--surface)]"
            style={{
              width: dotPx + 4,
              height: dotPx + 4,
              background: showsColor
                ? settings.color
                : isTransparentDrop
                  ? 'repeating-conic-gradient(#d1d5db 0% 25%, #f9fafb 0% 50%) 0 0 / 6px 6px'
                  : 'repeating-linear-gradient(45deg, #cbd5e1 0 2px, #f1f5f9 2px 4px)',
            }}
          />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  )
}

/** Collapsed-mode trigger: shows the current tool + a chevron, opens the
 *  settings popover (which carries the tool grid). */
function ToolSelectButton({
  meta, settings, active, onClick,
}: {
  meta: { id: ToolId; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }
  settings: ToolSettings
  active: boolean
  onClick: () => void
}) {
  const Icon = meta.Icon
  const isTransparentDrop = meta.id === 'waterdrop' && settings.color === 'transparent'
  const showsColor = meta.id !== 'eraser' && meta.id !== 'smudge' && !isTransparentDrop
  return (
    <Button
      onPress={onClick}
      aria-label={`Tool: ${meta.label}`}
      aria-pressed={active}
      variant={active ? 'primary' : 'secondary'}
      className="relative h-14 pl-3 pr-2.5 gap-1.5 rounded-2xl"
    >
      <Icon className="size-7" />
      <span className="text-sm font-bold hidden min-[420px]:inline">{meta.label}</span>
      <ChevronDownIcon className={['size-4 opacity-60 transition-transform', active ? 'rotate-180' : ''].join(' ')} />
      <span
        aria-hidden
        className="absolute bottom-1 left-1 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--surface)]"
        style={{
          background: showsColor
            ? settings.color
            : 'repeating-conic-gradient(#d1d5db 0% 25%, #f9fafb 0% 50%) 0 0 / 5px 5px',
        }}
      />
    </Button>
  )
}

function ToolbarActionButton({
  label, Icon, onClick, disabled, tone = 'default',
}: {
  label: string
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger' | 'accent'
}) {
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Button
          isIconOnly
          onPress={onClick}
          isDisabled={disabled}
          aria-label={label}
          variant={tone === 'accent' ? 'primary' : tone === 'danger' ? 'danger-soft' : 'secondary'}
          className="w-14 h-14"
        >
          <Icon width={26} height={26} />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  )
}
