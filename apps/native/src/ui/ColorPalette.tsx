import { useState } from 'react'
import { View, Pressable, ScrollView } from 'react-native'
import { cn } from '../lib/cn'
import { SvColorPicker } from './SvColorPicker'
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
        <View className="rounded-xl bg-secondary/60 p-2.5">
          <SvColorPicker color={color} onChange={onChange} onEyedrop={onEyedrop} />
        </View>
      )}
    </View>
  )
}
