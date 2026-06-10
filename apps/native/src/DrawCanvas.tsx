import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { Canvas, Image, Path, Skia, type SkImage, type SkPath } from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue, useDerivedValue, runOnJS } from 'react-native-reanimated'
import {
  StrokeEngine, type InputPoint, type StrokeSample, type ModelStroke, type ToolId, type ToolSettings,
  type AssistSettings,
} from '@drawie/core'
import { RNSkiaBackend } from './render/RNSkiaBackend'

/**
 * Native drawing surface — low-latency input/render binding around the SHARED
 * @drawie/core engine (core untouched).
 *
 *   - Input: react-native-gesture-handler Pan with worklet callbacks (UI thread).
 *     Pen pressure + tilt come from the event's `stylusData`. No JS-bridge hop per move.
 *   - Active stroke: a reactive Skia <Path> driven by a Reanimated shared value — it
 *     redraws on the UI thread every frame with NO React state / re-render on the hot path.
 *   - Committed strokes: on lift only (one runOnJS), the JS-thread @drawie/core engine
 *     renders the faithful stroke into an offscreen surface, cached as an <Image>. The
 *     scene is never replayed per move (split rendering).
 *
 * The active <Path> is a fast preview; the committed image is the engine's exact output
 * (matches web /draw?skia=1). Predicted touches (Apple) aren't exposed by RNGH — a native
 * follow-up (NATIVE_PLAN.md).
 */

const ARTBOARD = 2000

const DEFAULT_ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5, shapeAssist: false, shapeStrength: 0.6,
  perfectShape: true, holdToSnap: false, holdDelay: 500,
}

type ViewPt = { x: number; y: number; pressure: number; has: boolean }

export function DrawCanvas({ tool, settings }: { tool: ToolId; settings: ToolSettings }) {
  const backend = useMemo(() => {
    // Transparent offscreen surface (the white paper is the View background). The engine
    // renders committed strokes here; we snapshot it to a CPU image for display.
    const surface = Skia.Surface.MakeOffscreen(ARTBOARD, ARTBOARD)!
    return new RNSkiaBackend(surface)
  }, [])

  const strokes = useRef<ModelStroke[]>([])
  const layout = useRef({ w: 1, h: 1 })
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [committed, setCommitted] = useState<SkImage | null>(null)

  // ── active stroke (UI thread) ──────────────────────────────────────────────
  const active = useSharedValue<ViewPt[]>([])
  const vscale = useSharedValue(0.5) // artboard→view scale (min(view)/ARTBOARD)

  const activePath = useDerivedValue<SkPath>(() => {
    const pts = active.value
    const p = Skia.Path.Make()
    if (pts.length > 0) {
      p.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y)
    }
    return p
  }, [active])

  // Preview width tracks the latest pen pressure, scaled like the engine's brush
  // diameter (size·(0.35 + 0.65·pressure)) so it reads close to the committed stroke.
  const previewWidth = useDerivedValue(() => {
    const pts = active.value
    const p = pts.length ? pts[pts.length - 1].pressure : 0.5
    return settings.size * (0.35 + 0.65 * p) * vscale.value
  }, [active])

  // ── view ↔ artboard mapping (JS thread, used at commit) ─────────────────────
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
    vscale.value = Math.min(width, height) / ARTBOARD
  }

  // ── commit (JS thread, once per stroke) ─────────────────────────────────────
  const commitStroke = useCallback((pts: ViewPt[]) => {
    if (pts.length === 0) return
    const seed = (Math.random() * 0xffffffff) >>> 0
    const eng = new StrokeEngine(backend, tool, settings, DEFAULT_ASSIST, seed)
    const samples: StrokeSample[] = []
    pts.forEach((pt, i) => {
      const { x, y } = toArtboard(pt.x, pt.y)
      const t = i * 8 // ~120Hz synthetic timing (pen pressure comes from stylusData, not speed)
      const ip: InputPoint = { x, y, pressure: pt.pressure, hasPressure: pt.has, t }
      i === 0 ? eng.begin(ip) : eng.extend(ip)
      samples.push({ x, y, pressure: pt.pressure, hasPressure: pt.has, t })
    })
    eng.end()
    strokes.current.push({ toolId: tool, settings, assist: DEFAULT_ASSIST, seed, samples })
    backend.flush()
    setCommitted(backend.surface.makeImageSnapshot().makeNonTextureImage())
  }, [backend, tool, settings])

  // Clear the active preview only AFTER the committed image has rendered — the
  // committed stroke is on screen before the preview vanishes (no 1-frame flash).
  useEffect(() => { if (committed) active.value = [] }, [committed])

  // ── gesture (UI thread worklets; only onEnd hops to JS) ─────────────────────
  const toPt = (e: { x: number; y: number; stylusData?: { pressure: number } }): ViewPt => {
    'worklet'
    const p = e.stylusData?.pressure
    return { x: e.x, y: e.y, pressure: p != null && p > 0 ? p : 1, has: p != null && p > 0 }
  }
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { active.value = [toPt(e)] })
    .onUpdate((e) => { active.value = [...active.value, toPt(e)] })
    .onEnd((e) => { const pts = [...active.value, toPt(e)]; runOnJS(commitStroke)(pts) })

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GestureDetector gesture={pan}>
        <Canvas style={StyleSheet.absoluteFill}>
          {committed && dims.w > 0 && (
            <Image image={committed} x={0} y={0} width={dims.w} height={dims.h} fit="contain" />
          )}
          {/* Active-stroke preview — redraws on the UI thread via Reanimated. */}
          <Path
            path={activePath}
            style="stroke"
            color={settings.color === 'transparent' ? '#000000' : settings.color}
            strokeWidth={previewWidth}
            strokeCap="round"
            strokeJoin="round"
          />
        </Canvas>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: '#fff' } })
