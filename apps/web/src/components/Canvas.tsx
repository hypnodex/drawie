import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  StrokeEngine, type InputPoint, analyzeShape, generateShapePath, smoothFreeform, ShapeKind,
  replayStroke, type ModelStroke, type StrokeSample, type DrawDocument, type RendererBackend,
  AssistSettings, Layer, ToolId, ToolSettings,
} from '@drawie/core'
import { Canvas2DBackend, SkiaBackend } from '@drawie/renderer'
import type { CanvasKit } from 'canvaskit-wasm'
import { isSkiaEnabled, loadCanvasKit } from '../skiaRuntime'
import { useLiveNeighbors } from '../hooks/useLiveNeighbors'
import neighborImg1 from '../other/magnific_use-the-uploaded-image-as_DBPw5U3pcl.png'
import neighborImg2 from '../other/magnific_use-the-uploaded-image-as_LUtXzDgswO.png'
import neighborImg3 from '../other/magnific_use-the-uploaded-image-as_nTgxpMKYQD.png'
import neighborImg4 from '../other/magnific_use-the-uploaded-image-as_y6FfZGzPW9.png'

export interface CanvasHandle {
  // ── model-driven history (per layer) ──
  undo: (layerId: string) => void
  redo: (layerId: string) => void
  canUndo: (layerId: string) => boolean
  canRedo: (layerId: string) => boolean
  clearLayer: (layerId: string) => void
  mergeIntoLayer: (sourceId: string, targetId: string) => void
  // ── persistence (vector model) ──
  getDocument: () => DrawDocument
  loadDocument: (doc: DrawDocument) => void
  /** Legacy raster draft: paint a flattened image as a layer's background. The
   *  layer keeps no strokes (cannot re-derive them); new strokes draw on top. */
  loadLayerImage: (layerId: string, dataURL: string) => Promise<void>
  // ── export ──
  getCompositeCanvas: () => HTMLCanvasElement
  // ── zoom ──
  zoomIn: () => void
  zoomOut: () => void
  zoomFit: () => void
  getZoom: () => number
}

interface Props {
  tool: ToolId
  settings: ToolSettings
  assist: AssistSettings
  layers: Layer[]            // bottom-first ordering (layers[0] is drawn first)
  activeLayerId: string
  /** Called whenever the internal zoom level changes (e.g. wheel, zoomIn/Out). */
  onZoomChange?: (zoom: number) => void
  /** Premium / founder-tunable larger neighbor preview. When true, the
   *  neighbor slivers grow ~3× so contributors see more context. */
  largeNeighbors?: boolean
  /** When true, the first pointerdown on the canvas is consumed as a
   *  popover-dismiss (no stroke begins). */
  popoverOpen?: boolean
  /** Called when a pointerdown on the canvas should close the popover. */
  onDismissPopover?: () => void
  onStrokeStart?: () => void
  onStrokeEnd?: () => void
  onShapeDetected?: (kind: ShapeKind) => void
  /** Fired after any model mutation (draw / undo / redo / clear / merge / load)
   *  so the host can refresh undo/redo enablement for the active layer. */
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
  /** Active tile's position in the canvas grid + grid size. When provided,
   *  neighbour slivers on grid edges are hidden (no tile exists there). When
   *  omitted (e.g. the standalone /draw sandbox), all 8 neighbours show. */
  tileRow?: number
  tileCol?: number
  gridRows?: number
  gridCols?: number
  /** Canvas id + current user id — enable the realtime live-neighbor layer (subscribe to neighbor
   *  tile channels + broadcast this user's in-progress stroke). Omitted in the /draw sandbox. */
  canvasId?: string
  userId?: string
  /** Real adjacent-tile artwork (signed URLs) keyed by NEIGHBOR_OFFSETS cell index. Shown as the
   *  static sliver content under the live layer; empty neighbors stay blank. */
  neighborArt?: Record<number, string>
  /** Artboard background colour (the 'BG color' tool). Sits behind every layer; re-applicable. */
  bgColor?: string
}

const NEIGHBORS: Array<{ row: -1 | 0 | 1; col: -1 | 0 | 1; seed: number }> = [
  { row: -1, col: -1, seed: 11 },
  { row: -1, col:  0, seed: 22 },
  { row: -1, col:  1, seed: 33 },
  { row:  0, col: -1, seed: 44 },
  { row:  0, col:  1, seed: 55 },
  { row:  1, col: -1, seed: 66 },
  { row:  1, col:  0, seed: 77 },
  { row:  1, col:  1, seed: 88 },
]

