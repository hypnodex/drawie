import { useCallback, useEffect, useState } from 'react'
import { View, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native'
import { getCanvas, getTilesForCanvas, claimTile, getHostId, supabase, type Canvas, type Tile } from '@drawie/data'
import { useRealtimeTiles } from '../hooks/useRealtimeTiles'
import { useRealtimeCanvas } from '../hooks/useRealtimeCanvas'
import { Text } from '../components/ui/text'
import { Button } from '../components/ui/button'
import { cn } from '../lib/cn'

const SPINNER = 'hsl(142, 71%, 45%)'

/**
 * Canvas detail — the tile grid, LIVE. Subscribes to realtime tile + canvas changes so the grid
 * flips status as other artists claim/submit and progress ticks up without a refresh. When the
 * canvas completes, the composited mosaic is revealed in place of the grid. Tap an empty tile to claim it.
 *
 * Phase 3 (native shadcn): StyleSheet → NativeWind over the shadcn tokens (drawing engine untouched).
 */
export function CanvasScreen({
  canvasId, onBack, onDraw, onManage,
}: {
  canvasId: string
  onBack: () => void
  onDraw: (tile: Tile, canvas: Canvas) => void
  onManage?: (canvasId: string) => void
}) {
  const [canvas, setCanvas] = useState<Canvas | null>(null)
  const [tiles, setTiles] = useState<Tile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)

  // Split loaders so realtime can refresh just the side that changed (and a transient realtime
  // refetch error doesn't blow away already-loaded data — only the first load surfaces a fatal error).
  const loadCanvas = useCallback(async () => {
    try { setCanvas(await getCanvas(canvasId)) }
    catch (e) { setError((prev) => prev ?? (e instanceof Error ? e.message : String(e))) }
  }, [canvasId])
  const loadTiles = useCallback(async () => {
    try { setTiles(await getTilesForCanvas(canvasId)) }
    catch (e) { setError((prev) => prev ?? (e instanceof Error ? e.message : String(e))) }
  }, [canvasId])
  const load = useCallback(async () => {
    setError(null)
    await Promise.all([loadCanvas(), loadTiles()])
  }, [loadCanvas, loadTiles])
  useEffect(() => { void load() }, [load])

  // Live: tile status changes refresh the grid; canvas row changes refresh the header + drive the reveal.
  useRealtimeTiles(canvasId, loadTiles)
  useRealtimeCanvas(canvasId, loadCanvas)

  // Host check — surface the Manage entry only to the host of a private canvas.
  useEffect(() => {
    if (canvas?.visibility !== 'private-link') { setIsHost(false); return }
    let alive = true
    ;(async () => {
      try {
        const [hostId, { data }] = await Promise.all([getHostId(canvasId), supabase.auth.getUser()])
        if (alive) setIsHost(!!hostId && hostId === data.user?.id)
      } catch { if (alive) setIsHost(false) }
    })()
    return () => { alive = false }
  }, [canvasId, canvas?.visibility])

  const cols = tiles && tiles.length ? Math.max(...tiles.map((t) => t.col)) + 1 : 1
  const isCompleted = canvas?.status === 'completed'

  const onTile = async (tile: Tile) => {
    if (tile.status === 'completed' || claiming || !canvas) return
    setClaiming(tile.id)
    setError(null)
    try {
      const claimed = await claimTile(canvasId, tile.id)
      onDraw(claimed, canvas) // pass the canvas so the editor can enforce founder palette/tool limits
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('TILE_UNAVAILABLE') ? 'That tile was just taken — pick another.' : msg)
      void loadTiles()
    } finally {
      setClaiming(null)
    }
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Pressable onPress={onBack} hitSlop={8} className="w-20">
          <Text className="text-[15px] font-semibold text-primary">‹ Canvases</Text>
        </Pressable>
        <Text numberOfLines={1} className="flex-1 text-center text-[17px] font-bold text-foreground">{canvas?.title ?? '…'}</Text>
        {isHost && onManage ? (
          <Pressable onPress={() => onManage(canvasId)} hitSlop={8} className="w-16 items-end">
            <Text className="text-sm font-bold text-primary">Manage</Text>
          </Pressable>
        ) : (
          <View className="w-16" />
        )}
      </View>

      {tiles === null && !error ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={SPINNER} /></View>
      ) : error && !tiles ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-sm text-destructive">{error}</Text>
          <Button onPress={load}><Text>Retry</Text></Button>
        </View>
      ) : (
        <ScrollView contentContainerClassName="w-full max-w-[720px] self-center p-4">
          {!!error && <Text className="mb-2 text-center text-sm text-destructive">{error}</Text>}

          {canvas && (
            <Text className="mb-2.5 text-center text-[13px] font-semibold text-muted-foreground">
              {canvas.completedTiles}/{canvas.totalTiles} tiles
              {canvas.activeContributors > 0 ? ` · ${canvas.activeContributors} drawing` : ''}
            </Text>
          )}

          {isCompleted ? (
            // ── Reveal ──────────────────────────────────────────────────────────────────
            <View className="items-center gap-3">
              <Text className="mt-1 text-lg font-extrabold text-foreground">✨ Mosaic complete</Text>
              {canvas?.artworkUrl ? (
                <Image
                  source={{ uri: canvas.artworkUrl }}
                  className="w-full rounded-2xl bg-muted"
                  style={{ aspectRatio: (canvas?.gridCols ?? 1) / (canvas?.gridRows ?? 1) }}
                  resizeMode="cover"
                />
              ) : (
                // artwork_url lands a moment after completion (composite runs async); the canvas
                // subscription reloads us when it does.
                <View className="aspect-square w-full items-center justify-center gap-2.5 rounded-2xl bg-muted">
                  <ActivityIndicator color={SPINNER} />
                  <Text className="text-[13px] text-muted-foreground">Compositing the mosaic…</Text>
                </View>
              )}
            </View>
          ) : (
            // ── Live mosaic grid ──────────────────────────────────────────────────────────
            // Mirrors the web canvas detail: the tile grid is framed as a mosaic taking shape
            // (rounded preview surface), with a status legend + claim hint underneath.
            <>
              <View className="overflow-hidden rounded-2xl bg-secondary p-2">
                <View className="flex-row flex-wrap">
                  {tiles!.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => onTile(t)}
                      disabled={t.status === 'completed' || !!claiming}
                      className="aspect-square p-[1.5px]"
                      style={{ width: `${100 / cols}%` }}
                    >
                      <View className={cn('flex-1 items-center justify-center rounded-[3px]', cellClasses(t.status), claiming === t.id && 'opacity-70')}>
                        {claiming === t.id && <ActivityIndicator size="small" color="white" />}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Legend + claim hint (mirrors the web mosaic-tile legend). */}
              <View className="mt-3 flex-row flex-wrap items-center justify-between gap-y-2">
                <View className="flex-row items-center gap-3.5">
                  <Legend swatch="bg-emerald-500" label="Completed" />
                  <Legend swatch="bg-emerald-400" label="In progress" />
                  <Legend swatch="border border-border bg-background" label="Empty" />
                </View>
                <Text className="text-[12px] font-bold text-foreground">Tap an empty tile to claim →</Text>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('h-3 w-3 rounded-[3px]', swatch)} />
      <Text className="text-[11px] font-medium text-muted-foreground">{label}</Text>
    </View>
  )
}

const cellClasses = (s: Tile['status']) =>
  s === 'completed' ? 'bg-emerald-500'
    : s === 'in-progress' ? 'bg-emerald-400'
      : 'bg-background'
