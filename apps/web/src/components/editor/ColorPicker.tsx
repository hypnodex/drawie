import { useEffect, useState } from 'react'
import { Input } from '@heroui/react'

const PRESET_PALETTE = [
  '#0a0b0e', '#ffffff', '#ef476f', '#ffd166',
  '#06d6a0', '#118ab2', '#7c8cff', '#f472b6',
  '#fb923c', '#a3e635', '#22d3ee', '#a78bfa',
]

interface Props {
  value: string
  onChange: (color: string) => void
  recent: string[]
  secondary?: string
  onSecondaryChange?: (c: string) => void
  onSwap?: () => void
  paletteOverride?: string[] | null
}

/**
 * Lean color picker — primary + optional secondary swatch, swap button,
 * preset grid, recent grid, manual hex entry. Drawie2 uses this in the
 * drawing artboard's tool-settings popover. A future iteration can swap to
 * HeroUI v3's `<ColorPicker>` + `<ColorArea>` primitives for a full HSB UI.
 */
export function ColorPicker({
  value, onChange, recent, secondary, onSecondaryChange, onSwap, paletteOverride,
}: Props) {
  const swatches = paletteOverride && paletteOverride.length > 0 ? paletteOverride : PRESET_PALETTE
  const restricted = !!(paletteOverride && paletteOverride.length > 0)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => { setDraft(value) }, [value])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ColorSlot label="Primary" color={value} onChange={onChange} primary disabled={restricted} />
        {secondary !== undefined && onSecondaryChange && (
          <>
            <button
              type="button"
              onClick={onSwap}
              title="Swap (X)"
              aria-label="Swap primary and secondary color"
              className="w-7 h-7 rounded-md bg-[var(--surface-secondary)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 7h10l-3-3" />
                <path d="M17 17H7l3 3" />
              </svg>
            </button>
            <ColorSlot label="Secondary" color={secondary} onChange={onSecondaryChange} disabled={restricted} />
          </>
        )}
        <button
          type="button"
          onClick={() => !restricted && setOpen((o) => !o)}
          disabled={restricted}
          className="flex-1 text-left px-3 py-2 rounded-lg bg-[var(--surface-secondary)] text-sm text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] min-w-0 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="font-mono text-xs text-[var(--muted)]">{value.toUpperCase()}</span>
        </button>
      </div>

      {restricted && (
        <div className="font-mono text-[10px] text-[var(--muted)] font-bold flex items-center gap-1.5">
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Palette restricted by canvas
        </div>
      )}

      <div className="grid grid-cols-6 gap-1.5">
        {swatches.map((c) => (
          <Swatch key={c} color={c} active={c.toLowerCase() === value.toLowerCase()} onPick={() => onChange(c)} />
        ))}
      </div>

      {recent.length > 0 && (
        <div>
          <div className="font-mono text-[10px] text-[var(--muted)] mb-1">Recent</div>
          <div className="grid grid-cols-6 gap-1.5">
            {recent.map((c, i) => (
              <Swatch key={c + i} color={c} active={c.toLowerCase() === value.toLowerCase()} onPick={() => onChange(c)} />
            ))}
          </div>
        </div>
      )}

      {open && !restricted && (
        <div className="pt-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => /^#[0-9a-fA-F]{6}$/.test(draft) && onChange(draft)}
            onKeyDown={(e) => { if (e.key === 'Enter' && /^#[0-9a-fA-F]{6}$/.test(draft)) onChange(draft) }}
            placeholder="#aabbcc"
            className="font-mono text-xs"
          />
        </div>
      )}
    </div>
  )
}

function ColorSlot({
  label, color, onChange, primary, disabled,
}: {
  label: string
  color: string
  onChange: (c: string) => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <label
      title={label}
      className={[
        'relative w-9 h-9 rounded-full overflow-hidden shadow-inner',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        primary ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-[var(--separator)]',
      ].join(' ')}
    >
      <span className="absolute inset-0" style={{ background: color }} />
      {!disabled && (
        <input
          type="color"
          className="absolute inset-0 opacity-0"
          value={color}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}

function Swatch({ color, active, onPick }: { color: string; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Pick ${color}`}
      className={[
        'h-6 w-full rounded-md transition',
        active ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-[var(--separator)] hover:ring-[var(--muted)]',
      ].join(' ')}
      style={{ background: color }}
    />
  )
}
