import { useEffect, useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, RefreshControl, TextInput } from 'react-native'
import { listCanvases, type Canvas, type CanvasStatus } from '@drawie/data'
import { CanvasCard } from '../ui/CanvasCard'

/**
 * Discovery — browse public canvases from the shared backend, with sort + status filters and search.
 * Sort/status changes reload immediately; search reloads on submit. Tapping a canvas opens its grid.
 */
type SortKey = 'newest' | 'trending' | 'almost-complete' | 'progress-low'
const SORTS: { k: SortKey; label: string }[] = [
  { k: 'newest', label: 'Newest' },
  { k: 'trending', label: 'Trending' },
  { k: 'almost-complete', label: 'Almost done' },
  { k: 'progress-low', label: 'Fresh' },
]
type StatusKey = 'all' | 'active' | 'done'
const STATUS_FILTER: Record<StatusKey, CanvasStatus[] | undefined> = {
  all: undefined,
  active: ['open', 'almost-complete'],
  done: ['completed'],
}
const STATUSES: { k: StatusKey; label: string }[] = [
  { k: 'all', label: 'All' }, { k: 'active', label: 'Active' }, { k: 'done', label: 'Completed' },
]

export function DiscoveryScreen({
  onOpen, onCreate, onJoin, onProfile, onDevTools,
}: {
  onOpen: (canvasId: string) => void
  onCreate: () => void
  onJoin: () => void
  onProfile: () => void
  onDevTools?: () => void
}) {
  const [canvases, setCanvases] = useState<Canvas[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<SortKey>('newest')
  const [status, setStatus] = useState<StatusKey>('all')
  const [query, setQuery] = useState('')

  const load = async () => {
    setError(null)
    try {
      setCanvases(await listCanvases({ sort, status: STATUS_FILTER[status], search: query.trim() || undefined }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  // Reload on sort/status change (and first mount). Search reloads on submit only (below).
  useEffect(() => { setCanvases(null); void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sort, status])

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  return (
    <View style={styles.fill}>
      <View style={styles.header}>
        <Pressable onLongPress={onDevTools} delayLongPress={600}><Text style={styles.title}>Canvases</Text></Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={onCreate} hitSlop={8} style={styles.newBtn}><Text style={styles.newBtnText}>+ New</Text></Pressable>
          <Pressable onPress={onJoin} hitSlop={8}><Text style={styles.me}>Join</Text></Pressable>
          <Pressable onPress={onProfile} hitSlop={8}><Text style={styles.me}>Me</Text></Pressable>
        </View>
      </View>

      <View style={styles.filters}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={load}
          returnKeyType="search"
          placeholder="Search canvases"
          placeholderTextColor="#bbb"
          style={styles.search}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {SORTS.map((s) => (
            <Pressable key={s.k} onPress={() => setSort(s.k)} style={[styles.chip, sort === s.k && styles.chipOn]}>
              <Text style={[styles.chipText, sort === s.k && styles.chipTextOn]}>{s.label}</Text>
            </Pressable>
          ))}
          <View style={styles.sep} />
          {STATUSES.map((s) => (
            <Pressable key={s.k} onPress={() => setStatus(s.k)} style={[styles.chip, status === s.k && styles.chipDot]}>
              <Text style={[styles.chipText, status === s.k && styles.chipTextOn]}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
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
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {canvases!.length === 0 && <Text style={styles.empty}>No canvases match.</Text>}
          {canvases!.map((c) => <CanvasCard key={c.id} canvas={c} onPress={() => onOpen(c.id)} />)}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a1a2e' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  newBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#7c8cff' },
  newBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  me: { fontSize: 14, color: '#7c8cff', fontWeight: '700' },
  filters: { paddingHorizontal: 16, paddingBottom: 6, gap: 8 },
  search: { borderWidth: 1, borderColor: '#e3e3e8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#1a1a2e', backgroundColor: '#fafafc' },
  chips: { gap: 8, alignItems: 'center', paddingRight: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#ececf2' },
  chipOn: { backgroundColor: '#7c8cff' },
  chipDot: { backgroundColor: '#1a1a2e' },
  chipText: { fontSize: 13, color: '#444', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  sep: { width: 1, height: 20, backgroundColor: '#e3e3e8', marginHorizontal: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: '#ef476f', fontSize: 13, paddingHorizontal: 24, textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#7c8cff' },
  retryText: { color: '#fff', fontWeight: '700' },
  empty: { color: '#999', textAlign: 'center', marginTop: 40 },
  list: { padding: 16, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
})
