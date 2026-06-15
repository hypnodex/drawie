import { useState } from 'react'
import { View, Pressable } from 'react-native'
import { Text } from '../ui/text'
import { cn } from '../../lib/cn'
import { LayersIcon, PlusIcon, ChevronDownIcon, EyeIcon, EyeOffIcon, TrashIcon } from '../icons'
import type { LayerMeta } from '../../ui/LayersPanel'

const MUTED = 'hsl(142, 6%, 40%)'
const FG = 'hsl(142, 12%, 12%)'
const DESTRUCTIVE = 'hsl(350, 80%, 55%)'

/**
 * Floating Layers card (top-right of the editor) — mirrors the web Layers panel: header with
 * count + add + collapse, then a row per layer (eye toggle · name · delete), top layer first,
 * active row highlighted. Engine layer model is unchanged.
 */
export function LayersCard({
  layers, activeId, onSelect, onToggleVisible, onAdd, onDelete,
}: {
  layers: LayerMeta[]
  activeId: number
  onSelect: (id: number) => void
  onToggleVisible: (id: number) => void
  onAdd: () => void
  onDelete: (id: number) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const topFirst = layers.map((_, i) => layers[layers.length - 1 - i])
  return (
    <View className="w-56 gap-1 rounded-2xl bg-card p-2 shadow-lg">
      <View className="flex-row items-center justify-between px-1 py-0.5">
        <View className="flex-row items-center gap-1.5">
          <LayersIcon size={13} color={MUTED} />
          <Text className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Layers ({layers.length}/3)</Text>
        </View>
        <View className="flex-row items-center gap-1">
          {layers.length < 3 && (
            <Pressable onPress={onAdd} className="h-7 w-7 items-center justify-center rounded-lg bg-secondary">
              <PlusIcon size={16} color={FG} />
            </Pressable>
          )}
          <Pressable onPress={() => setCollapsed((c) => !c)} hitSlop={6} className="h-7 w-7 items-center justify-center rounded-lg">
            <View style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}>
              <ChevronDownIcon size={16} color={MUTED} />
            </View>
          </Pressable>
        </View>
      </View>

      {!collapsed && (
        <View className="gap-1">
          {topFirst.map((L) => {
            const n = layers.indexOf(L) + 1
            const active = L.id === activeId
            return (
              <Pressable
                key={L.id}
                onPress={() => onSelect(L.id)}
                className={cn('flex-row items-center gap-2 rounded-xl px-2 py-2', active ? 'bg-primary/15' : 'bg-secondary')}
              >
                <Pressable onPress={() => onToggleVisible(L.id)} hitSlop={6}>
                  {L.visible ? <EyeIcon size={17} color={FG} /> : <EyeOffIcon size={17} color={MUTED} />}
                </Pressable>
                <Text className={cn('flex-1 text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>Layer {n}</Text>
                <Text className="font-mono text-[11px] text-muted-foreground">{n}</Text>
                {layers.length > 1 && (
                  <Pressable onPress={() => onDelete(L.id)} hitSlop={6}>
                    <TrashIcon size={15} color={DESTRUCTIVE} />
                  </Pressable>
                )}
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}
