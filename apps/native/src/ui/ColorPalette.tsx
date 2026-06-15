import { View, Pressable, ScrollView } from 'react-native'
import { cn } from '../lib/cn'

/** A small fixed palette of swatches. Tapping one sets the active tool's colour. A full
 *  HSV picker can replace this later; swatches cover the common case for now. */
export const PALETTE = [
  '#0a0b0e', '#5b5f66', '#ffffff', '#ef476f', '#f78c6b', '#ffd166',
  '#06d6a0', '#118ab2', '#7c8cff', '#9b5de5', '#8d6e63', '#073b4c',
]

export function ColorPalette({ color, onChange, palette }: { color: string; onChange: (c: string) => void; palette?: string[] }) {
  const swatches = palette && palette.length ? palette : PALETTE // canvas-restricted palette overrides the default
  return (
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
            {/* white swatch needs a visible border */}
            {c === '#ffffff' && <View className="absolute inset-0 rounded-full border border-[#ccc]" />}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
