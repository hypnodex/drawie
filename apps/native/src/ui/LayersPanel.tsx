import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native'

export type LayerMeta = { id: number; visible: boolean; opacity: number }

/** Compact layer strip: chips (eye toggle + select, top layer shown first) plus add/delete.
 *  Per-layer opacity is a separate slider in the editor (acts on the active layer). */
export function LayersPanel({
  layers, activeId, onSelect, onToggleVisible, onAdd, onDelete,
}: {
  layers: LayerMeta[]
  activeId: number
  onSelect: (id: number) => void
  onToggleVisible: (id: number) => void
  onAdd: () => void
  onDelete: () => void
}) {
  const topFirst = layers.map((_, i) => layers[layers.length - 1 - i]) // top layer leftmost
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Layers</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {topFirst.map((L) => {
          const n = layers.indexOf(L) + 1 // 1 = bottom
          const isActive = L.id === activeId
          return (
            <View key={L.id} style={[styles.chip, isActive && styles.chipActive]}>
              <Pressable onPress={() => onToggleVisible(L.id)} hitSlop={6} style={styles.eye}>
                <Text style={styles.eyeText}>{L.visible ? '◉' : '○'}</Text>
              </Pressable>
              <Pressable onPress={() => onSelect(L.id)}>
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>L{n}</Text>
              </Pressable>
            </View>
          )
        })}
      </ScrollView>
      {layers.length < 3 && (
        <Pressable onPress={onAdd} style={styles.btn}><Text style={styles.btnText}>＋</Text></Pressable>
      )}
      {layers.length > 1 && (
        <Pressable onPress={onDelete} style={[styles.btn, styles.del]}><Text style={styles.btnText}>🗑</Text></Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  label: { width: 52, fontSize: 12, color: '#555', fontWeight: '600' },
  row: { gap: 6, alignItems: 'center', paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#e6e6ea' },
  chipActive: { backgroundColor: '#7c8cff' },
  eye: { paddingHorizontal: 1 },
  eyeText: { fontSize: 13, color: '#444' },
  chipText: { fontSize: 12, color: '#333', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  btn: { width: 34, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e6e6ea' },
  del: { backgroundColor: '#f6d4dc' },
  btnText: { fontSize: 15, color: '#333', fontWeight: '700' },
})
