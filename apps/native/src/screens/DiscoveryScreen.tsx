import { useEffect, useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { listCanvases, supabase, type Canvas } from '@drawie/data'

/**
 * Discovery — browse public canvases from the shared backend (STEP 4 product screens).
 * Tapping a canvas opens its tile grid. Minimal cards for now (title + progress); the
 * gradient/mosaic thumbnails come later.
 */
export function DiscoveryScreen({ onOpen }: { onOpen: (canvasId: string) => void }) {
  const [canvases, setCanvases] = useState<Canvas[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setError(null)
    try {
      setCanvases(await listCanvases({ sort: 'newest' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  useEffect(() => { void load() }, [])

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  return (
    <View style={styles.fill}>
      <View style={styles.header}>
        <Text style={styles.title}>Canvases</Text>
        <Pressable onPress={() => supabase.auth.signOut()} hitSlop={8}><Text style={styles.signOut}>Sign out</Text></Pressable>
      </View>

      {canvases === null && !error ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7c8cff" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {canvases!.length === 0 && <Text style={styles.empty}>No public canvases yet.</Text>}
          {canvases!.map((c) => (
            <Pressable key={c.id} style={styles.card} onPress={() => onOpen(c.id)}>
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
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const pct = (c: Canvas) => (c.totalTiles > 0 ? Math.round((c.completedTiles / c.totalTiles) * 100) : 0)
const statusStyle = (s: Canvas['status']) =>
  s === 'completed' ? { backgroundColor: '#06d6a0' }
    : s === 'almost-complete' ? { backgroundColor: '#f78c6b' }
      : s === 'locked' ? { backgroundColor: '#9aa0a6' }
        : { backgroundColor: '#7c8cff' }

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a2e' },
  signOut: { fontSize: 13, color: '#888', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: '#ef476f', fontSize: 13, paddingHorizontal: 24, textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#7c8cff' },
  retryText: { color: '#fff', fontWeight: '700' },
  empty: { color: '#999', textAlign: 'center', marginTop: 40 },
  list: { padding: 16, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#ececf0', backgroundColor: '#fafafc', padding: 16, gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', flex: 1 },
  badge: { fontSize: 11, fontWeight: '700', color: '#fff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  cardDesc: { fontSize: 13, color: '#777' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#ececf0', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#7c8cff' },
  cardMeta: { fontSize: 12, color: '#999' },
})
