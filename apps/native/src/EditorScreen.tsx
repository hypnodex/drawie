import { useRef, useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native'
import type { ToolId, ToolSettings, ToolSettingsMap } from '@drawie/core'
import { DrawCanvas, type DrawCanvasHandle } from './DrawCanvas'
import { DEFAULT_SETTINGS, TOOL_IDS } from './tools'
import { Slider } from './ui/Slider'
import { ColorPalette } from './ui/ColorPalette'
import { TexturePicker } from './ui/TexturePicker'
import { LayersPanel, type LayerMeta } from './ui/LayersPanel'

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
export function EditorScreen() {
  const [tool, setTool] = useState<ToolId>('brush')
  const [settingsMap, setSettingsMap] = useState<ToolSettingsMap>(DEFAULT_SETTINGS)
  const [layers, setLayers] = useState<LayerMeta[]>([{ id: 1, visible: true, opacity: 1 }])
  const [activeId, setActiveId] = useState(1)
  const [histById, setHistById] = useState<Record<number, { canUndo: boolean; canRedo: boolean }>>({})
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

  return (
    <View style={styles.fill}>
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
        <ColorPalette color={s.color} onChange={(c) => patch({ color: c })} />
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
            {TOOL_IDS.map((id) => (
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
