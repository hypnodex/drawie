import { View, Pressable, ScrollView } from 'react-native'
import { BRUSH_TEXTURES, type BrushTexture } from '@drawie/core'
import { Text } from '../components/ui/text'
import { cn } from '../lib/cn'

/** Texture (grain) picker — labeled pills for none/canvas/grain/noise/speckle. Sets the active
 *  tool's `texture`, driving the engine's maskWithTexture path. */
export function TexturePicker({ value, onChange }: { value: BrushTexture; onChange: (t: BrushTexture) => void }) {
  return (
    <View className="flex-row items-center gap-2.5 py-0.5">
      <Text className="w-[52px] text-xs font-semibold text-muted-foreground">Texture</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-1.5 pr-2">
        {BRUSH_TEXTURES.map((t) => (
          <Pressable key={t} onPress={() => onChange(t)} className={cn('rounded-2xl px-2.5 py-1.5', value === t ? 'bg-primary' : 'bg-secondary')}>
            <Text className={cn('text-xs', value === t ? 'font-semibold text-primary-foreground' : 'text-secondary-foreground')}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}
