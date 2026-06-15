import { useEffect, useState } from 'react'
import { View, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { listCanvases, type Canvas, type CanvasStatus } from '@drawie/data'
import { CanvasCard } from '../ui/CanvasCard'
import { Text } from '../components/ui/text'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { cn } from '../lib/cn'

const SPINNER = 'hsl(142, 71%, 45%)'

/**
 * Discovery — browse public canvases from the shared backend, with sort + status filters and search.
 * Sort/status changes reload immediately; search reloads on submit. Tapping a canvas opens its grid.
 *
 * Phase 3 (native shadcn): StyleSheet → NativeWind + RN-Reusables primitives over the shadcn tokens.
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
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Pressable onLongPress={onDevTools} delayLongPress={600}>
          <Text className="text-[28px] font-extrabold text-foreground">Canvases</Text>
        </Pressable>
        <View className="flex-row items-center gap-4">
          <Button size="sm" onPress={onCreate} className="h-8 rounded-2xl px-3">
            <Text className="text-[13px]">+ New</Text>
          </Button>
          <Pressable onPress={onJoin} hitSlop={8}><Text className="text-sm font-bold text-primary">Join</Text></Pressable>
          <Pressable onPress={onProfile} hitSlop={8}><Text className="text-sm font-bold text-primary">Me</Text></Pressable>
        </View>
      </View>

      <View className="gap-2 px-4 pb-1.5">
        <Input
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={load}
          returnKeyType="search"
          placeholder="Search canvases"
          className="h-10"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="items-center gap-2 pr-3">
          {SORTS.map((s) => {
            const on = sort === s.k
            return (
              <Pressable key={s.k} onPress={() => setSort(s.k)} className={cn('rounded-2xl px-3 py-1.5', on ? 'bg-primary' : 'bg-secondary')}>
                <Text className={cn('text-[13px] font-semibold', on ? 'text-primary-foreground' : 'text-secondary-foreground')}>{s.label}</Text>
              </Pressable>
            )
          })}
          <View className="mx-0.5 h-5 w-px bg-border" />
          {STATUSES.map((s) => {
            const on = status === s.k
            return (
              <Pressable key={s.k} onPress={() => setStatus(s.k)} className={cn('rounded-2xl px-3 py-1.5', on ? 'bg-foreground' : 'bg-secondary')}>
                <Text className={cn('text-[13px] font-semibold', on ? 'text-background' : 'text-secondary-foreground')}>{s.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {canvases === null && !error ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={SPINNER} /></View>
      ) : error ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-sm text-destructive">{error}</Text>
          <Button onPress={load}><Text>Retry</Text></Button>
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="w-full max-w-[720px] gap-3 self-center p-4"
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {canvases!.length === 0 && <Text className="mt-10 text-center text-muted-foreground">No canvases match.</Text>}
          {canvases!.map((c) => <CanvasCard key={c.id} canvas={c} onPress={() => onOpen(c.id)} />)}
        </ScrollView>
      )}
    </View>
  )
}
