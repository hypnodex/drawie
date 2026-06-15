import { View, Pressable } from 'react-native'
import type { Canvas } from '@drawie/data'
import { Text } from '../components/ui/text'
import { cn } from '../lib/cn'

/**
 * Shared canvas card — title + status badge + progress, used by discovery and profile lists.
 * Phase 3 (native shadcn): StyleSheet → NativeWind over the shadcn tokens. Status colors mirror
 * the web StatusBadge (completed=brand green, almost=amber, locked/open=muted/secondary).
 */
const STATUS_BADGE: Record<Canvas['status'], string> = {
  'open':            'bg-secondary text-secondary-foreground',
  'almost-complete': 'bg-amber-400 text-amber-950',
  'completed':       'bg-primary text-primary-foreground',
  'locked':          'bg-muted text-muted-foreground',
}

const pct = (c: Canvas) => (c.totalTiles > 0 ? Math.round((c.completedTiles / c.totalTiles) * 100) : 0)

export function CanvasCard({ canvas: c, onPress }: { canvas: Canvas; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="gap-2 rounded-2xl border border-border bg-card p-4 active:opacity-90">
      <View className="flex-row items-center justify-between gap-2">
        <Text numberOfLines={1} className="flex-1 text-[17px] font-bold text-foreground">{c.title}</Text>
        <Text className={cn('overflow-hidden rounded-lg px-2 py-0.5 text-[11px] font-bold', STATUS_BADGE[c.status])}>{c.status}</Text>
      </View>
      {!!c.description && <Text numberOfLines={2} className="text-[13px] text-muted-foreground">{c.description}</Text>}
      <View className="h-1.5 overflow-hidden rounded-full bg-muted">
        <View className="h-1.5 rounded-full bg-primary" style={{ width: `${pct(c)}%` }} />
      </View>
      <Text className="text-xs text-muted-foreground">{c.completedTiles}/{c.totalTiles} tiles · {c.activeContributors} drawing</Text>
    </Pressable>
  )
}
