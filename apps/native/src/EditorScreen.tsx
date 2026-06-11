import { useRef, useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { Skia, ImageFormat, type SkImage } from '@shopify/react-native-skia'
import type { ToolId, ToolSettings, ToolSettingsMap } from '@drawie/core'
import { uploadTileArtwork, completeTileAndMaybeReveal, moderateContent, GUIDELINES_MESSAGE, type Tile, type Canvas } from '@drawie/data'
import { DrawCanvas, type DrawCanvasHandle } from './DrawCanvas'
import { DEFAULT_SETTINGS, TOOL_IDS } from './tools'
import { Slider } from './ui/Slider'
import { ColorPalette } from './ui/ColorPalette'
import { TexturePicker } from './ui/TexturePicker'
import { LayersPanel, type LayerMeta } from './ui/LayersPanel'

const ARTBOARD = 2000 // must match DrawCanvas — the per-layer surface size we composite

// Build the moderation image: composite onto white, downscale to ≤1024, encode JPEG as a base64
// data URL — the same payload web's canvasToDataUrl produces for the `moderate` edge function.
// Allocates + disposes its own Skia scratch surface; throws if it can't be allocated.
function toModerationDataUrl(composite: SkImage): string {
  const w = Math.max(1, Math.round(ARTBOARD * Math.min(1, 1024 / ARTBOARD)))
  const surf = Skia.Surface.Make(w, w)
  if (!surf) throw new Error('Could not allocate the moderation surface.')
  const c = surf.getCanvas()
  c.clear(Skia.Color('#ffffff')) // white bg, matching web canvasToDataUrl
  c.drawImageRect(composite, Skia.XYWHRect(0, 0, ARTBOARD, ARTBOARD), Skia.XYWHRect(0, 0, w, w), Skia.Paint())
  surf.flush?.()
  const img = surf.makeImageSnapshot()
  const b64 = img.encodeToBase64(ImageFormat.JPEG, 92)
  img.dispose()
  surf.dispose?.()
  return `data:image/jpeg;base64,${b64}`
}

/**
 * Editor shell (STEP 4) — wraps DrawCanvas with editable per-tool settings (colour/size/
 * opacity/hardness/softness/texture), instant undo/redo/clear, and up to 3 LAYERS.
 *
 * Layers are independent stacked DrawCanvas instances (each its own surface + undo) rather than
 * a reworked multi-surface canvas — RN composites the transparent canvases over a white wrap,
 * z-ordered by the layers array. Only the active layer takes pen input (active prop + the
 * non-active wrappers are pointerEvents="none", so touches fall through to the active one).
 * Undo/redo/clear route to the active layer's ref; history is tracked per layer.
 */
export function EditorScreen({ canvasId, tile, canvas, onExit }: { canvasId?: string; tile?: Tile; canvas?: Canvas; onExit?: () => void }) {
  // Founder constraints — restrict the tool bar + colour palette to what this canvas allows.
  const allowedTools = canvas?.allowedTools?.length ? TOOL_IDS.filter((t) => canvas.allowedTools.includes(t)) : TOOL_IDS
  const palette = canvas?.colorPalette ?? undefined
  const [tool, setTool] = useState<ToolId>(() => allowedTools[0] ?? 'brush')
  const [settingsMap, setSettingsMap] = useState<ToolSettingsMap>(() => {
    if (!palette?.length) return DEFAULT_SETTINGS
    const forced = palette[0] // every tool starts on a palette colour so the restriction holds before first pick
    return Object.fromEntries(TOOL_IDS.map((t) => [t, { ...DEFAULT_SETTINGS[t], color: forced }])) as ToolSettingsMap
  })
  const [layers, setLayers] = useState<LayerMeta[]>([{ id: 1, visible: true, opacity: 1 }])
  const [activeId, setActiveId] = useState(1)
  const [histById, setHistById] = useState<Record<number, { canUndo: boolean; canRedo: boolean }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const nextId = useRef(2)
  const layerRefs = useRef(new Map<number, DrawCanvasHandle>())

  const s = settingsMap[tool]
  const patch = (p: Partial<ToolSettings>) => setSettingsMap((m) => ({ ...m, [tool]: { ...m[tool], ...p } }))
  const hist = histById[activeId] ?? { canUndo: false, canRedo: false }
  const activeLayer = layers.find((L) => L.id === activeId) ?? layers[0]
  const ref = (id: number) => layerRefs.current.get(id)

  const addLayer = () => {
    if (layers.length >= 3) return
    const id = nextId.current++
    setLayers([...layers, { id, visible: true, opacity: 1 }])
    setActiveId(id)
  }
  const deleteLayer = () => {
    if (layers.length <= 1) return
    const next = layers.filter((L) => L.id !== activeId)
    setLayers(next)
    setActiveId(next[next.length - 1].id)
  }
  const toggleVisible = (id: number) =>
    setLayers((ls) => ls.map((L) => (L.id === id ? { ...L, visible: !L.visible } : L)))
  const setLayerOpacity = (v: number) =>
    setLayers((ls) => ls.map((L) => (L.id === activeId ? { ...L, opacity: v } : L)))

  // Submit the tile artwork. Composite the VISIBLE layers (array order = z-order, bottom→top)
  // at their per-layer opacity into one transparent PNG — WYSIWYG with what's on screen, and
  // transparent-where-unpainted like the web composite (getCompositeCanvas) — then upload it to
  // the `tiles` bucket and complete_tile (which fires the mosaic reveal on the final tile).
  // Mirrors web CanvasDrawScreen.onSubmit + DrawingScreen's moderation gate: the artwork is screened
  // server-side (the `moderate` edge function) BEFORE publishing; a block aborts and keeps the work.
  const submit = async () => {
    if (!canvasId || !tile || submitting) return
    setSubmitError(null)
    setSubmitting(true)
    const snaps: SkImage[] = []
    let composite: SkImage | null = null
    try {
      const surface = Skia.Surface.Make(ARTBOARD, ARTBOARD)
      if (!surface) throw new Error('Could not allocate a canvas surface.')
      const sc = surface.getCanvas()
      sc.clear(Skia.Color('rgba(0,0,0,0)')) // fresh surfaces aren't guaranteed blank (see RNSkiaBackend.createSurface)
      const paint = Skia.Paint()
      for (const L of layers) {
        if (!L.visible) continue
        const img = ref(L.id)?.snapshot()
        if (!img) continue
        snaps.push(img)
        paint.setAlphaf(L.opacity)
        sc.drawImage(img, 0, 0, paint)
      }
      surface.flush?.()
      composite = surface.makeImageSnapshot()
      surface.dispose?.()

      // Moderation gate — screen the artwork before it's published. A block leaves the canvas
      // untouched so the user can edit and resubmit (mirrors web passesModeration()).
      const verdict = await moderateContent({ imageDataUrl: toModerationDataUrl(composite) })
      if (!verdict.allowed) {
        setSubmitError(verdict.message || GUIDELINES_MESSAGE)
        setSubmitting(false)
        return
      }

      // RN supabase-storage uploads an ArrayBuffer reliably (Blob/FormData are flaky on RN).
      // encodeToBytes returns a plain ArrayBuffer-backed array; the cast just drops the
      // SharedArrayBuffer arm of ArrayBufferLike that .slice() widens to.
      const bytes = composite.encodeToBytes() // PNG
      const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const path = await uploadTileArtwork(canvasId, tile.id, body)
      await completeTileAndMaybeReveal(canvasId, tile.id, path)
      onExit?.() // back to the grid; it reloads on mount and shows this tile completed
    } catch (e) {
      console.warn('[submit] FAILED:', e instanceof Error ? e.message : String(e))
      setSubmitError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    } finally {
      snaps.forEach((sn) => sn.dispose())
      composite?.dispose()
    }
  }
  const canSubmit = !!canvasId && !!tile

  return (
    <View style={styles.fill}>
      <View style={styles.topBar}>
        <Pressable onPress={() => onExit?.()} hitSlop={8} disabled={submitting}><Text style={styles.topBack}>‹ Tiles</Text></Pressable>
        <Text style={styles.topTitle}>{tile ? `Tile · r${tile.row + 1} c${tile.col + 1}` : 'Draw'}</Text>
        {canSubmit ? (
          <Pressable onPress={submit} disabled={submitting} style={[styles.submit, submitting && styles.submitOff]} hitSlop={8}>
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Submit</Text>}
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>
      {!!submitError && <Text style={styles.submitError} numberOfLines={2}>{submitError}</Text>}
      {!!canvas?.styleGuidance && <Text style={styles.rules} numberOfLines={2}>“{canvas.styleGuidance}”</Text>}
      <View style={styles.canvasWrap}>
        {layers.map((L, i) => (
          <View
            key={L.id}
            style={[StyleSheet.absoluteFill, { zIndex: i, opacity: L.visible ? L.opacity : 0 }]}
            pointerEvents={L.id === activeId ? 'auto' : 'none'}
          >
            <DrawCanvas
              ref={(h) => { if (h) layerRefs.current.set(L.id, h); else layerRefs.current.delete(L.id) }}
              active={L.id === activeId}
              tool={tool}
              settings={s}
              onHistory={(h) => setHistById((m) => ({ ...m, [L.id]: h }))}
            />
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <ColorPalette color={s.color} onChange={(c) => patch({ color: c })} palette={palette} />
        <Slider label="Size" value={s.size} min={1} max={120} onChange={(v) => patch({ size: v })} />
        <Slider label="Opacity" value={s.opacity} min={0.05} max={1} step={0.01} onChange={(v) => patch({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Hardness" value={s.hardness} min={0} max={1} step={0.01} onChange={(v) => patch({ hardness: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Softness" value={s.softness} min={0} max={1} step={0.01} onChange={(v) => patch({ softness: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <TexturePicker value={s.texture} onChange={(t) => patch({ texture: t })} />

        <LayersPanel layers={layers} activeId={activeId} onSelect={setActiveId} onToggleVisible={toggleVisible} onAdd={addLayer} onDelete={deleteLayer} />
        <Slider label="Layer α" value={activeLayer.opacity} min={0} max={1} step={0.01} onChange={setLayerOpacity} format={(v) => `${Math.round(v * 100)}%`} />

        <View style={styles.toolRow}>
          <Pressable onPress={() => ref(activeId)?.undo()} disabled={!hist.canUndo} style={[styles.action, !hist.canUndo && styles.actionOff]}>
            <Text style={styles.actionText}>↶</Text>
          </Pressable>
          <Pressable onPress={() => ref(activeId)?.redo()} disabled={!hist.canRedo} style={[styles.action, !hist.canRedo && styles.actionOff]}>
            <Text style={styles.actionText}>↷</Text>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools} style={styles.toolsScroll}>
            {allowedTools.map((id) => (
              <Pressable key={id} onPress={() => setTool(id)} style={[styles.tool, tool === id && styles.toolActive]}>
                <Text style={[styles.toolText, tool === id && styles.toolTextActive]}>{id}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => ref(activeId)?.clear()} style={styles.clear}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  topBack: { fontSize: 15, color: '#7c8cff', fontWeight: '600', width: 60 },
  topTitle: { fontSize: 14, color: '#555', fontWeight: '600' },
  rules: { fontSize: 12, color: '#888', fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 16, paddingTop: 4 },
  submit: { minWidth: 60, height: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#7c8cff' },
  submitOff: { opacity: 0.5 },
  submitText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  submitError: { color: '#ef476f', fontSize: 12, textAlign: 'center', paddingHorizontal: 12, paddingVertical: 4 },
  canvasWrap: { flex: 1, backgroundColor: '#fff' },
  panel: {
    paddingTop: 8, paddingBottom: 28, paddingHorizontal: 12, gap: 6,
    backgroundColor: '#f4f4f6', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd',
  },
  toolRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  action: { width: 38, height: 36, borderRadius: 10, marginRight: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e6e6ea' },
  actionOff: { opacity: 0.35 },
  actionText: { fontSize: 18, color: '#333', fontWeight: '700' },
  toolsScroll: { flex: 1 },
  tools: { gap: 6, paddingRight: 8, alignItems: 'center' },
  tool: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#e6e6ea' },
  toolActive: { backgroundColor: '#7c8cff' },
  toolText: { fontSize: 13, color: '#333', fontWeight: '500' },
  toolTextActive: { color: '#fff' },
  clear: { marginLeft: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#ef476f' },
  clearText: { fontSize: 13, color: '#fff', fontWeight: '600' },
})
