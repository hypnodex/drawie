import { StyleSheet, View, Pressable, ScrollView } from 'react-native'

/** A small fixed palette of swatches. Tapping one sets the active tool's colour. A full
 *  HSV picker can replace this later; swatches cover the common case for now. */
export const PALETTE = [
  '#0a0b0e', '#5b5f66', '#ffffff', '#ef476f', '#f78c6b', '#ffd166',
  '#06d6a0', '#118ab2', '#7c8cff', '#9b5de5', '#8d6e63', '#073b4c',
]

export function ColorPalette({ color, onChange, palette }: { color: string; onChange: (c: string) => void; palette?: string[] }) {
  const swatches = palette && palette.length ? palette : PALETTE // canvas-restricted palette overrides the default
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {swatches.map((c) => {
        const active = c.toLowerCase() === color.toLowerCase()
        return (
          <Pressable key={c} onPress={() => onChange(c)} style={[styles.swatch, { backgroundColor: c }, active && styles.active]}>
            {/* white swatch needs a visible border */}
            {c === '#ffffff' && <View style={styles.whiteRing} />}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingHorizontal: 4, alignItems: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  active: { borderWidth: 3, borderColor: '#333' },
  whiteRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 15, borderWidth: 1, borderColor: '#ccc' },
})
