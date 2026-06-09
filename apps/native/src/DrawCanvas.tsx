import { useMemo, useRef, useState, useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { Canvas, Image, Skia, type SkImage } from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  StrokeEngine, type InputPoint, type StrokeSample, type ModelStroke, type ToolId, type ToolSettings,
  type AssistSettings, replayStroke,
} from '@drawie/core'
import { RNSkiaBackend } from './render/RNSkiaBackend'

/**
 * Native drawing surface — proves the SHARED @drawie/core engine + retained model
 * render on iOS/Android through RNSkiaBackend, exactly as the web editor does. This is
 * a single-layer starting point; the full editor shell (toolbars, layers, color picker,
 * submit) is rebuilt in RN per NATIVE_PLAN.md, reusing this drawing core verbatim.
 *
 * ⚠️ DEVICE-PENDING — not buildable/verifiable headlessly. `VERIFY:` tags mark the two
 * platform-specific integration points (snapshot-display cadence, and pen pressure/tilt
 * capture) most likely to need adjustment on a real device.
 */

const ARTBOARD = 2000

const DEFAULT_ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5, shapeAssist: false, shapeStrength: 0.6,
  perfectShape: true, holdToSnap: false, holdDelay: 500,
}

export function DrawCanvas({ tool, settings }: { tool: ToolId; settings: ToolSettings }) {
  // One offscreen Skia surface + backend for the (single) layer. The model is the
  // source of truth; the surface is its render cache — same design as web Canvas.tsx.
  const backend = useMemo(() => {
    const surface = Skia.Surface.MakeOffscreen(ARTBOARD, ARTBOARD)!
    const b = new RNSkiaBackend(surface)
    // white paper
    b.fillRect(0, 0, ARTBOARD, ARTBOARD, '#ffffff', 1)
    b.flush()
    return b
  }, [])

  const strokes = useRef<ModelStroke[]>([])
  const samples = useRef<StrokeSample[]>([])
  const ticks = useRef<number[]>([])
  const startT = useRef(0)
  const seed = useRef(1)
  const engine = useRef<StrokeEngine | null>(null)
  const [image, setImage] = useState<SkImage | null>(null)

  const present = useCallback(() => {
    backend.flush()
    // VERIFY: presenting an offscreen surface to <Canvas> by snapshotting each frame.
    // On device prefer a useCanvasRef draw loop or a Reanimated shared value for 60fps;
    // makeImageSnapshot per move is fine for a first run.
    setImage(backend.surface.makeImageSnapshot())
  }, [backend])

  const rerender = useCallback(() => {
    backend.clear()
    backend.fillRect(0, 0, ARTBOARD, ARTBOARD, '#ffffff', 1)
    for (const s of strokes.current) replayStroke(backend, s)
    present()
  }, [backend, present])

  // VERIFY: pressure/tilt. RNGH's pan event may not expose stylus force/tilt on all
  // platforms; for Apple Pencil / Android stylus, read them from the pointer event
  // (RNGH 2.x pointer type) or a small native module, and feed them here. Falling back
  // to pressure=1 (no pressure) keeps mouse/finger working.
  const toInput = (x: number, y: number, t: number, pressure?: number, tiltX?: number, tiltY?: number): InputPoint =>
    ({ x, y, pressure: pressure ?? 1, hasPressure: pressure != null, tiltX, tiltY, t })

  const pan = Gesture.Pan()
    .onBegin((e) => {
      startT.current = e.absoluteX === undefined ? 0 : Date.now()
      samples.current = []
      ticks.current = []
      seed.current = (Math.random() * 0xffffffff) >>> 0
      engine.current = new StrokeEngine(backend, tool, settings, DEFAULT_ASSIST, seed.current)
      const ip = toInput(e.x, e.y, 0)
      engine.current.begin(ip)
      samples.current.push({ x: e.x, y: e.y, pressure: ip.pressure, hasPressure: ip.hasPressure, t: 0 })
      present()
    })
    .onUpdate((e) => {
      const eng = engine.current
      if (!eng) return
      const t = Date.now() - startT.current
      const ip = toInput(e.x, e.y, t)
      eng.extend(ip)
      samples.current.push({ x: e.x, y: e.y, pressure: ip.pressure, hasPressure: ip.hasPressure, t })
      present()
    })
    .onFinalize(() => {
      const eng = engine.current
      if (!eng) return
      eng.end()
      if (samples.current.length > 0) {
        strokes.current.push({
          toolId: tool, settings, assist: DEFAULT_ASSIST, seed: seed.current,
          samples: samples.current,
          ticks: tool === 'watercolor' ? ticks.current : undefined,
        })
      }
      engine.current = null
      present()
    })

  // Public-ish handle for the editor shell to wire undo/redo (per NATIVE_PLAN.md).
  // undo: strokes.current.pop(); rerender(). (Snapshot stacks like web Canvas.tsx.)
  void rerender

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill}>
        <Canvas style={styles.fill}>
          {image && <Image image={image} x={0} y={0} width={ARTBOARD} height={ARTBOARD} fit="contain" />}
        </Canvas>
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: '#fff' } })
