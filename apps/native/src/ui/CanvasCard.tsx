import { View, Pressable, Image } from 'react-native'
import type { Canvas } from '@drawie/data'
import { Text } from '../components/ui/text'
import { cn } from '../lib/cn'

/**
 * Canvas card — artwork/preview thumbnail with a category tag + status, then title + progress.
 * Used by discovery (grid) and profile lists. Status colors mirror the web StatusBadge.
 */
const STATUS_BADGE: Record<Canvas['status'], string> = {
  'open':            'bg-secondary text-secondary-foreground',
  'almost-complete': 'bg-amber-400 text-amber-950',
  'completed':       'bg-primary text-primary-foreground',
  'locked':          'bg-muted text-muted-foreground',
}

const pct = (c: Canvas) => (c.totalTiles > 0 ? Math.round((c.completedTiles / c.totalTiles) * 100) : 0)
// previewGradient is a CSS gradient string RN can't render — pull its first colour for a solid preview.
const previewColor = (g?: string) => g?.match(/#[0-9a-f]{3,8}/i)?.[0] ?? '#cbd0d9'

export function CanvasCard({ canvas: c, onPress }: { canvas: Canvas; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="overflow-hidden rounded-2xl border border-border bg-card active:opacity-90">
      {/* Preview — finished artwork when available, otherwise the canvas' preview colour. */}
      <View className="aspect-[4/3] w-full" style={{ backgroundColor: previewColor(c.previewGradient) }}>
        {!!c.artworkUrl && (
          <Image source={{ uri: c.artworkUrl }} className="absolute inset-0 h-full w-full" resizeMode="cover" />
        )}
        {!!c.category && (
          <View className="absolute left-2 top-2 rounded-md bg-black/45 px-1.5 py-0.5">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-white">{c.category}</Text>
          </View>
        )}
        <Text className={cn('absolute right-2 top-2 overflow-hidden rounded-md px-1.5 py-0.5 text-[10px] font-bold', STATUS_BADGE[c.status])}>{c.status}</Text>
      </View>

      <View className="gap-1.5 p-2.5">
        <Text numberOfLines={1} className="text-[14px] font-bold text-foreground">{c.title}</Text>
        <View className="h-1.5 overflow-hidden rounded-full bg-muted">
          <View className="h-1.5 rounded-full bg-primary" style={{ width: `${pct(c)}%` }} />
        </View>
        <Text numberOfLines={1} className="text-[11px] text-muted-foreground">{c.completedTiles}/{c.totalTiles} tiles · {c.activeContributors} drawing</Text>
      </View>
    </Pressable>
  )
}
