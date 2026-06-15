import { useState } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'

/**
 * Minimal continuous slider built on gesture-handler (no native-module dep). Tapping or
 * dragging anywhere on the track sets the value by x-position. Used for brush size/opacity
 * in the editor. Lives in its own GestureDetector subtree, independent of the canvas pan.
 */
export function Slider({
  label, value, min, max, step = 1, onChange, format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const [w, setW] = useState(1)
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)))

  const setFromX = (px: number) => {
    const f = Math.max(0, Math.min(1, px / w))
    const raw = min + f * (max - min)
    const snapped = Math.round(raw / step) * step
    onChange(Math.max(min, Math.min(max, snapped)))
  }

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(setFromX)(e.x))
    .onUpdate((e) => runOnJS(setFromX)(e.x))

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <GestureDetector gesture={pan}>
        <View style={styles.track} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          <View style={styles.base} />
          <View style={[styles.fill, { width: `${frac * 100}%` }]} />
          <View style={[styles.thumb, { left: `${frac * 100}%` }]} />
        </View>
      </GestureDetector>
      <Text style={styles.value}>{format ? format(value) : String(Math.round(value))}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  label: { width: 52, fontSize: 12, color: '#555', fontWeight: '600' },
  track: { flex: 1, height: 28, justifyContent: 'center' },
  base: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: '#e0e0e6' },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: '#7c8cff' },
  thumb: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10, marginLeft: -10,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#7c8cff',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  value: { width: 42, fontSize: 12, color: '#333', textAlign: 'right', fontVariant: ['tabular-nums'] },
})
