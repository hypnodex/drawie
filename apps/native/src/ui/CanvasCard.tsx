import { StyleSheet, View, Text, Pressable } from 'react-native'
import type { Canvas } from '@drawie/data'

/** Shared canvas card — title + status badge + progress, used by discovery and profile lists. */
export function CanvasCard({ canvas: c, onPress }: { canvas: Canvas; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
        <Text style={[styles.badge, statusStyle(c.status)]}>{c.status}</Text>
      </View>
      {!!c.description && <Text style={styles.cardDesc} numberOfLines={2}>{c.description}</Text>}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct(c)}%` }]} />
      </View>
      <Text style={styles.cardMeta}>{c.completedTiles}/{c.totalTiles} tiles · {c.activeContributors} drawing</Text>
    </Pressable>
  )
}

const pct = (c: Canvas) => (c.totalTiles > 0 ? Math.round((c.completedTiles / c.totalTiles) * 100) : 0)
const statusStyle = (s: Canvas['status']) =>
  s === 'completed' ? { backgroundColor: '#06d6a0' }
    : s === 'almost-complete' ? { backgroundColor: '#f78c6b' }
      : s === 'locked' ? { backgroundColor: '#9aa0a6' }
        : { backgroundColor: '#7c8cff' }

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#ececf0', backgroundColor: '#fafafc', padding: 16, gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', flex: 1 },
  badge: { fontSize: 11, fontWeight: '700', color: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  cardDesc: { fontSize: 13, color: '#777' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#ececf0', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#7c8cff' },
  cardMeta: { fontSize: 12, color: '#999' },
})
