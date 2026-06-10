import { useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native'
import type { ToolId } from '@drawie/core'
import { DrawCanvas } from './src/DrawCanvas'
import { DEFAULT_SETTINGS, TOOL_IDS } from './src/tools'

/**
 * Phase 5 native entry — the shared drawing core on a Skia surface, with a minimal
 * tool selector for walking all 11 tools on device against the web /draw?skia=1
 * reference (STEP 3.3). The full product shell is rebuilt in RN later (STEP 4).
 */
export default function App() {
  const [tool, setTool] = useState<ToolId>('brush')
  const [clearKey, setClearKey] = useState(0) // bump to remount DrawCanvas → fresh surface

  return (
    <GestureHandlerRootView style={styles.fill}>
      <StatusBar style="auto" />
      <View style={styles.fill}>
        <DrawCanvas key={clearKey} tool={tool} settings={DEFAULT_SETTINGS[tool]} />
      </View>
      <View style={styles.bar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barRow}>
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
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 28, paddingTop: 8, paddingHorizontal: 8, backgroundColor: '#f4f4f6', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd' },
  barRow: { gap: 6, paddingRight: 8 },
  tool: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#e6e6ea' },
  toolActive: { backgroundColor: '#7c8cff' },
  toolText: { fontSize: 13, color: '#333', fontWeight: '500' },
  toolTextActive: { color: '#fff' },
  clear: { marginLeft: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#ef476f' },
  clearText: { fontSize: 13, color: '#fff', fontWeight: '600' },
})
