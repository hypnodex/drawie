import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet } from 'react-native'
import type { ToolSettings } from '@drawie/core'
import { DrawCanvas } from './src/DrawCanvas'

/**
 * Phase 5 native entry — the shared drawing core on a Skia surface with a
 * low-latency gesture-handler + Reanimated input/render binding (see DrawCanvas).
 * The full product shell (homepage, auth, discovery, editor chrome, submit) is rebuilt
 * in RN per NATIVE_PLAN.md, consuming @drawie/data.
 */

// Minimal brush default (the web app's DEFAULT_SETTINGS will move to @drawie/core so
// both platforms share one source — see NATIVE_PLAN.md).
const BRUSH: ToolSettings = {
  color: '#7c8cff', size: 28, opacity: 0.85, softness: 0.5, strength: 0.6, hardness: 0.6,
  shape: 'circle', texture: 'none', blending: 0, dilution: 0, persistence: 0.7,
  buildUp: true, pressureSim: true, wetPaint: false,
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <StatusBar style="auto" />
      <DrawCanvas tool="brush" settings={BRUSH} />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
