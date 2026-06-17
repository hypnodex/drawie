import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { Canvas, Image, Skia, type SkImage } from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue, runOnJS } from 'react-native-reanimated'
import {
  StrokeEngine, DEFAULT_ASSIST, renderProfiStroke,
  type StrokeSample, type ModelStroke, type ToolId, type ToolSettings, type AssistSettings, type FreehandInput,
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
const MAX_UNDO = 30 // pixel-checkpoint undo depth (≈16MB each at 2000²; only the active layer accumulates)

export type DrawCanvasHandle = {
  undo: () => void; redo: () => void; clear: () => void
  /** Composite another layer's snapshot onto this surface (layer merge-down). Caller disposes the image. */
  mergeImage: (img: SkImage) => void
  /** Snapshot the layer's current pixels (for save/submit compositing). Caller disposes the
   *  returned image. null if the canvas has been unmounted/disposed. */
  snapshot: () => SkImage | null
}

type DrawCanvasProps = {
  tool: ToolId
  settings: ToolSettings
  /** Fired after every history change (stroke end / undo / redo / clear) so the host can
   *  enable or disable its undo/redo buttons. */
  onHistory?: (h: { canUndo: boolean; canRedo: boolean }) => void
  /** When false the pen gesture is disabled — used for stacked layers so only the active
   *  layer receives input (others are display-only). Defaults to true. */
  active?: boolean
  /** Live broadcast hooks — fired as the local user draws so neighbors can see the stroke live.
   *  Only the active layer fires them (the gesture is disabled on inactive layers). */
  onLiveStart?: (stroke: { toolId: ToolId; settings: ToolSettings; assist: AssistSettings; seed: number; first: StrokeSample }) => void
  onLiveAppend?: (samples: StrokeSample[]) => void
  onLiveEnd?: (ticks?: number[]) => void
  /** Eyedropper: when true a tap samples this layer's pixel and reports its hex (null = transparent). */
  picking?: boolean
  onPick?: (hex: string | null) => void
  /** When true the draw gesture is disabled (e.g. the settings popover is open over the canvas), so a
   *  stylus touch can't draw on or through the panel. */
  blocked?: boolean
}

export const DrawCanvas = forwardRef<DrawCanvasHandle, DrawCanvasProps>(function DrawCanvas(
  { tool, settings, onHistory, active = true, onLiveStart, onLiveAppend, onLiveEnd, picking = false, onPick, blocked = false }, ref,
) {
  // Read the latest live callbacks without re-subscribing the gesture handlers.
  const liveStartRef = useRef(onLiveStart); liveStartRef.current = onLiveStart
  const liveAppendRef = useRef(onLiveAppend); liveAppendRef.current = onLiveAppend
  const liveEndRef = useRef(onLiveEnd); liveEndRef.current = onLiveEnd
  const backend = useMemo(() => new RNSkiaBackend(Skia.Surface.Make(ARTBOARD, ARTBOARD)!, true), [])
  const strokes = useRef<ModelStroke[]>([])
  // Undo/redo as pixel checkpoints for INSTANT restore — model-replay was O(strokes) and felt
  // slow. undoSnaps[0] is the blank canvas; each committed stroke pushes a full-surface snapshot,
  // bounded to MAX_UNDO+1 (older states drop off rather than replay). strokes/redoStrokes keep the
  // vector model in sync for save/submit. Restore = backend.restoreFrom(snapshot) — a single blit.
  const undoSnaps = useRef<SkImage[]>([])
  const redoSnaps = useRef<SkImage[]>([])
  const redoStrokes = useRef<ModelStroke[]>([])
  // Read the latest onHistory without re-subscribing the imperative handlers to it.
  const onHistoryRef = useRef(onHistory)
  onHistoryRef.current = onHistory
  const notifyHistory = () =>
    onHistoryRef.current?.({ canUndo: undoSnaps.current.length > 1, canRedo: redoSnaps.current.length > 0 })
  const layout = useRef({ w: 1, h: 1 })
  const [dims, setDims] = useState({ w: 0, h: 0 })

  // The live surface image (shared value → UI-thread <Image> updates, no React re-render).
  const image = useSharedValue<SkImage | null>(backend.surface.makeImageSnapshot())

  // profibrush (perfect-freehand) — NOT incremental stamping: the whole variable-width ribbon is
  // re-rendered each frame on top of a pre-stroke snapshot (so there's no buildup and the result is
  // identical regardless of draw speed), then committed to the surface at stroke end.
  const profiActive = useRef(false)
  const profiPts = useRef<FreehandInput[]>([])
  const preStroke = useRef<SkImage | null>(null)

  // Active-stroke state (JS thread).
  const eng = useRef<StrokeEngine | null>(null)
  const samples = useRef<StrokeSample[]>([])
  const ticks = useRef<number[]>([])
  const tickRaf = useRef<number | null>(null)
  const startT = useRef(0)
  const seed = useRef(1)

  // Snapshot the surface to the display image, coalesced to ≤1/frame. Dispose the image from
  // 2 frames ago (the UI thread is safely past it) so display images don't accumulate. `alive`
  // is flipped on unmount so a snapshot rAF already queued when Clear remounts bails out before
  // touching the now-disposed surface ("access a disposed object").
  const alive = useRef(true)
  const displayScheduled = useRef(false)
  const prevDisplay = useRef<SkImage | null>(null)
  const scheduleDisplay = useCallback(() => {
    if (displayScheduled.current) return
    displayScheduled.current = true
    requestAnimationFrame(() => {
      displayScheduled.current = false
      if (!alive.current) return
      if (profiActive.current) {
        // restore the canvas to before this stroke, then redraw the whole ribbon from all points so far
        if (preStroke.current) backend.restoreFrom(preStroke.current)
        renderProfiStroke(backend, profiPts.current, settingsRef.current, seed.current, false) // ribbon only (live)
      }
      backend.flush()
      const snap = backend.surface.makeImageSnapshot()
      const toDispose = prevDisplay.current
      prevDisplay.current = image.value
      image.value = snap
      toDispose?.dispose()
    })
  }, [backend, image])

  // Watercolor pooling: the engine pools pigment only when the host pumps tick() every
  // frame while the pointer dwells (mirrors web Canvas.tsx's rAF loop). tick() no-ops for
  // every other tool, so we only run this loop for watercolor — otherwise we'd snapshot the
  // unchanged surface every frame while the pen is held still. `now` shares the sample clock
  // (Date.now()-startT) so the engine's `now - lastMoveAt` dwell gate is correct. Tick times
  // are recorded into the model so replay reproduces the same pooling.
  const tickLoop = useCallback(() => {
    const e = eng.current
    if (!e) { tickRaf.current = null; return }
    const now = Date.now() - startT.current
    e.tick(now)
    ticks.current.push(now)
    scheduleDisplay()
    tickRaf.current = requestAnimationFrame(tickLoop)
  }, [scheduleDisplay])
  const stopTick = useCallback(() => {
    if (tickRaf.current != null) { cancelAnimationFrame(tickRaf.current); tickRaf.current = null }
  }, [])

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

  // Seed the blank undo checkpoint on mount; free all native resources on unmount. `alive`
  // is flipped first so an in-flight rAF bails before touching the now-disposed surface.
  useEffect(() => {
    undoSnaps.current = [backend.surface.makeImageSnapshot()]
    return () => {
      alive.current = false
      stopTick()
      image.value?.dispose?.()
      prevDisplay.current?.dispose?.()
      undoSnaps.current.forEach((s) => s.dispose())
      redoSnaps.current.forEach((s) => s.dispose())
      preStroke.current?.dispose()
      backend.dispose?.()
    }
  }, [backend, image, stopTick])

  // ── engine driven incrementally from the gesture (JS thread) ────────────────
  // Read the latest tool/settings via refs so a slider/colour change does NOT re-render this
  // component (Skia canvas + gesture handlers) on every tick — that was the source of slider lag.
  // The engine only needs them at stroke-begin, which always reads the current ref value.
  const toolRef = useRef(tool); toolRef.current = tool
  const settingsRef = useRef(settings); settingsRef.current = settings
  // Race-free draw block: the gesture worklet reads this on every touch, so when an overlay (settings
  // panel / mosaic view) is open the Pencil simply can't start a stroke — no gesture-recreation or
  // pointerEvents quirks involved.
  const blockedSv = useSharedValue(blocked)
  useEffect(() => { blockedSv.value = blocked }, [blocked, blockedSv])
  // tiltX/tiltY come from the pen's stylusData and are RETAINED in the model (the engine
  // ignores tilt for now — closes the §9 gap; tools can use it later).
  const begin = useCallback((vx: number, vy: number, pressure: number, has: boolean, tiltX: number, tiltY: number) => {
    const tool = toolRef.current, settings = settingsRef.current
    if (tool === 'bucket') return // 'BG color' is applied at the editor level (the artboard paper), not painted into pixels
    const { x, y } = toArtboard(vx, vy)
    startT.current = Date.now()
    seed.current = (Math.random() * 0xffffffff) >>> 0
    samples.current = [{ x, y, pressure, hasPressure: has, tiltX, tiltY, t: 0 }]
    ticks.current = []
    if (tool === 'profibrush') {
      preStroke.current?.dispose()
      preStroke.current = backend.surface.makeImageSnapshot() // canvas state before this stroke
      profiPts.current = [{ x, y, pressure: has ? pressure : 0.5 }]
      profiActive.current = true
      scheduleDisplay() // the rAF redraws the ribbon
      return
    }
    eng.current = new StrokeEngine(backend, tool, settings, DEFAULT_ASSIST, seed.current)
    eng.current.begin({ x, y, pressure, hasPressure: has, tiltX, tiltY, t: 0 })
    liveStartRef.current?.({ toolId: tool, settings, assist: DEFAULT_ASSIST, seed: seed.current, first: samples.current[0] })
    if (tool === 'watercolor') { stopTick(); tickRaf.current = requestAnimationFrame(tickLoop) }
    scheduleDisplay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, scheduleDisplay, tickLoop, stopTick])

  const move = useCallback((vx: number, vy: number, pressure: number, has: boolean, tiltX: number, tiltY: number) => {
    const { x, y } = toArtboard(vx, vy)
    const t = Date.now() - startT.current
    if (profiActive.current) {
      profiPts.current.push({ x, y, pressure: has ? pressure : 0.5 })
      samples.current.push({ x, y, pressure, hasPressure: has, tiltX, tiltY, t })
      scheduleDisplay() // rAF redraws the whole ribbon from all points so far
      return
    }
    const e = eng.current
    if (!e) return
    e.extend({ x, y, pressure, hasPressure: has, tiltX, tiltY, t })
    const sample: StrokeSample = { x, y, pressure, hasPressure: has, tiltX, tiltY, t }
    samples.current.push(sample)
    liveAppendRef.current?.([sample])
    scheduleDisplay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDisplay])

  const end = useCallback(() => {
    const tool = toolRef.current, settings = settingsRef.current
    if (profiActive.current) {
      // final render (the last move's rAF may not have run), then bake + checkpoint
      if (preStroke.current) backend.restoreFrom(preStroke.current)
      renderProfiStroke(backend, profiPts.current, settings, seed.current)
      backend.flush()
      profiActive.current = false
      preStroke.current?.dispose(); preStroke.current = null
      if (samples.current.length > 0) {
        strokes.current.push({ toolId: tool, settings, assist: DEFAULT_ASSIST, seed: seed.current, samples: samples.current })
        undoSnaps.current.push(backend.surface.makeImageSnapshot())
        while (undoSnaps.current.length > MAX_UNDO + 1) undoSnaps.current.shift()!.dispose()
        redoSnaps.current.forEach((s) => s.dispose()); redoSnaps.current = []; redoStrokes.current = []
      }
      scheduleDisplay()
      notifyHistory()
      return
    }
    const e = eng.current
    if (!e) return
    stopTick()
    e.end()
    liveEndRef.current?.(tool === 'watercolor' ? ticks.current : undefined)
    if (samples.current.length > 0) {
      strokes.current.push({
        toolId: tool, settings, assist: DEFAULT_ASSIST, seed: seed.current,
        samples: samples.current, ticks: tool === 'watercolor' ? ticks.current : undefined,
      })
      // checkpoint the new surface state for instant undo; drop the oldest beyond the cap
      undoSnaps.current.push(backend.surface.makeImageSnapshot())
      while (undoSnaps.current.length > MAX_UNDO + 1) undoSnaps.current.shift()!.dispose()
      // a fresh stroke invalidates redo
      redoSnaps.current.forEach((s) => s.dispose())
      redoSnaps.current = []
      redoStrokes.current = []
    }
    eng.current = null
    scheduleDisplay()
    notifyHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, scheduleDisplay, stopTick])

  // ── history (imperative; driven by the editor's undo/redo/clear buttons) ─────
  // Instant: restore the previous/next pixel checkpoint with a single blit. The vector model
  // (strokes/redoStrokes) moves in lockstep so save/submit stays correct. All no-ops mid-stroke.
  const doUndo = useCallback(() => {
    if (eng.current || profiActive.current || undoSnaps.current.length <= 1) return
    redoSnaps.current.push(undoSnaps.current.pop()!)
    if (strokes.current.length) redoStrokes.current.push(strokes.current.pop()!)
    backend.restoreFrom(undoSnaps.current[undoSnaps.current.length - 1])
    scheduleDisplay()
    notifyHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, scheduleDisplay])
  const doRedo = useCallback(() => {
    if (eng.current || profiActive.current || redoSnaps.current.length === 0) return
    const snap = redoSnaps.current.pop()!
    undoSnaps.current.push(snap)
    if (redoStrokes.current.length) strokes.current.push(redoStrokes.current.pop()!)
    backend.restoreFrom(snap)
    scheduleDisplay()
    notifyHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, scheduleDisplay])
  const doClear = useCallback(() => {
    if (eng.current || profiActive.current) return
    undoSnaps.current.forEach((s) => s.dispose())
    redoSnaps.current.forEach((s) => s.dispose())
    strokes.current = []
    redoStrokes.current = []
    backend.clear()
    undoSnaps.current = [backend.surface.makeImageSnapshot()]
    redoSnaps.current = []
    scheduleDisplay()
    notifyHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, scheduleDisplay])
  // Merge-down: composite another layer's snapshot onto this surface, then checkpoint it for undo
  // (so the merge is itself undoable) and invalidate redo. No-op mid-stroke / after unmount.
  const doMergeImage = useCallback((img: SkImage) => {
    if (eng.current || profiActive.current || !alive.current) return
    backend.surface.getCanvas().drawImage(img, 0, 0)
    backend.flush()
    undoSnaps.current.push(backend.surface.makeImageSnapshot())
    while (undoSnaps.current.length > MAX_UNDO + 1) undoSnaps.current.shift()!.dispose()
    redoSnaps.current.forEach((sn) => sn.dispose())
    redoSnaps.current = []
    redoStrokes.current = []
    scheduleDisplay()
    notifyHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, scheduleDisplay])
  // Save/submit reads the committed pixels. flush() first so any pending engine draws are on
  // the surface, then snapshot. Returns null after unmount (surface disposed). Caller disposes.
  const doSnapshot = useCallback((): SkImage | null => {
    if (!alive.current) return null
    backend.flush()
    return backend.surface.makeImageSnapshot()
  }, [backend])
  useImperativeHandle(ref, () => ({ undo: doUndo, redo: doRedo, clear: doClear, snapshot: doSnapshot, mergeImage: doMergeImage }), [doUndo, doRedo, doClear, doSnapshot, doMergeImage])

  // ── gesture (UI-thread worklets; one runOnJS per event) ─────────────────────
  const press = (e: { stylusData?: { pressure: number; tiltX: number; tiltY: number } }) => {
    'worklet'
    const s = e.stylusData
    const p = s?.pressure
    return { p: p != null && p > 0 ? p : 1, has: p != null && p > 0, tiltX: s?.tiltX ?? 0, tiltY: s?.tiltY ?? 0 }
  }
  // Palm/finger rejection: only the pen draws. Apple Pencil touches carry `stylusData`;
  // finger and palm touches don't, so we ignore them. (iOS also suppresses palm touches
  // while the Pencil is active.) maxPointers(1) is REQUIRED so this gesture fails the moment a
  // SECOND finger lands — otherwise it swallows two-finger touches and the editor's pinch-zoom /
  // two-finger-pan (a parent GestureDetector) never activate. Single pointer (the pen) → draw;
  // two pointers (fingers) → released to the zoom/pan gestures above.
  // useMemo'd so a slider/colour change (which re-renders this component) doesn't rebuild the gesture
  // tree every tick — that churn was the slider lag. Only active/picking changes rebuild them.
  const pan = useMemo(() => Gesture.Pan()
    .enabled(active && !picking && !blocked)
    .maxPointers(1)
    .minDistance(0)
    .onBegin((e) => { if (e.stylusData == null || blockedSv.value) return; const { p, has, tiltX, tiltY } = press(e); runOnJS(begin)(e.x, e.y, p, has, tiltX, tiltY) })
    .onUpdate((e) => { if (e.stylusData == null || blockedSv.value) return; const { p, has, tiltX, tiltY } = press(e); runOnJS(move)(e.x, e.y, p, has, tiltX, tiltY) })
    .onFinalize(() => { runOnJS(end)() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, picking, blocked, begin, move, end])

  const onPickRef = useRef(onPick); onPickRef.current = onPick
  // Eyedropper: sample this layer's pixel at the tap (any pointer) and report its hex (null = transparent).
  const sampleAt = useCallback((vx: number, vy: number) => {
    if (!alive.current) return
    const { x, y } = toArtboard(vx, vy)
    backend.flush()
    const px = backend.readPixel(
      Math.max(0, Math.min(ARTBOARD - 1, Math.round(x))),
      Math.max(0, Math.min(ARTBOARD - 1, Math.round(y))),
    )
    if (px && px.a >= 0.5) {
      const h = (n: number) => Math.round(n).toString(16).padStart(2, '0')
      onPickRef.current?.(`#${h(px.r)}${h(px.g)}${h(px.b)}`)
    } else onPickRef.current?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend])
  const tap = useMemo(() => Gesture.Tap().enabled(picking).onEnd((e) => { runOnJS(sampleAt)(e.x, e.y) }), [picking, sampleAt])
  const gesture = useMemo(() => Gesture.Race(tap, pan), [tap, pan])

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Canvas style={StyleSheet.absoluteFill}>
          {dims.w > 0 && <Image image={image} x={0} y={0} width={dims.w} height={dims.h} fit="contain" />}
        </Canvas>
      </GestureDetector>
    </View>
  )
})

// Transparent: the white canvas background is provided once by the host, so stacked layers
// composite correctly (lower layers show through where an upper layer has no pixels).
const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: 'transparent' } })
