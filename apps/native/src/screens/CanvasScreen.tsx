import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native'
import { getCanvas, getTilesForCanvas, claimTile, getHostId, supabase, type Canvas, type Tile } from '@drawie/data'
import { useRealtimeTiles } from '../hooks/useRealtimeTiles'
import { useRealtimeCanvas } from '../hooks/useRealtimeCanvas'

/**
 * Canvas detail — the tile grid, LIVE. Subscribes to realtime tile + canvas changes so the grid
 * flips status as other artists claim/submit and progress ticks up without a refresh. When the
 * canvas completes, the composited mosaic (canvas.artworkUrl, public URL from composite-mosaic)
 * is revealed in place of the grid. Tap an empty tile to claim it (claim_tile RPC) and draw it.
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

  // Live: tile status changes refresh the grid; canvas row changes (progress / status / artwork_url)
  // refresh the header + drive the reveal.
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
    <View style={styles.fill}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}><Text style={styles.back}>‹ Canvases</Text></Pressable>
        <Text style={styles.title} numberOfLines={1}>{canvas?.title ?? '…'}</Text>
        {isHost && onManage ? (
          <Pressable onPress={() => onManage(canvasId)} hitSlop={8} style={styles.manage}><Text style={styles.manageText}>Manage</Text></Pressable>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      {tiles === null && !error ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7c8cff" /></View>
      ) : error && !tiles ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {!!error && <Text style={styles.errorInline}>{error}</Text>}

          {canvas && (
            <Text style={styles.progress}>
              {canvas.completedTiles}/{canvas.totalTiles} tiles
              {canvas.activeContributors > 0 ? ` · ${canvas.activeContributors} drawing` : ''}
            </Text>
          )}

          {isCompleted ? (
            // ── Reveal ──────────────────────────────────────────────────────────────────
            <View style={styles.revealWrap}>
              <Text style={styles.revealTitle}>✨ Mosaic complete</Text>
              {canvas?.artworkUrl ? (
                <Image
                  source={{ uri: canvas.artworkUrl }}
                  style={[styles.reveal, { aspectRatio: (canvas?.gridCols ?? 1) / (canvas?.gridRows ?? 1) }]}
                  resizeMode="cover"
                />
              ) : (
                // The last tile flipped the canvas to completed; composite-mosaic runs async, so
                // artwork_url lands a moment later — the canvas subscription reloads us when it does.
                <View style={[styles.reveal, styles.revealPending]}>
                  <ActivityIndicator color="#7c8cff" />
                  <Text style={styles.revealHint}>Compositing the mosaic…</Text>
                </View>
              )}
            </View>
          ) : (
            // ── Live tile grid ──────────────────────────────────────────────────────────
            <>
              <Text style={styles.hint}>Tap an empty tile to claim + draw it.</Text>
              <View style={styles.grid}>
                {tiles!.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => onTile(t)}
                    disabled={t.status === 'completed' || !!claiming}
                    style={[styles.cell, { width: `${100 / cols}%` }]}
                  >
                    <View style={[styles.cellInner, cellStyle(t.status), claiming === t.id && styles.cellClaiming]}>
                      {claiming === t.id && <ActivityIndicator size="small" color="#fff" />}
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const cellStyle = (s: Tile['status']) =>
  s === 'completed' ? { backgroundColor: '#06d6a0' }
    : s === 'in-progress' ? { backgroundColor: '#ffd166' }
      : { backgroundColor: '#ececf2' }

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { fontSize: 15, color: '#7c8cff', fontWeight: '600', width: 80 },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', flex: 1, textAlign: 'center' },
  manage: { width: 64, alignItems: 'flex-end' },
  manageText: { fontSize: 14, color: '#7c8cff', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: '#ef476f', fontSize: 13, paddingHorizontal: 24, textAlign: 'center' },
  errorInline: { color: '#ef476f', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#7c8cff' },
  retryText: { color: '#fff', fontWeight: '700' },
  scroll: { padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  progress: { fontSize: 13, color: '#555', fontWeight: '600', textAlign: 'center', marginBottom: 10 },
  hint: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { aspectRatio: 1, padding: 2 },
  cellInner: { flex: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cellClaiming: { opacity: 0.7 },
  revealWrap: { alignItems: 'center', gap: 12 },
  revealTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a2e', marginTop: 4 },
  reveal: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#f4f4f6' },
  revealPending: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  revealHint: { fontSize: 13, color: '#888' },
})