// Real neighbour artworks (src/other) cycled across the 8 surrounding tiles.
const NEIGHBOR_IMAGES = [neighborImg1, neighborImg2, neighborImg3, neighborImg4]

// Internal artboard resolution. Stamps render at this resolution and the CSS
// transform scales it visually. Higher = crisper strokes at zoom.
const INTERNAL_SIZE = 2000

// Cap on retained undo snapshots per layer. A snapshot is just an array of stroke
// references (no pixels), so this is cheap memory-wise.
const MAX_UNDO = 80

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { tool, settings, assist, layers, activeLayerId, onZoomChange, largeNeighbors = false, popoverOpen, onDismissPopover, onStrokeStart, onStrokeEnd, onShapeDetected, onHistoryChange, tileRow, tileCol, gridRows, gridCols, canvasId, userId, neighborArt, bgColor = '#ffffff' },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const layerCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())

  // Artboard is always 1200 × 1200 CSS px at 100% zoom; zoom scales on top.
  const tilePx = 1200
  // Layout constants derived from tilePx — declared here so callbacks (toInternal
  // etc.) that useCallback-close over them can reference them without hoisting issues.
  const sliver    = largeNeighbors ? Math.max(36, Math.round(tilePx * 0.16)) : Math.max(8, Math.round(tilePx * 0.05))
  const stageSize = tilePx + 2 * sliver

  const [zoom, setZoom]       = useState(1)
  const [fitZoom, setFitZoom] = useState(1)
  const onZoomChangeRef = useRef(onZoomChange)
  useEffect(() => { onZoomChangeRef.current = onZoomChange }, [onZoomChange])
  // Store pending scroll adjustment to be applied in useLayoutEffect after
  // the zoom state change causes a re-render + DOM resize of the scroll container.
  const scrollAdjust = useRef<{ left: number; top: number } | null>(null)
  const zoomInitialized = useRef(false)

  // ── Document model (source of truth) ──────────────────────────────────────
  // Per-layer ordered strokes, plus undo/redo snapshot stacks (arrays of stroke
  // refs — no pixels). The <canvas> elements are a render cache of these strokes.
  const layerStrokes = useRef<Map<string, ModelStroke[]>>(new Map())
  const layerUndo = useRef<Map<string, ModelStroke[][]>>(new Map())
  const layerRedo = useRef<Map<string, ModelStroke[][]>>(new Map())
  // Optional flattened background per layer (legacy raster drafts that have no strokes).
  const layerBackground = useRef<Map<string, HTMLImageElement>>(new Map())

  // Skia render path (opt-in via ?skia=1). When CanvasKit is loaded, each layer's
  // drawing goes through a SkiaBackend bound to its <canvas> (software surface).
  // Default users stay on Canvas2D and never load CanvasKit.
  const ckRef = useRef<CanvasKit | null>(null)
  const [, setSkiaReady] = useState(false)
  const skiaBackends = useRef<Map<string, { el: HTMLCanvasElement; backend: SkiaBackend }>>(new Map())
  const usingSkia = () => isSkiaEnabled() && !!ckRef.current
  /** Backend driving the in-progress stroke (so move/tick/end can flush it). */
  const strokeBackend = useRef<RendererBackend | null>(null)
  const strokeUsedSkia = useRef(false)

  // In-progress stroke capture.
  const currentSamples = useRef<StrokeSample[]>([])
  const currentTicks = useRef<number[]>([])
  const strokeStartT = useRef(0)
  const currentSeed = useRef(1)
  /** Id of the stroke currently being broadcast to neighbors (null between strokes). */
  const currentStrokeId = useRef<string | null>(null)

  // Realtime live-neighbor layer: subscribe to neighbor channels + replay incoming strokes into the
  // slivers, and broadcast this user's in-progress stroke. Inert in the /draw sandbox (no canvasId).
  const live = useLiveNeighbors({ canvasId, tileRow, tileCol, gridRows, gridCols, userId })

  const engineRef = useRef<StrokeEngine | null>(null)
  const activePointerId = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  /** Timestamp of the last pointermove — used for hold-to-snap detection. */
  const lastInputAt = useRef<number>(0)
  /** True once the current stroke has been shape-snapped mid-stroke. */
  const snappedDuringStroke = useRef<boolean>(false)
  /** Keep assist accessible inside the rAF loop without re-creating the loop. */
  const assistRef = useRef(assist)
  useEffect(() => { assistRef.current = assist }, [assist])
  /** Callback exposed inside the rAF loop — likewise refed to keep loop stable. */
  const onShapeRef = useRef(onShapeDetected)
  useEffect(() => { onShapeRef.current = onShapeDetected }, [onShapeDetected])
  /** Tool + settings refs (rarely change mid-stroke, but cheap). */
  const toolRef = useRef(tool)
  const settingsRef = useRef(settings)
  useEffect(() => { toolRef.current = tool; settingsRef.current = settings }, [tool, settings])
  /** Active-layer + history-callback refs so model callbacks read current values. */
  const activeLayerIdRef = useRef(activeLayerId)
  const onHistoryChangeRef = useRef(onHistoryChange)
  useEffect(() => { onHistoryChangeRef.current = onHistoryChange }, [onHistoryChange])

  // ── model helpers ──────────────────────────────────────────────────────────
  const getStrokes = useCallback((id: string) => layerStrokes.current.get(id) ?? [], [])

  // Load CanvasKit lazily when the Skia path is enabled.
  useEffect(() => {
    if (!isSkiaEnabled()) return
    let alive = true
    loadCanvasKit().then((ck) => { if (alive) { ckRef.current = ck; setSkiaReady(true) } }).catch(() => {})
    return () => {
      alive = false
      for (const { backend } of skiaBackends.current.values()) backend.dispose?.()
      skiaBackends.current.clear()
    }
  }, [])

  /** The RendererBackend for a layer — a Skia surface bound to its canvas (when
   *  enabled + loaded), else a Canvas2D wrapper. Skia backends are cached per layer. */
  const backendFor = useCallback((layerId: string): RendererBackend | null => {
    const c = layerCanvasRefs.current.get(layerId)
    if (!c) return null
    if (isSkiaEnabled() && ckRef.current) {
      const cached = skiaBackends.current.get(layerId)
      if (cached && cached.el === c) return cached.backend
      cached?.backend.dispose?.()
      const surface = ckRef.current.MakeSWCanvasSurface(c)
      if (surface) {
        const backend = new SkiaBackend(ckRef.current, surface)
        skiaBackends.current.set(layerId, { el: c, backend })
        return backend
      }
    }
    const ctx = c.getContext('2d', { willReadFrequently: true })
    return ctx ? new Canvas2DBackend(ctx) : null
  }, [])

  const rerenderLayer = useCallback((layerId: string) => {
    const backend = backendFor(layerId)
    if (!backend) return
    backend.clear()
    // Legacy raster background — Canvas2D only (SkiaBackend can't blit an HTMLImage).
    const bg = layerBackground.current.get(layerId)
    if (bg && !usingSkia()) {
      const c = layerCanvasRefs.current.get(layerId)!
      c.getContext('2d', { willReadFrequently: true })!.drawImage(bg, 0, 0, c.width, c.height)
    }
    for (const s of getStrokes(layerId)) replayStroke(backend, s)
    backend.flush?.()
  }, [backendFor, getStrokes])

  const notifyHistory = useCallback(() => {
    const id = activeLayerIdRef.current
    onHistoryChangeRef.current?.(
      (layerUndo.current.get(id)?.length ?? 0) > 0,
      (layerRedo.current.get(id)?.length ?? 0) > 0,
    )
  }, [])

  /** Snapshot current strokes onto the undo stack and clear redo (call BEFORE mutating). */
  const recordUndo = useCallback((id: string) => {
    const u = layerUndo.current.get(id) ?? []
    u.push(getStrokes(id))
    if (u.length > MAX_UNDO) u.shift()
    layerUndo.current.set(id, u)
    layerRedo.current.set(id, [])
  }, [getStrokes])

  useEffect(() => { activeLayerIdRef.current = activeLayerId; notifyHistory() }, [activeLayerId, notifyHistory])

  const getActiveCtx = useCallback((): CanvasRenderingContext2D | null => {
    const c = layerCanvasRefs.current.get(activeLayerId)
    if (!c) return null
    return c.getContext('2d', { willReadFrequently: true })
  }, [activeLayerId])

  /** Convert captured InputPoints into model samples (with tilt, t rel. to start). */
  const inputToSamples = (pts: InputPoint[]): StrokeSample[] => {
    const t0 = pts[0]?.t ?? 0
    return pts.map((p) => ({
      x: p.x, y: p.y, pressure: p.pressure, hasPressure: p.hasPressure,
      tiltX: p.tiltX, tiltY: p.tiltY, t: p.t - t0,
    }))
  }

  /**
   * Shape-assist: analyse the raw points, regenerate a clean shape (or smoothed
   * freeform) path, then re-render the active layer from its committed strokes
   * (erasing the rough in-progress stroke) and commit the generated shape as a
   * single retained stroke. No pixel snapshot needed — the model IS the pre-stroke state.
   */
  const runShapeAssist = useCallback((layerId: string, raw: InputPoint[]) => {
    const a = assistRef.current
    if (!a.shapeAssist) return false
    if (raw.length < 3) return false
    const detected = analyzeShape(raw, { strength: a.shapeStrength, perfect: a.perfectShape })
    const replayPath = detected
      ? generateShapePath(detected, raw, a.perfectShape)
      : smoothFreeform(raw, a.shapeStrength)
    if (replayPath.length < 2) return false

    const shapeStroke: ModelStroke = {
      toolId: toolRef.current,
      settings: settingsRef.current,
      assist: {
        stabilize: false, stabilizeStrength: 0,
        shapeAssist: false, shapeStrength: 0,
        perfectShape: false, holdToSnap: false, holdDelay: 0,
        bypassInputSmoothing: true,
      },
      seed: (Math.random() * 0xffffffff) >>> 0,
      samples: inputToSamples(replayPath),
      ticks: [],
    }
    rerenderLayer(layerId)                       // committed strokes only (drops rough stroke)
    const backend = backendFor(layerId)
    if (backend) { replayStroke(backend, shapeStroke); backend.flush?.() }
    recordUndo(layerId)
    layerStrokes.current.set(layerId, [...getStrokes(layerId), shapeStroke])
    notifyHistory()
    if (detected) onShapeRef.current?.(detected.kind)
    else onShapeRef.current?.('freeform')
    return true
  }, [rerenderLayer, backendFor, recordUndo, getStrokes, notifyHistory])

  /** Commit the just-drawn freehand stroke (already painted live) into the model. */
  const commitFreehandStroke = useCallback((layerId: string) => {
    const samples = currentSamples.current
    if (samples.length === 0) return
    const stroke: ModelStroke = {
      toolId: toolRef.current,
      settings: settingsRef.current,
      assist: assistRef.current,
      seed: currentSeed.current,
      samples,
      ticks: toolRef.current === 'watercolor' ? currentTicks.current : undefined,
    }
    recordUndo(layerId)
    layerStrokes.current.set(layerId, [...getStrokes(layerId), stroke])
    notifyHistory()
  }, [recordUndo, getStrokes, notifyHistory])

  /** Mid-stroke "hold-to-snap" trigger: end engine + run shape assist now. */
  const triggerHoldSnap = useCallback(() => {
    if (snappedDuringStroke.current) return
    const ctx = getActiveCtx()
    const eng = engineRef.current
    if (!ctx || !eng) return
    snappedDuringStroke.current = true
    if (!strokeUsedSkia.current) ctx.restore()   // unwind the Canvas2D live-draw clip
    eng.end()
    runShapeAssist(activeLayerIdRef.current, eng.getRawPoints())
  }, [getActiveCtx, runShapeAssist])

  const tickLoop = useCallback(() => {
    const eng = engineRef.current
    if (!eng) { rafRef.current = null; return }
    const a = assistRef.current
    if (a.shapeAssist && a.holdToSnap && !snappedDuringStroke.current && lastInputAt.current > 0) {
      const since = performance.now() - lastInputAt.current
      if (since >= a.holdDelay) {
        triggerHoldSnap()
      }
    }
    const now = performance.now()
    eng.tick(now)
    currentTicks.current.push(now - strokeStartT.current)
    strokeBackend.current?.flush?.()
    rafRef.current = requestAnimationFrame(tickLoop)
  }, [triggerHoldSnap])

  // Compute fit-zoom from viewport size; only snap zoom to fit on first measure.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect()
      const inset = 24
      const factor = largeNeighbors ? 1.32 : 1.10
      const stageFull = tilePx * factor
      const fz = Math.max(0.1, Math.min(1, Math.min(
        (rect.width  - inset * 2) / stageFull,
        (rect.height - inset * 2) / stageFull,
      )))
      setFitZoom(fz)
      if (!zoomInitialized.current) {
        zoomInitialized.current = true
        setZoom(fz)
        onZoomChangeRef.current?.(fz)
      }
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [largeNeighbors, tilePx])

  // Ctrl/Cmd + scroll-wheel = zoom toward cursor.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = wrap.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      setZoom((prev) => {
        const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1
        const next = Math.max(0.1, Math.min(5, prev * factor))
        // Compute world position under cursor (in pre-zoom coords)
        const worldX = (wrap.scrollLeft + mouseX) / prev
        const worldY = (wrap.scrollTop  + mouseY) / prev
        // Schedule scroll correction after DOM updates with new zoom
        scrollAdjust.current = {
          left: worldX * next - mouseX,
          top:  worldY * next - mouseY,
        }
        onZoomChangeRef.current?.(next)
        return next
      })
    }
    wrap.addEventListener('wheel', handler, { passive: false })
    return () => wrap.removeEventListener('wheel', handler)
  }, [])

  // Apply pending scroll correction synchronously after zoom-driven re-render.
  useLayoutEffect(() => {
    const adj = scrollAdjust.current
    if (!adj) return
    scrollAdjust.current = null
    const wrap = wrapRef.current
    if (!wrap) return
    wrap.scrollLeft = adj.left
    wrap.scrollTop  = adj.top
  }, [zoom])

  const toInternal = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const rect = stage.getBoundingClientRect()
    // rect is in screen pixels (already zoom-aware via getBoundingClientRect).
    // Convert to stage CSS pixels, subtract the sliver offset to get
    // artboard-relative coords, then map to internal canvas resolution.
    // This allows strokes that START in the neighbor-sliver region — the canvas
    // clip rect (set in onPointerDown) prevents any ink from appearing outside
    // [0, INTERNAL_SIZE], so only the portion inside the artboard is drawn.
    const cssPxPerScreenPx = stageSize / rect.width   // = 1 / zoom
    const artboardCssX = (clientX - rect.left) * cssPxPerScreenPx - sliver
    const artboardCssY = (clientY - rect.top)  * cssPxPerScreenPx - sliver
    return {
      x: (artboardCssX / tilePx) * INTERNAL_SIZE,
      y: (artboardCssY / tilePx) * INTERNAL_SIZE,
    }
  }, [stageSize, sliver, tilePx])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // 'BG color' is applied at the editor level (the artboard paper takes the colour), not painted
    // into pixels — so skip stroke setup for it.
    if (tool === 'bucket') return
    // Tool / Functions popover open? Close it from here directly and skip
    // any stroke setup so this tap doesn't draw. We intentionally do NOT
    // call e.preventDefault() — that would suppress the mousedown that the
    // BottomToolbar's outside-click listener also relies on.
    if (popoverOpen) {
      onDismissPopover?.()
      return
    }
    if (activePointerId.current !== null) return
    const ctx = getActiveCtx()
    if (!ctx) return
    if (isSkiaEnabled() && !ckRef.current) return  // Skia mode: wait for CanvasKit before drawing
    if (!stageRef.current) return
    const wrap = wrapRef.current
    if (!wrap) return
    activePointerId.current = e.pointerId
    wrap.setPointerCapture(e.pointerId)
    e.preventDefault()
    const { x, y } = toInternal(e.clientX, e.clientY)
    snappedDuringStroke.current = false
    const now = performance.now()
    lastInputAt.current = now
    // Begin model capture for this stroke.
    strokeStartT.current = now
    currentTicks.current = []
    currentSeed.current = (Math.random() * 0xffffffff) >>> 0
    const ip: InputPoint = {
      x, y,
      pressure: e.pressure,
      hasPressure: (e.pointerType !== 'mouse') && e.pressure > 0,
      tiltX: e.tiltX, tiltY: e.tiltY,
      t: now,
    }
    currentSamples.current = [{ x, y, pressure: ip.pressure, hasPressure: ip.hasPressure, tiltX: e.tiltX, tiltY: e.tiltY, t: 0 }]
    // Live draw on the active layer via the shared engine + its RendererBackend
    // (Skia surface when enabled, else Canvas2D). The Canvas2D clip bounds drawing
    // to the artboard; the Skia surface is intrinsically bounded to its size.
    const backend = backendFor(activeLayerId)
    if (!backend) { activePointerId.current = null; return }
    strokeBackend.current = backend
    strokeUsedSkia.current = usingSkia()
    if (!strokeUsedSkia.current) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height)
      ctx.clip()
    }
    engineRef.current = new StrokeEngine(backend, tool, settings, assist, currentSeed.current)
    engineRef.current.begin(ip)
    backend.flush?.()
    // Broadcast the stroke start to neighbors (no-op in the sandbox where broadcaster is null).
    const bc = live.broadcaster
    if (bc) {
      currentStrokeId.current = `${currentSeed.current.toString(36)}-${Math.round(now)}`
      bc.begin({ strokeId: currentStrokeId.current, toolId: tool, settings, assist, seed: currentSeed.current }, currentSamples.current[0])
    }
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tickLoop)
    onStrokeStart?.()
  }, [tool, settings, assist, toInternal, onStrokeStart, getActiveCtx, backendFor, tickLoop, popoverOpen, onDismissPopover])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return
    if (snappedDuringStroke.current) return    // ignore further input after hold-snap
    const eng = engineRef.current
    if (!eng) return
    e.preventDefault()
    const events = (typeof e.nativeEvent.getCoalescedEvents === 'function')
      ? e.nativeEvent.getCoalescedEvents()
      : [e.nativeEvent]
    const now = performance.now()
    lastInputAt.current = now
    const added: StrokeSample[] = []
    for (const ev of events) {
      const { x, y } = toInternal(ev.clientX, ev.clientY)
      const hasPressure = (ev.pointerType !== 'mouse') && ev.pressure > 0
      const ip: InputPoint = { x, y, pressure: ev.pressure, hasPressure, tiltX: ev.tiltX, tiltY: ev.tiltY, t: now }
      eng.extend(ip)
      const sample: StrokeSample = { x, y, pressure: ev.pressure, hasPressure, tiltX: ev.tiltX, tiltY: ev.tiltY, t: now - strokeStartT.current }
      currentSamples.current.push(sample)
      added.push(sample)
    }
    strokeBackend.current?.flush?.()
    // Forward the new samples to neighbors (coalesced inside the broadcaster).
    if (currentStrokeId.current) live.broadcaster?.append(added)
  }, [toInternal])

  const finishStroke = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return
    const wrap = wrapRef.current
    if (wrap) {
      try { wrap.releasePointerCapture(e.pointerId) } catch {}
    }
    const ctx = getActiveCtx()
    const eng = engineRef.current
    const layerId = activeLayerIdRef.current
    // If a hold-snap already fired mid-stroke, we already unwound the clip and
    // committed the snapped shape; just clean up here.
    if (!snappedDuringStroke.current) {
      if (ctx && !strokeUsedSkia.current) ctx.restore()   // unwind the Canvas2D clip from begin
      eng?.end()
      strokeBackend.current?.flush?.()
      // Shape assist on release ONLY when hold-to-snap mode is off; otherwise a
      // normal release leaves the rough stroke. Falls through to a freehand commit.
      const snapped = (eng && assistRef.current.shapeAssist && !assistRef.current.holdToSnap)
        ? runShapeAssist(layerId, eng.getRawPoints())
        : false
      if (!snapped) commitFreehandStroke(layerId)
    }

    // Close the broadcast stroke (raw stroke as drawn — soft-realtime, the submitted tile is
    // authoritative). Always fire once per stroke, including after a mid-stroke hold-snap.
    if (currentStrokeId.current) {
      live.broadcaster?.end(undefined, toolRef.current === 'watercolor' ? currentTicks.current : undefined)
      currentStrokeId.current = null
    }

    snappedDuringStroke.current = false
    lastInputAt.current = 0
    activePointerId.current = null
    engineRef.current = null
    strokeBackend.current = null
    currentSamples.current = []
    currentTicks.current = []
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    onStrokeEnd?.()
  }, [onStrokeEnd, getActiveCtx, runShapeAssist, commitFreehandStroke])

  // Imperative API — model-driven.
  useImperativeHandle(ref, () => ({
    undo: (layerId: string) => {
      const u = layerUndo.current.get(layerId)
      if (!u || u.length === 0) return
      const r = layerRedo.current.get(layerId) ?? []
      r.push(getStrokes(layerId))
      layerRedo.current.set(layerId, r)
      layerStrokes.current.set(layerId, u.pop()!)
      rerenderLayer(layerId)
      live.broadcaster?.undo() // mirror the undo in neighbors' live slivers
      notifyHistory()
    },
    redo: (layerId: string) => {
      const r = layerRedo.current.get(layerId)
      if (!r || r.length === 0) return
      const u = layerUndo.current.get(layerId) ?? []
      u.push(getStrokes(layerId))
      layerUndo.current.set(layerId, u)
      layerStrokes.current.set(layerId, r.pop()!)
      rerenderLayer(layerId)
      live.broadcaster?.redo()
      notifyHistory()
    },
    canUndo: (layerId: string) => (layerUndo.current.get(layerId)?.length ?? 0) > 0,
    canRedo: (layerId: string) => (layerRedo.current.get(layerId)?.length ?? 0) > 0,
    clearLayer: (layerId: string) => {
      recordUndo(layerId)
      layerStrokes.current.set(layerId, [])
      layerBackground.current.delete(layerId)
      rerenderLayer(layerId)
      live.broadcaster?.clearStrokes()
      notifyHistory()
    },
    mergeIntoLayer: (sourceId: string, targetId: string) => {
      recordUndo(targetId)
      layerStrokes.current.set(targetId, [...getStrokes(targetId), ...getStrokes(sourceId)])
      layerStrokes.current.delete(sourceId)
      layerUndo.current.delete(sourceId)
      layerRedo.current.delete(sourceId)
      layerBackground.current.delete(sourceId)
      rerenderLayer(targetId)
      notifyHistory()
    },
    getDocument: (): DrawDocument => ({
      version: 1,
      width: INTERNAL_SIZE,
      height: INTERNAL_SIZE,
      layers: layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, strokes: getStrokes(l.id) })),
    }),
    loadDocument: (doc: DrawDocument) => {
      for (const dl of doc.layers) {
        layerStrokes.current.set(dl.id, dl.strokes ?? [])
        layerUndo.current.set(dl.id, [])
        layerRedo.current.set(dl.id, [])
        layerBackground.current.delete(dl.id)
        rerenderLayer(dl.id)
      }
      notifyHistory()
    },
    loadLayerImage: (layerId: string, dataURL: string) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          layerBackground.current.set(layerId, img)
          layerStrokes.current.set(layerId, [])
          rerenderLayer(layerId)
          resolve()
        }
        img.onerror = () => reject(new Error('Image decode failed'))
        img.src = dataURL
      })
    },
    getCompositeCanvas: () => {
      const tmp = document.createElement('canvas')
      tmp.width = INTERNAL_SIZE
      tmp.height = INTERNAL_SIZE
      const ctx = tmp.getContext('2d')!
      // Background colour behind every layer (skip the default white so untouched tiles stay transparent).
      if (bgColor.toLowerCase() !== '#ffffff') {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, INTERNAL_SIZE, INTERNAL_SIZE)
      }
      for (const layer of layers) {
        if (!layer.visible) continue
        const c = layerCanvasRefs.current.get(layer.id)
        if (c) ctx.drawImage(c, 0, 0)
      }
      return tmp
    },
    zoomIn:  () => { const next = Math.min(5, zoom * 1.25);    setZoom(next); onZoomChangeRef.current?.(next) },
    zoomOut: () => { const next = Math.max(0.1, zoom / 1.25); setZoom(next); onZoomChangeRef.current?.(next) },
    zoomFit: () => { setZoom(fitZoom); onZoomChangeRef.current?.(fitZoom) },
    getZoom: () => zoom,
  }), [layers, zoom, fitZoom, getStrokes, rerenderLayer, recordUndo, notifyHistory, bgColor])

  // Layout — slivers that show the inner edge of each neighbor mock tile.
  // (sliver and stageSize are declared at the top of the component so callbacks
  //  can reference them; only innerOffset and zoomedSize are render-local.)
  const innerOffset = tilePx - sliver
  const zoomedSize  = stageSize * zoom

  return (
    <div
      ref={wrapRef}
      // Scrollable viewport — flex-centers the stage when it fits, scrolls
      // when zoomed past viewport size.
      className="w-full h-full overflow-auto select-none flex items-center justify-center p-6"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      onPointerLeave={(e) => { if (activePointerId.current === e.pointerId) finishStroke(e) }}
    >
      {/* Sizing box that takes the *scaled* size so scroll bounds are right. */}
      <div
        style={{ width: zoomedSize, height: zoomedSize, flexShrink: 0 }}
      >
        <div
          ref={stageRef}
          className="relative no-touch-action"
          style={{
            width: stageSize,
            height: stageSize,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            touchAction: 'none',
          }}
        >
        {/* Neighbor slivers — show inner edge of each neighbour's artwork.
            Skip neighbours that fall outside the grid when the active tile is
            on an edge (so a corner/edge tile only shows real neighbours). */}
        {NEIGHBORS.map((n, i) => {
          const gridKnown = tileRow != null && tileCol != null && gridRows != null && gridCols != null
          if (gridKnown) {
            const nr = tileRow + n.row
            const nc = tileCol + n.col
            if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) return null
          }
          const stripLeft = n.col === -1 ? 0 : n.col === 0 ? sliver : sliver + tilePx
          const stripTop  = n.row === -1 ? 0 : n.row === 0 ? sliver : sliver + tilePx
          const stripW = n.col === 0 ? tilePx : sliver
          const stripH = n.row === 0 ? tilePx : sliver
          const imgOffsetLeft = n.col === -1 ? -innerOffset : 0
          const imgOffsetTop  = n.row === -1 ? -innerOffset : 0
          // Source rect (in the 2000² live offscreen) = the inner-edge band the static <img> reveals.
          const scale2000 = INTERNAL_SIZE / tilePx
          const srcX = -imgOffsetLeft * scale2000
          const srcY = -imgOffsetTop * scale2000
          const srcW = stripW * scale2000
          const srcH = stripH * scale2000
          // Static sliver content: real adjacent-tile artwork when we have it; in the /draw sandbox
          // (no grid) fall back to the placeholder; an empty real neighbour stays blank (strip-bg).
          const realArt = neighborArt?.[i]
          const imgSrc = realArt ?? (gridKnown ? undefined : NEIGHBOR_IMAGES[i % NEIGHBOR_IMAGES.length])
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: stripLeft, top: stripTop,
                width: stripW, height: stripH,
                overflow: 'hidden',
                pointerEvents: 'none',
                // Make the neighbour areas clearly visible (even when empty): a distinct fill + framing
                // border so contributors can see exactly where neighbours' edges sit.
                background: '#d7dce6',
                border: '1px solid rgba(20,28,40,0.16)',
                boxSizing: 'border-box',
              }}
            >
              {imgSrc && (
                <img
                  src={imgSrc}
                  alt=""
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: imgOffsetLeft, top: imgOffsetTop,
                    width: tilePx, height: tilePx,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              )}
              {/* Live neighbor layer — ephemeral; blitted from the 2000² offscreen by useLiveNeighbors,
                  clipped to this sliver only. Above the static <img>, never part of the document. */}
              <canvas
                ref={(el) => {
                  if (el) {
                    if (el.width !== stripW || el.height !== stripH) { el.width = stripW; el.height = stripH }
                    live.registerSliver(i, el, { srcX, srcY, srcW, srcH, destW: stripW, destH: stripH, scale: tilePx / INTERNAL_SIZE, offX: imgOffsetLeft, offY: imgOffsetTop })
                  } else {
                    live.registerSliver(i, null, null)
                  }
                }}
                style={{ position: 'absolute', left: 0, top: 0, width: stripW, height: stripH, pointerEvents: 'none' }}
              />
            </div>
          )
        })}

        {/* Active tile container — paper is ALWAYS white in both themes */}
        <div
          className="absolute rounded-md overflow-hidden tile-glow"
          style={{ left: sliver, top: sliver, width: tilePx, height: tilePx }}
        >
          <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />

          {/* Stacked layer canvases — bottom first so later siblings paint on top */}
          {layers.map((layer) => (
            <canvas
              key={layer.id}
              ref={(el) => {
                if (el) {
                  if (el.width !== INTERNAL_SIZE) {
                    el.width = INTERNAL_SIZE
                    el.height = INTERNAL_SIZE
                    el.getContext('2d', { willReadFrequently: true })!
                      .clearRect(0, 0, INTERNAL_SIZE, INTERNAL_SIZE)
                  }
                  layerCanvasRefs.current.set(layer.id, el)
                } else {
                  layerCanvasRefs.current.delete(layer.id)
                }
              }}
              className="absolute inset-0 w-full h-full no-touch-action"
              style={{
                touchAction: 'none',
                display: layer.visible ? 'block' : 'none',
              }}
            />
          ))}

          {/* Invisible pointer-events sink — kept so overlayRef stays valid for
              any legacy reads; actual pointer capture has moved to stageRef. */}
          <div ref={overlayRef} className="absolute inset-0 pointer-events-none" />

          {/* Highlight ring overlay */}
          <div className="absolute inset-0 pointer-events-none rounded-md ring-1 ring-accent/70" />
          <div className="absolute -inset-px pointer-events-none rounded-md pulse-ring" />
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-ink-900/70 backdrop-blur text-[11px] text-ink-300 font-medium tracking-wide pointer-events-none">
            YOUR TILE
          </div>
        </div>
        </div>
      </div>
    </div>
  )
})
