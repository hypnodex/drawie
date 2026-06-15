import { useEffect, useRef, useState } from 'react'
import { View, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { listCanvases, listCompleted, listTrending, type Canvas, type CanvasStatus } from '@drawie/data'
import { CanvasCard } from '../ui/CanvasCard'
import { Text } from '../components/ui/text'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { cn } from '../lib/cn'

const SPINNER = 'hsl(142, 71%, 45%)'

/**
 * Discovery — mirrors the web DiscoveryScreen's information architecture, adapted to mobile:
 * an editorial hero, a "Recently completed" carousel, a "Trending now" row, then the full
 * "All canvases" browser (search + sort/status filters + grid). Sort/status reload immediately;
 * search reloads on submit. Tapping a canvas opens its grid.
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
  const [completed, setCompleted] = useState<Canvas[]>([])
  const [trending, setTrending] = useState<Canvas[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<SortKey>('newest')
  const [status, setStatus] = useState<StatusKey>('all')
  const [query, setQuery] = useState('')

  const scrollRef = useRef<ScrollView>(null)
  const allY = useRef(0)

  const load = async () => {
    setError(null)
    try {
      setCanvases(await listCanvases({ sort, status: STATUS_FILTER[status], search: query.trim() || undefined }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  // The hero carousels are independent of the filters — loaded once (and on pull-to-refresh).
  const loadFeatured = async () => {
    try {
      const [c, t] = await Promise.all([listCompleted(), listTrending(6)])
      setCompleted(c.slice(0, 9)); setTrending(t)
    } catch { /* featured rows just stay empty */ }
  }
  useEffect(() => { void loadFeatured() }, [])
  // Reload on sort/status change (and first mount). Search reloads on submit only (below).
  useEffect(() => { setCanvases(null); void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sort, status])

  const onRefresh = async () => { setRefreshing(true); await Promise.all([load(), loadFeatured()]); setRefreshing(false) }
  const scrollToAll = () => scrollRef.current?.scrollTo({ y: Math.max(0, allY.current - 8), animated: true })

  return (
    <View className="flex-1 bg-background">
      {/* Compact top nav — wordmark (long-press = dev tools) + actions. */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Pressable onLongPress={onDevTools} delayLongPress={600}>
          <Text className="text-[22px] font-extrabold tracking-tight text-foreground">Drawie</Text>
        </Pressable>
        <View className="flex-row items-center gap-4">
          <Button size="sm" onPress={onCreate} className="h-8 rounded-2xl px-3">
            <Text className="text-[13px]">+ New</Text>
          </Button>
          <Pressable onPress={onJoin} hitSlop={8}><Text className="text-sm font-bold text-primary">Join</Text></Pressable>
          <Pressable onPress={onProfile} hitSlop={8}><Text className="text-sm font-bold text-primary">Me</Text></Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full max-w-[720px] self-center pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero — editorial headline + lede + CTA (mirrors web HeroSection). */}
        <View className="px-5 pb-8 pt-4">
          <Text className="text-[40px] font-extrabold leading-[1.05] tracking-tight text-foreground">
            One canvas.{'\n'}Many hands.{'\n'}<Text className="text-[40px] font-extrabold leading-[1.05] text-muted-foreground">A surprise at the end.</Text>
          </Text>
          <Text className="mt-5 text-base leading-relaxed text-muted-foreground">
            Every artwork is broken into hidden tiles. You only see yours — and a thin edge from each neighbor. When everyone finishes, the full mosaic is revealed.
          </Text>
          <View className="mt-6 flex-row gap-3">
            <Button onPress={scrollToAll}><Text>Browse canvases →</Text></Button>
            <Button variant="outline" onPress={onCreate}><Text>Start one</Text></Button>
          </View>
        </View>

        {/* Recently completed — horizontal carousel of finished mosaics. */}
        {completed.length > 0 && (
          <SectionHeader title="Recently completed" subtitle="Mosaics finished by the community — each one the work of dozens of strangers." />
        )}
        {completed.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" contentContainerClassName="gap-3 px-5 pb-2">
            {completed.map((c) => (
              <View key={c.id} className="w-[280px]"><CanvasCard canvas={c} onPress={() => onOpen(c.id)} /></View>
            ))}
          </ScrollView>
        )}

        {/* Trending now — active canvases with momentum. */}
        {trending.length > 0 && (
          <>
            <SectionHeader title="Trending now" subtitle="Active canvases with momentum — join in before they're done." />
            <View className="gap-3 px-5 pb-2">
              {trending.map((c) => <CanvasCard key={c.id} canvas={c} onPress={() => onOpen(c.id)} />)}
            </View>
          </>
        )}

        {/* All canvases — search + filters + full grid. */}
        <View onLayout={(e) => { allY.current = e.nativeEvent.layout.y }}>
          <SectionHeader title="All canvases" subtitle="Filter by status, sort, or search by topic." />
          <View className="gap-2 px-4 pb-2">
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
            <View className="items-center justify-center py-16"><ActivityIndicator size="large" color={SPINNER} /></View>
          ) : error ? (
            <View className="items-center justify-center gap-3 px-6 py-16">
              <Text className="text-center text-sm text-destructive">{error}</Text>
              <Button onPress={load}><Text>Retry</Text></Button>
            </View>
          ) : (
            <View className="gap-3 px-4 pt-1">
              {canvases!.length === 0 && <Text className="mt-6 text-center text-muted-foreground">No canvases match.</Text>}
              {canvases!.map((c) => <CanvasCard key={c.id} canvas={c} onPress={() => onOpen(c.id)} />)}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="px-5 pb-3 pt-6">
      <Text className="text-[22px] font-bold tracking-tight text-foreground">{title}</Text>
      <Text className="mt-1 text-[13px] leading-snug text-muted-foreground">{subtitle}</Text>
    </View>
  )
}
