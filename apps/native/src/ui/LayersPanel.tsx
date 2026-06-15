import { View, Pressable, ScrollView } from 'react-native'
import { Text } from '../components/ui/text'
import { cn } from '../lib/cn'

export type LayerMeta = { id: number; visible: boolean; opacity: number }

/** Compact layer strip: chips (eye toggle + select, top layer shown first) plus add/delete.
 *  Per-layer opacity is a separate slider in the editor (acts on the active layer). */
export function LayersPanel({
  layers, activeId, onSelect, onToggleVisible, onAdd, onDelete,
}: {
  layers: LayerMeta[]
  activeId: number
  onSelect: (id: number) => void
  onToggleVisible: (id: number) => void
  onAdd: () => void
  onDelete: () => void
}) {
  const topFirst = layers.map((_, i) => layers[layers.length - 1 - i]) // top layer leftmost
  return (
    <View className="flex-row items-center gap-2 py-0.5">
      <Text className="w-[52px] text-xs font-semibold text-muted-foreground">Layers</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-1.5 pr-2">
        {topFirst.map((L) => {
          const n = layers.indexOf(L) + 1 // 1 = bottom
          const isActive = L.id === activeId
          return (
            <View key={L.id} className={cn('flex-row items-center gap-1.5 rounded-2xl px-2.5 py-1.5', isActive ? 'bg-primary' : 'bg-secondary')}>
              <Pressable onPress={() => onToggleVisible(L.id)} hitSlop={6} className="px-px">
                <Text className={cn('text-[13px]', isActive ? 'text-primary-foreground' : 'text-foreground')}>{L.visible ? '◉' : '○'}</Text>
              </Pressable>
              <Pressable onPress={() => onSelect(L.id)}>
                <Text className={cn('text-xs font-semibold', isActive ? 'text-primary-foreground' : 'text-foreground')}>L{n}</Text>
              </Pressable>
            </View>
          )
        })}
      </ScrollView>
      {layers.length < 3 && (
        <Pressable onPress={onAdd} className="h-8 w-[34px] items-center justify-center rounded-[10px] bg-secondary">
          <Text className="text-[15px] font-bold text-foreground">＋</Text>
        </Pressable>
      )}
      {layers.length > 1 && (
        <Pressable onPress={onDelete} className="h-8 w-[34px] items-center justify-center rounded-[10px] bg-destructive/20">
          <Text className="text-[15px] font-bold text-foreground">🗑</Text>
        </Pressable>
      )}
    </View>
  )
}
