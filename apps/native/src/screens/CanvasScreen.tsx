import { useEffect, useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { getCanvas, getTilesForCanvas, claimTile, type Canvas, type Tile } from '@drawie/data'

/**
 * Canvas detail — the tile grid. Tap an empty tile to claim it (claim_tile RPC, idempotent)
 * and open the editor to draw it. Completed tiles are shown but not editable.
 */
export function CanvasScreen({
  canvasId, onBack, onDraw,
}: {
  canvasId: string
  onBack: () => void
  onDraw: (tile: Tile) => void
}) {
  const [canvas, setCanvas] = useState<Canvas | null>(null)
  const [tiles, setTiles] = useState<Tile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const [c, t] = await Promise.all([getCanvas(canvasId), getTilesForCanvas(canvasId)])
      setCanvas(c)
      setTiles(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  useEffect(() => { void load() }, [canvasId])

  const cols = tiles && tiles.length ? Math.max(...tiles.map((t) => t.col)) + 1 : 1

  const onTile = async (tile: Tile) => {
    if (tile.status === 'completed' || claiming) return
    setClaiming(tile.id)
    setError(null)
    try {
      const claimed = await claimTile(canvasId, tile.id)
      onDraw(claimed)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('TILE_UNAVAILABLE') ? 'That tile was just taken — pick another.' : msg)
      void load()
    } finally {
      setClaiming(null)
    }
  }

  return (
    <View style={styles.fill}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}><Text style={styles.back}>‹ Canvases</Text></Pressable>
        <Text style={styles.title} numberOfLines={1}>{canvas?.title ?? '…'}</Text>
        <View style={{ width: 64 }} />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: '#ef476f', fontSize: 13, paddingHorizontal: 24, textAlign: 'center' },
  errorInline: { color: '#ef476f', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#7c8cff' },
  retryText: { color: '#fff', fontWeight: '700' },
  scroll: { padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  hint: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { aspectRatio: 1, padding: 2 },
  cellInner: { flex: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cellClaiming: { opacity: 0.7 },
})
