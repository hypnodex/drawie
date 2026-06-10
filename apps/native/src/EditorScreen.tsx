import { useRef, useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native'
import type { ToolId, ToolSettings, ToolSettingsMap } from '@drawie/core'
import { DrawCanvas, type DrawCanvasHandle } from './DrawCanvas'
import { DEFAULT_SETTINGS, TOOL_IDS } from './tools'
import { Slider } from './ui/Slider'
import { ColorPalette } from './ui/ColorPalette'
import { TexturePicker } from './ui/TexturePicker'

/**
 * Editor shell (STEP 4, increment 1) — wraps the working DrawCanvas with real, editable
 * per-tool settings: colour palette + size/opacity sliders + the tool bar + Clear. Each tool
 * keeps its OWN settings (so pen stays thin, spray stays wide); changing a control edits the
 * active tool's entry. No backend yet — layers, undo, and save/submit come in later increments.
 */
export function EditorScreen() {
  const [tool, setTool] = useState<ToolId>('brush')
  const [settingsMap, setSettingsMap] = useState<ToolSettingsMap>(DEFAULT_SETTINGS)
  const [hist, setHist] = useState({ canUndo: false, canRedo: false })
  const canvas = useRef<DrawCanvasHandle>(null)

  const active = settingsMap[tool]
  const patch = (p: Partial<ToolSettings>) =>
    setSettingsMap((m) => ({ ...m, [tool]: { ...m[tool], ...p } }))

  return (
    <View style={styles.fill}>
      <View style={styles.canvasWrap}>
        <DrawCanvas ref={canvas} tool={tool} settings={active} onHistory={setHist} />
      </View>

      <View style={styles.panel}>
        <ColorPalette color={active.color} onChange={(c) => patch({ color: c })} />

        <Slider label="Size" value={active.size} min={1} max={120} onChange={(v) => patch({ size: v })} />
        <Slider
          label="Opacity" value={active.opacity} min={0.05} max={1} step={0.01}
          onChange={(v) => patch({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`}
        />
        <Slider
          label="Hardness" value={active.hardness} min={0} max={1} step={0.01}
          onChange={(v) => patch({ hardness: v })} format={(v) => `${Math.round(v * 100)}%`}
        />
        <Slider
          label="Softness" value={active.softness} min={0} max={1} step={0.01}
          onChange={(v) => patch({ softness: v })} format={(v) => `${Math.round(v * 100)}%`}
        />
        <TexturePicker value={active.texture} onChange={(t) => patch({ texture: t })} />

        <View style={styles.toolRow}>
          <Pressable onPress={() => canvas.current?.undo()} disabled={!hist.canUndo} style={[styles.action, !hist.canUndo && styles.actionOff]}>
            <Text style={styles.actionText}>↶</Text>
          </Pressable>
          <Pressable onPress={() => canvas.current?.redo()} disabled={!hist.canRedo} style={[styles.action, !hist.canRedo && styles.actionOff]}>
            <Text style={styles.actionText}>↷</Text>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools} style={styles.toolsScroll}>
            {TOOL_IDS.map((id) => (
              <Pressable key={id} onPress={() => setTool(id)} style={[styles.tool, tool === id && styles.toolActive]}>
                <Text style={[styles.toolText, tool === id && styles.toolTextActive]}>{id}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => canvas.current?.clear()} style={styles.clear}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  canvasWrap: { flex: 1 },
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
