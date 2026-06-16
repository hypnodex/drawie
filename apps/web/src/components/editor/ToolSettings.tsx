import { useEffect, useRef } from 'react'
import { BRUSH_TEXTURES, BrushShape, BrushTexture, ToolId, ToolSettings as ToolSettingsType } from '@drawie/core'
import { ColorPicker } from './ColorPicker'
import { PressureIcon, WetIcon, BuildUpIcon } from '../icons'
import { getTextureCanvas } from '@drawie/renderer'

interface Props {
  tool: ToolId
  settings: ToolSettingsType
  recentColors: string[]
  secondaryColor: string
  onSecondaryChange: (c: string) => void
  onSwapColors: () => void
  onChange: (patch: Partial<ToolSettingsType>) => void
  paletteOverride?: string[] | null
}

interface ToolMeta {
  name: string
  subtitle: string
  usesColor: boolean
  usesPressure: boolean
  usesWet: boolean
  usesSoftness: boolean
  usesStrength: boolean
  usesHardness: boolean
  usesShape: boolean
  usesBlending: boolean
  usesDilution: boolean
  usesBuildUp: boolean
  usesTexture: boolean
}

const TOOL_META: Record<ToolId, ToolMeta> = {
  brush:      { name: 'Brush',      subtitle: 'Soft round, painterly',     usesColor: true,  usesPressure: true,  usesWet: true,  usesSoftness: false, usesStrength: false, usesHardness: true,  usesShape: true,  usesBlending: true,  usesDilution: true,  usesBuildUp: true,  usesTexture: true  },
  drybrush:   { name: 'Dry Brush',  subtitle: 'Bristle streaks, broken edges', usesColor: true, usesPressure: true, usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  inkbrush:   { name: 'Ink Brush',  subtitle: 'Heavy dry-bristle ink',     usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  pencil:     { name: 'Pencil',     subtitle: 'Thin textured stroke',      usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: false, usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  pen:        { name: 'Ink Pen',    subtitle: 'Crisp sharp line',          usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: false, usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  marker:     { name: 'Marker',     subtitle: 'Wide semi-transparent',     usesColor: true,  usesPressure: true,  usesWet: true,  usesSoftness: false, usesStrength: false, usesHardness: true,  usesShape: true,  usesBlending: true,  usesDilution: true,  usesBuildUp: true,  usesTexture: true  },
  watercolor: { name: 'Watercolor', subtitle: 'Pools where you dwell',     usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: false, usesHardness: true,  usesShape: true,  usesBlending: true,  usesDilution: true,  usesBuildUp: true,  usesTexture: false },
  spray:      { name: 'Spray',      subtitle: 'Airbrush — scattered particles', usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  eraser:     { name: 'Eraser',     subtitle: 'Remove from active tile',   usesColor: false, usesPressure: false, usesWet: false, usesSoftness: true,  usesStrength: false, usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  smudge:     { name: 'Smudge',     subtitle: 'Smear nearby pixels',       usesColor: false, usesPressure: false, usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  waterdrop:  { name: 'Waterdrop',  subtitle: 'Spread wet colors outward', usesColor: true,  usesPressure: false, usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  impasto:    { name: 'Impasto',    subtitle: 'Thick raised paint, with depth', usesColor: true, usesPressure: true, usesWet: false, usesSoftness: false, usesStrength: false, usesHardness: false, usesShape: true,  usesBlending: false, usesDilution: true,  usesBuildUp: false, usesTexture: false },
  oil:        { name: 'Oil Paint',  subtitle: 'Thick bristled paint with sheen', usesColor: true, usesPressure: true, usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: true,  usesBuildUp: false, usesTexture: false },
  bucket:     { name: 'Fill',       subtitle: 'Flood the whole layer with colour', usesColor: true, usesPressure: false, usesWet: false, usesSoftness: false, usesStrength: false, usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
}

export function ToolSettingsPanel({
  tool, settings, recentColors, secondaryColor, onSecondaryChange, onSwapColors, onChange,
  paletteOverride,
}: Props) {
  const meta = TOOL_META[tool]

  return (
    <div className="flex flex-col gap-4">
      <header>
        <div className="font-mono text-[10px] text-[var(--muted)]">Tool</div>
        <h2 className="text-base font-semibold text-[var(--foreground)]">{meta.name}</h2>
        <p className="text-xs text-[var(--muted)] mt-0.5">{meta.subtitle}</p>
      </header>

      {meta.usesColor && (
        <Section title={tool === 'waterdrop' ? 'Ink color' : 'Color'}>
          {tool === 'waterdrop' && (
            <div className="flex items-center gap-2.5 mb-3">
              {/* Transparent / water-only swatch */}
              <button
                type="button"
                onClick={() => onChange({ color: 'transparent' })}
                title="Water only — no ink"
                aria-label="Water only"
                aria-pressed={settings.color === 'transparent'}
                className={[
                  'w-9 h-9 rounded-full overflow-hidden shrink-0 transition',
                  settings.color === 'transparent'
                    ? 'ring-2 ring-[var(--accent)]'
                    : 'ring-1 ring-[var(--separator)] hover:ring-[var(--muted)]',
                ].join(' ')}
              >
                <span
                  className="block w-full h-full"
                  style={{ background: 'repeating-conic-gradient(#d1d5db 0% 25%, #f9fafb 0% 50%) 0 0 / 8px 8px' }}
                />
              </button>
              <span className="text-xs text-[var(--muted)] leading-snug">
                {settings.color === 'transparent'
                  ? <>Water only<br /><span className="text-[var(--muted)] opacity-60">no ink added</span></>
                  : <>Ink selected<br /><span className="font-mono opacity-60">{settings.color.toUpperCase()}</span></>
                }
              </span>
            </div>
          )}
          <ColorPicker
            value={settings.color === 'transparent' ? '#74c2f0' : settings.color}
            onChange={(c) => onChange({ color: c })}
            recent={recentColors}
            secondary={tool !== 'waterdrop' ? secondaryColor : undefined}
            onSecondaryChange={tool !== 'waterdrop' ? onSecondaryChange : undefined}
            onSwap={tool !== 'waterdrop' ? onSwapColors : undefined}
            paletteOverride={paletteOverride}
          />
        </Section>
      )}

      {tool !== 'bucket' && (
        <Section title="Size">
          <Slider min={1} max={120} step={1} value={settings.size} onChange={(v) => onChange({ size: v })} suffix="px" />
          <BrushPreview tool={tool} settings={settings} />
        </Section>
      )}

      {tool !== 'eraser' && tool !== 'smudge'
        && !(tool === 'waterdrop' && settings.color === 'transparent') && (
        <Section title="Opacity">
          <Slider min={0.05} max={1} step={0.01} value={settings.opacity}
                  onChange={(v) => onChange({ opacity: v })}
                  display={(v) => `${Math.round(v * 100)}%`} />
        </Section>
      )}

      {meta.usesHardness && (
        <Section title="Hardness">
          <Slider min={0} max={1} step={0.01} value={settings.hardness}
                  onChange={(v) => onChange({ hardness: v })}
                  display={(v) => `${Math.round(v * 100)}%`} />
        </Section>
      )}

      {meta.usesShape && (
        <Section title="Brush Shape">
          <ShapePicker value={settings.shape} onChange={(s) => onChange({ shape: s })} />
        </Section>
      )}

      {meta.usesTexture && (
        <Section title="Texture">
          <TexturePicker value={settings.texture} color={settings.color} onChange={(t) => onChange({ texture: t })} />
        </Section>
      )}

      {meta.usesBlending && (
        <Section title="Blending">
          <Slider min={0} max={1} step={0.01} value={settings.blending}
                  onChange={(v) => onChange({ blending: v })}
                  display={(v) => `${Math.round(v * 100)}%`} />
          <Hint>Pull nearby paint into the stamp (wet-on-wet).</Hint>
        </Section>
      )}

      {meta.usesDilution && (
        <>
          <Section title="Dilution">
            <Slider min={0} max={1} step={0.01} value={settings.dilution}
                    onChange={(v) => onChange({ dilution: v })}
                    display={(v) => `${Math.round(v * 100)}%`} />
          </Section>
          <Section title="Persistence">
            <Slider min={0} max={1} step={0.01} value={settings.persistence}
                    onChange={(v) => onChange({ persistence: v })}
                    display={(v) => `${Math.round(v * 100)}%`} />
            <Hint>Paint runs out over the stroke; higher persistence lasts longer.</Hint>
          </Section>
        </>
      )}

      {meta.usesSoftness && (
        <Section title="Softness">
          <Slider min={0} max={1} step={0.01} value={settings.softness}
                  onChange={(v) => onChange({ softness: v })}
                  display={(v) => `${Math.round(v * 100)}%`} />
        </Section>
      )}

      {meta.usesStrength && (
        <Section title={tool === 'spray' ? 'Density' : (tool === 'drybrush' || tool === 'inkbrush') ? 'Dryness' : 'Strength'}>
          <Slider min={0.05} max={1} step={0.01} value={settings.strength}
                  onChange={(v) => onChange({ strength: v })}
                  display={(v) => `${Math.round(v * 100)}%`} />
        </Section>
      )}

      {(meta.usesPressure || meta.usesWet || meta.usesBuildUp) && (
        <div className="flex flex-col gap-2">
          {meta.usesPressure && (
            <ToggleRow label="Pressure" hint="Vary width & opacity with pressure / stroke speed"
                       checked={settings.pressureSim} onChange={(v) => onChange({ pressureSim: v })} Icon={PressureIcon} />
          )}
          {meta.usesWet && (
            <ToggleRow label="Wet paint" hint="Softer, bleeding edges"
                       checked={settings.wetPaint} onChange={(v) => onChange({ wetPaint: v })} Icon={WetIcon} />
          )}
          {meta.usesBuildUp && (
            <ToggleRow label="Build-up" hint="Once saturated, repeated passes darken the color"
                       checked={settings.buildUp} onChange={(v) => onChange({ buildUp: v })} Icon={BuildUpIcon} />
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-[10px] text-[var(--muted)]">{title}</div>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] text-[var(--muted)] leading-snug">{children}</div>
}

function Slider({
  min, max, step, value, onChange, suffix, display,
}: {
  min: number; max: number; step: number; value: number
  onChange: (v: number) => void
  suffix?: string
  display?: (v: number) => string
}) {
  const label = display ? display(value) : `${value}${suffix ?? ''}`
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="drawie-range flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="w-12 text-right text-xs font-mono text-[var(--muted)]">{label}</span>
    </div>
  )
}

function ToggleRow({
  label, hint, checked, onChange, Icon,
}: {
  label: string; hint: string; checked: boolean
  onChange: (v: boolean) => void
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}) {
  // Note: the whole row IS the toggle. We deliberately do NOT use HeroUI's
  // <Switch> here because its internal react-aria checkbox triggers the
  // browser's "scroll focused element into view" behaviour, which made the
  // popover jump up every time you clicked Build-up at the bottom of the
  // settings panel. A plain button with role="switch" gets the same a11y
  // semantics without the focus-scroll side effect.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => onChange(!checked)}
      className={[
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left w-full',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        checked
          ? 'bg-[color-mix(in_oklab,var(--accent)_10%,var(--surface-secondary))] text-[var(--foreground)]'
          : 'bg-[var(--surface-secondary)] text-[var(--muted)]',
      ].join(' ')}
    >
      <span className={['flex items-center justify-center w-9 h-9 rounded-lg shrink-0',
        checked ? 'bg-[color-mix(in_oklab,var(--accent)_20%,var(--surface-secondary))] text-[var(--accent)]' : 'bg-[var(--surface-tertiary)] text-[var(--muted)]'].join(' ')}>
        <Icon width={18} height={18} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-[var(--muted)] truncate">{hint}</div>
      </div>
      <span
        aria-hidden
        className={[
          'relative inline-block w-12 h-7 rounded-full transition-colors shrink-0',
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-tertiary)]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 w-6 h-6 rounded-full bg-[var(--surface)] shadow transition-all duration-200',
            checked ? 'left-5' : 'left-0.5',
          ].join(' ')}
        />
      </span>
    </button>
  )
}

function ShapePicker({ value, onChange }: { value: BrushShape; onChange: (s: BrushShape) => void }) {
  const items: { id: BrushShape; label: string; render: (active: boolean) => React.ReactNode }[] = [
    {
      id: 'circle', label: 'Circle',
      render: (a) => <div className={['w-5 h-5 rounded-full', a ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'].join(' ')} />,
    },
    {
      id: 'square', label: 'Square',
      render: (a) => <div className={['w-5 h-5', a ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'].join(' ')} />,
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((s) => {
        const active = value === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={[
              'flex items-center gap-2 px-3 py-2 rounded-lg transition',
              active
                ? 'bg-[color-mix(in_oklab,var(--accent)_15%,var(--surface-secondary))] text-[var(--foreground)] ring-1 ring-[var(--accent)]'
                : 'bg-[var(--surface-secondary)] text-[var(--muted)] hover:bg-[var(--surface-tertiary)]',
            ].join(' ')}
            aria-pressed={active}
          >
            {s.render(active)}
            <span className="text-xs">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function TexturePicker({
  value, color, onChange,
}: {
  value: BrushTexture
  color: string
  onChange: (t: BrushTexture) => void
}) {
  const LABELS: Record<BrushTexture, string> = {
    none: 'None', canvas: 'Canvas', grain: 'Grain', noise: 'Noise', speckle: 'Speckle',
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {BRUSH_TEXTURES.map((t) => {
        const active = value === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            aria-pressed={active}
            className={[
              'flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition',
              active
                ? 'bg-[color-mix(in_oklab,var(--accent)_15%,var(--surface-secondary))] text-[var(--foreground)] ring-1 ring-[var(--accent)]'
                : 'bg-[var(--surface-secondary)] text-[var(--muted)] hover:bg-[var(--surface-tertiary)]',
            ].join(' ')}
          >
            <TexturePreview texture={t} color={color} />
            <span className="text-[10px]">{LABELS[t]}</span>
          </button>
        )
      })}
    </div>
  )
}

function TexturePreview({ texture, color }: { texture: BrushTexture; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const size = 36
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, size, size)
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2 - 1)
    grad.addColorStop(0, color)
    grad.addColorStop(0.7, color)
    grad.addColorStop(1, color + '00')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2)
    ctx.fill()
    if (texture !== 'none') {
      const tex = getTextureCanvas(texture)
      if (tex) {
        const pat = ctx.createPattern(tex, 'repeat')
        if (pat) {
          ctx.globalCompositeOperation = 'destination-in'
          ctx.fillStyle = pat
          ctx.fillRect(0, 0, size, size)
          ctx.globalCompositeOperation = 'source-over'
        }
      }
    }
  }, [texture, color])
  return <canvas ref={ref} className="rounded-md" style={{ width: 36, height: 36 }} />
}

function BrushPreview({ tool, settings }: { tool: ToolId; settings: ToolSettingsType }) {
  return (
    <div className="relative h-10 rounded-lg bg-[var(--surface)] overflow-hidden">
      <svg viewBox="0 0 200 40" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g-${tool}`} x1="0%" x2="100%">
            <stop offset="0%"   stopColor={settings.color} stopOpacity="0" />
            <stop offset="50%"  stopColor={settings.color} stopOpacity={tool === 'marker' ? 0.4 : 1} />
            <stop offset="100%" stopColor={settings.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M5 20 Q 50 5, 100 20 T 195 20"
          fill="none"
          stroke={
            tool === 'eraser' || tool === 'smudge' ? '#cfd2d8'
            : tool === 'waterdrop'
              ? (settings.color === 'transparent' ? '#74c2f0' : settings.color)
              : `url(#g-${tool})`
          }
          strokeWidth={Math.min(28, Math.max(1, settings.size * 0.32))}
          strokeLinecap={settings.shape === 'square' ? 'butt' : 'round'}
          strokeLinejoin={settings.shape === 'square' ? 'miter' : 'round'}
          opacity={tool === 'eraser' || tool === 'smudge' ? 0.5 : tool === 'waterdrop' ? 0.7 : settings.opacity}
          strokeDasharray={tool === 'pencil' ? '1 2' : undefined}
        />
        {tool === 'watercolor' && (
          <circle cx="160" cy="20" r={Math.min(16, Math.max(3, settings.size * 0.22))}
                  fill={settings.color} opacity={Math.min(0.9, settings.opacity * 0.7)} />
        )}
      </svg>
    </div>
  )
}
