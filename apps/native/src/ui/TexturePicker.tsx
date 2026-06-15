import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native'
import { BRUSH_TEXTURES, type BrushTexture } from '@drawie/core'

/** Texture (grain) picker — labeled pills for none/canvas/grain/noise/speckle. Sets the active
 *  tool's `texture`, driving the engine's maskWithTexture path. Visual swatches can come later. */
export function TexturePicker({ value, onChange }: { value: BrushTexture; onChange: (t: BrushTexture) => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Texture</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {BRUSH_TEXTURES.map((t) => (
          <Pressable key={t} onPress={() => onChange(t)} style={[styles.pill, value === t && styles.active]}>
            <Text style={[styles.text, value === t && styles.textActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  label: { width: 52, fontSize: 12, color: '#555', fontWeight: '600' },
  row: { gap: 6, alignItems: 'center', paddingRight: 8 },
  pill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, backgroundColor: '#e6e6ea' },
  active: { backgroundColor: '#7c8cff' },
  text: { fontSize: 12, color: '#333', fontWeight: '500' },
  textActive: { color: '#fff' },
})
