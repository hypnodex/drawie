import { useState } from 'react'
import { View, Pressable, ScrollView } from 'react-native'
import { cn } from '../lib/cn'
import { Slider } from './Slider'
import { Text } from '../components/ui/text'
import { EyedropperIcon, PlusSmallIcon } from '../components/icons'

const FG = 'hsl(142, 12%, 12%)'

/** A small fixed palette of quick swatches. Tapping one sets the active tool's colour. A custom
 *  HSL picker (the + button) covers any colour; the eyedropper samples a colour from the canvas. */
export const PALETTE = [
  '#0a0b0e', '#5b5f66', '#ffffff', '#ef476f', '#f78c6b', '#ffd166',
  '#06d6a0', '#118ab2', '#7c8cff', '#9b5de5', '#8d6e63', '#073b4c',
]

export function ColorPalette({
  color, onChange, palette, onEyedrop,
}: {
  color: string
  onChange: (c: string) => void
  palette?: string[]
  /** When provided, shows an eyedropper button that samples a colour from the canvas. */
  onEyedrop?: () => void
}) {
  const swatches = palette && palette.length ? palette : PALETTE
  const restricted = !!(palette && palette.length) // founder-restricted canvases hide custom/eyedropper
  const [custom, setCustom] = useState(false)
  const { h, s, l } = hexToHsl(color)

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        {!restricted && onEyedrop && (
          <Pressable onPress={onEyedrop} className="h-[30px] w-[30px] items-center justify-center rounded-full bg-secondary">
            <EyedropperIcon size={16} color={FG} />
          </Pressable>
        )}
        {!restricted && (
          <Pressable onPress={() => setCustom((v) => !v)} className={cn('h-[30px] w-[30px] items-center justify-center rounded-full', custom ? 'bg-primary' : 'bg-secondary')}>
            <PlusSmallIcon size={17} color={custom ? 'white' : FG} />
          </Pressable>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2.5 px-1">
          {swatches.map((c) => {
            const active = c.toLowerCase() === color.toLowerCase()
            return (
              <Pressable
                key={c}
                onPress={() => onChange(c)}
                className={cn('h-[30px] w-[30px] rounded-full border border-black/10', active && 'border-[3px] border-foreground')}
                style={{ backgroundColor: c }}
              >
                {c === '#ffffff' && <View className="absolute inset-0 rounded-full border border-[#ccc]" />}
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {custom && !restricted && (
        <View className="gap-0.5 rounded-xl bg-secondary/60 p-2">
          <View className="mb-1 flex-row items-center gap-2">
            <View className="h-7 w-7 rounded-md border border-black/10" style={{ backgroundColor: color }} />
            <Text className="font-mono text-[11px] uppercase text-muted-foreground">{color}</Text>
          </View>
          <Slider label="Hue" value={h} min={0} max={360} onChange={(v) => onChange(hslToHex(v, s, l))} format={(v) => `${Math.round(v)}°`} />
          <Slider label="Sat" value={s} min={0} max={100} onChange={(v) => onChange(hslToHex(h, v, l))} format={(v) => `${Math.round(v)}%`} />
          <Slider label="Light" value={l} min={0} max={100} onChange={(v) => onChange(hslToHex(h, s, v))} format={(v) => `${Math.round(v)}%`} />
        </View>
      )}
    </View>
  )
}

// ── hex <-> HSL ──────────────────────────────────────────────────────────────
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { h: 0, s: 0, l: 50 }
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const mm = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  const to = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}
