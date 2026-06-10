import { useCallback, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { Canvas, Image, Skia, type SkImage } from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue, runOnJS } from 'react-native-reanimated'
import {
  StrokeEngine, type StrokeSample, type ModelStroke, type ToolId, type ToolSettings,
  type AssistSettings,
} from '@drawie/core'
import { RNSkiaBackend } from './render/RNSkiaBackend'

/**
 * Native drawing surface — WYSIWYG, low-latency, around the SHARED @drawie/core engine
 * (core untouched).
 *
 *   - One persistent CPU/raster Skia surface that ACCUMULATES every stroke (no scene
 *     replay per move; the engine just adds the new stamps).
 *   - Input: gesture-handler Pan worklets (UI-thread capture) read pen pressure+tilt from
 *     `stylusData`, then hop to JS once per event to extend the engine. The engine extend
 *     is cheap; the surface→image snapshot is coalesced to one per frame (rAF).
 *   - Display: the live surface image lives in a Reanimated shared value, so the on-screen
 *     <Canvas> updates on the UI thread with NO React re-render. What you see while drawing
 *     IS the engine's real stroke — identical to the finished result.
 *
 * The surface is CPU-backed (Surface.Make) so the engine's per-stamp readback (brush
 * build-up, blending, smudge, waterdrop) is cheap memory access, not a GPU snapshot.
 */

const ARTBOARD = 2000

const DEFAULT_ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5, shapeAssist: false, shapeStrength: 0.6,
  perfectShape: true, holdToSnap: false, holdDelay: 500,
}

export function DrawCanvas({ tool, settings }: { tool: ToolId; settings: ToolSettings }) {
  const backend = useMemo(() => new RNSkiaBackend(Skia.Surface.Make(ARTBOARD, ARTBOARD)!), [])
  const strokes = useRef<ModelStroke[]>([])
  const layout = useRef({ w: 1, h: 1 })
  const [dims, setDims] = useState({ w: 0, h: 0 })

  // The live surface image (shared value → UI-thread <Image> updates, no React re-render).
  const image = useSharedValue<SkImage | null>(backend.surface.makeImageSnapshot())

  // Active-stroke state (JS thread).
  const eng = useRef<StrokeEngine | null>(null)
  const samples = useRef<StrokeSample[]>([])
  const startT = useRef(0)
  const seed = useRef(1)

  // Snapshot the surface to the display image, coalesced to ≤1/frame. Each snapshot is
  // a native SkImage; dispose the one from 2 frames ago (the UI thread is safely past it)
  // so display images don't accumulate.
  const displayScheduled = useRef(false)
  const prevDisplay = useRef<SkImage | null>(null)
  const scheduleDisplay = useCallback(() => {
    if (displayScheduled.current) return
    displayScheduled.current = true
    requestAnimationFrame(() => {
      displayScheduled.current = false
      backend.flush()
      const snap = backend.surface.makeImageSnapshot()
      const toDispose = prevDisplay.current
      prevDisplay.current = image.value
      image.value = snap
      toDispose?.dispose()
    })
  }, [backend, image])

  const toArtboard = (vx: number, vy: number) => {
    const { w, h } = layout.current
    const s = Math.min(w, h) / ARTBOARD
    const ox = (w - ARTBOARD * s) / 2
    const oy = (h - ARTBOARD * s) / 2
    return { x: (vx - ox) / s, y: (vy - oy) / s }
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    layout.current = { w: width, h: height }
    setDims({ w: width, h: height })
  }

  // ── engine driven incrementally from the gesture (JS thread) ────────────────
  // tiltX/tiltY come from the pen's stylusData and are RETAINED in the model (the engine
  // ignores tilt for now — closes the §9 gap; tools can use it later).
  const begin = useCallback((vx: number, vy: number, pressure: number, has: boolean, tiltX: number, tiltY: number) => {
    const { x, y } = toArtboard(vx, vy)
    startT.current = Date.now()
    seed.current = (Math.random() * 0xffffffff) >>> 0
    eng.current = new StrokeEngine(backend, tool, settings, DEFAULT_ASSIST, seed.current)
    samples.current = [{ x, y, pressure, hasPressure: has, tiltX, tiltY, t: 0 }]
    eng.current.begin({ x, y, pressure, hasPressure: has, tiltX, tiltY, t: 0 })
    scheduleDisplay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, tool, settings, scheduleDisplay])

  const move = useCallback((vx: number, vy: number, pressure: number, has: boolean, tiltX: number, tiltY: number) => {
    const e = eng.current
    if (!e) return
    const { x, y } = toArtboard(vx, vy)
    const t = Date.now() - startT.current
    e.extend({ x, y, pressure, hasPressure: has, tiltX, tiltY, t })
    samples.current.push({ x, y, pressure, hasPressure: has, tiltX, tiltY, t })
    scheduleDisplay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDisplay])

  const end = useCallback(() => {
    const e = eng.current
    if (!e) return
    e.end()
    if (samples.current.length > 0) {
      strokes.current.push({ toolId: tool, settings, assist: DEFAULT_ASSIST, seed: seed.current, samples: samples.current })
    }
    eng.current = null
    scheduleDisplay()
  }, [tool, settings, scheduleDisplay])

  // ── gesture (UI-thread worklets; one runOnJS per event) ─────────────────────
  const press = (e: { stylusData?: { pressure: number; tiltX: number; tiltY: number } }) => {
    'worklet'
    const s = e.stylusData
    const p = s?.pressure
    return { p: p != null && p > 0 ? p : 1, has: p != null && p > 0, tiltX: s?.tiltX ?? 0, tiltY: s?.tiltY ?? 0 }
  }
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { const { p, has, tiltX, tiltY } = press(e); runOnJS(begin)(e.x, e.y, p, has, tiltX, tiltY) })
    .onUpdate((e) => { const { p, has, tiltX, tiltY } = press(e); runOnJS(move)(e.x, e.y, p, has, tiltX, tiltY) })
    .onFinalize(() => { runOnJS(end)() }) // fires on lift AND cancel

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GestureDetector gesture={pan}>
        <Canvas style={StyleSheet.absoluteFill}>
          {dims.w > 0 && <Image image={image} x={0} y={0} width={dims.w} height={dims.h} fit="contain" />}
        </Canvas>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: '#fff' } })
