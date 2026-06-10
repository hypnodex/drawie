import { useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native'
import type { ToolId, ToolSettings, ToolSettingsMap } from '@drawie/core'
import { DrawCanvas } from './DrawCanvas'
import { DEFAULT_SETTINGS, TOOL_IDS } from './tools'
import { Slider } from './ui/Slider'
import { ColorPalette } from './ui/ColorPalette'

/**
 * Editor shell (STEP 4, increment 1) — wraps the working DrawCanvas with real, editable
 * per-tool settings: colour palette + size/opacity sliders + the tool bar + Clear. Each tool
 * keeps its OWN settings (so pen stays thin, spray stays wide); changing a control edits the
 * active tool's entry. No backend yet — layers, undo, and save/submit come in later increments.
 */
export function EditorScreen() {
  const [tool, setTool] = useState<ToolId>('brush')
  const [settingsMap, setSettingsMap] = useState<ToolSettingsMap>(DEFAULT_SETTINGS)
  const [clearKey, setClearKey] = useState(0)

  const active = settingsMap[tool]
  const patch = (p: Partial<ToolSettings>) =>
    setSettingsMap((m) => ({ ...m, [tool]: { ...m[tool], ...p } }))

  return (
    <View style={styles.fill}>
      <View style={styles.canvasWrap}>
        <DrawCanvas key={clearKey} tool={tool} settings={active} />
      </View>

      <View style={styles.panel}>
        <ColorPalette color={active.color} onChange={(c) => patch({ color: c })} />

        <Slider label="Size" value={active.size} min={1} max={100} onChange={(v) => patch({ size: v })} />
        <Slider
          label="Opacity" value={active.opacity} min={0.05} max={1} step={0.05}
          onChange={(v) => patch({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`}
        />

        <View style={styles.toolRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools}>
            {TOOL_IDS.map((id) => (
              <Pressable key={id} onPress={() => setTool(id)} style={[styles.tool, tool === id && styles.toolActive]}>
                <Text style={[styles.toolText, tool === id && styles.toolTextActive]}>{id}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => setClearKey((k) => k + 1)} style={styles.clear}>
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
  tools: { gap: 6, paddingRight: 8, alignItems: 'center' },
  tool: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#e6e6ea' },
  toolActive: { backgroundColor: '#7c8cff' },
  toolText: { fontSize: 13, color: '#333', fontWeight: '500' },
  toolTextActive: { color: '#fff' },
  clear: { marginLeft: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#ef476f' },
  clearText: { fontSize: 13, color: '#fff', fontWeight: '600' },
})
