import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { StrokeEngine, InputPoint } from '../drawing/engine'
import { analyzeShape, generateShapePath, smoothFreeform, ShapeKind } from '../drawing/shapes'
import neighborImg1 from '../other/magnific_use-the-uploaded-image-as_DBPw5U3pcl.png'
import neighborImg2 from '../other/magnific_use-the-uploaded-image-as_LUtXzDgswO.png'
import neighborImg3 from '../other/magnific_use-the-uploaded-image-as_nTgxpMKYQD.png'
import neighborImg4 from '../other/magnific_use-the-uploaded-image-as_y6FfZGzPW9.png'
import { AssistSettings, Layer, ToolId, ToolSettings } from '../types'

export interface CanvasHandle {
  takeLayerSnapshot: (layerId: string) => ImageData | null
  restoreLayerSnapshot: (layerId: string, snap: ImageData) => void
  clearLayer: (layerId: string) => void
  mergeIntoLayer: (sourceId: string, targetId: string) => void
  getCompositeCanvas: () => HTMLCanvasElement
  getLayerDataURL: (layerId: string) => string | null
  loadLayerFromDataURL: (layerId: string, dataURL: string) => Promise<void>
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
  /** Active tile's position in the canvas grid + grid size. When provided,
   *  neighbour slivers on grid edges are hidden (no tile exists there). When
   *  omitted (e.g. the standalone /draw sandbox), all 8 neighbours show. */
  tileRow?: number
  tileCol?: number
  gridRows?: number
  gridCols?: number
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

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { tool, settings, assist, layers, activeLayerId, onZoomChange, largeNeighbors = false, popoverOpen, onDismissPopover, onStrokeStart, onStrokeEnd, onShapeDetected, tileRow, tileCol, gridRows, gridCols },
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


  const engineRef = useRef<StrokeEngine | null>(null)
  const activePointerId = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  /** Snapshot of the active layer taken at stroke start so we can restore +
   *  replay a clean shape when assist.shapeAssist is on. */
  const preStrokeSnap = useRef<ImageData | null>(null)
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

  const getActiveCtx = useCallback((): CanvasRenderingContext2D | null => {
    const c = layerCanvasRefs.current.get(activeLayerId)
    if (!c) return null
    return c.getContext('2d', { willReadFrequently: true })
  }, [activeLayerId])

  /** Run shape-assist analysis + replay on the current ctx / engine. */
  const runShapeAssist = useCallback((ctx: CanvasRenderingContext2D, eng: StrokeEngine) => {
    const a = assistRef.current
    if (!a.shapeAssist) return
    if (!preStrokeSnap.current) return
    const raw = eng.getRawPoints()
    if (raw.length < 3) return
    const detected = analyzeShape(raw, { strength: a.shapeStrength, perfect: a.perfectShape })
    const replayPath = detected
      ? generateShapePath(detected, raw, a.perfectShape)
      : smoothFreeform(raw, a.shapeStrength)
    if (replayPath.length < 2) return
    ctx.putImageData(preStrokeSnap.current, 0, 0)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.clip()
    const replay = new StrokeEngine(ctx, toolRef.current, settingsRef.current, {
      stabilize: false, stabilizeStrength: 0,
      shapeAssist: false, shapeStrength: 0,
      perfectShape: false, holdToSnap: false, holdDelay: 0,
      bypassInputSmoothing: true,
    })
    replay.begin(replayPath[0])
    for (let i = 1; i < replayPath.length; i++) replay.extend(replayPath[i])
    replay.end()
    ctx.restore()
    if (detected) onShapeRef.current?.(detected.kind)
    else onShapeRef.current?.('freeform')
  }, [])

  /** Mid-stroke "hold-to-snap" trigger: end engine + run shape assist now. */
  const triggerHoldSnap = useCallback(() => {
    if (snappedDuringStroke.current) return
    const ctx = getActiveCtx()
    const eng = engineRef.current
    if (!ctx || !eng) return
    snappedDuringStroke.current = true
    // Unwind the clip from begin(), end the engine cleanly
    ctx.restore()
    eng.end()
    runShapeAssist(ctx, eng)
    // We deliberately leave pointer capture intact — further movement is
    // ignored (see onPointerMove guard) until the user lifts the pointer.
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
    eng.tick(performance.now())
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

  // Drop history-tracked layers from refs when their canvas unmounts is handled by callback ref below.

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
    if (!stageRef.current) return
    const wrap = wrapRef.current
    if (!wrap) return
    activePointerId.current = e.pointerId
    wrap.setPointerCapture(e.pointerId)
    e.preventDefault()
    const { x, y } = toInternal(e.clientX, e.clientY)
    snappedDuringStroke.current = false
    lastInputAt.current = performance.now()
    // Snapshot before any pixels are drawn — needed for shape-assist replay
    if (assist.shapeAssist) {
      try {
        preStrokeSnap.current = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
      } catch { preStrokeSnap.current = null }
    } else {
      preStrokeSnap.current = null
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.clip()
    engineRef.current = new StrokeEngine(ctx, tool, settings, assist)
    const ip: InputPoint = {
      x, y,
      pressure: e.pressure,
      hasPressure: (e.pointerType !== 'mouse') && e.pressure > 0,
      t: performance.now(),
    }
    engineRef.current.begin(ip)
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tickLoop)
    onStrokeStart?.()
  }, [tool, settings, assist, toInternal, onStrokeStart, getActiveCtx, tickLoop, popoverOpen, onDismissPopover])

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
    for (const ev of events) {
      const { x, y } = toInternal(ev.clientX, ev.clientY)
      const ip: InputPoint = {
        x, y,
        pressure: ev.pressure,
        hasPressure: (ev.pointerType !== 'mouse') && ev.pressure > 0,
        t: now,
      }
      eng.extend(ip)
    }
  }, [toInternal])

  const finishStroke = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return
    const wrap = wrapRef.current
    if (wrap) {
      try { wrap.releasePointerCapture(e.pointerId) } catch {}
    }
    const ctx = getActiveCtx()
    const eng = engineRef.current
    // If a hold-snap already fired mid-stroke, we already unwound the clip and
    // ran the assist; just clean up here.
    if (!snappedDuringStroke.current) {
      if (ctx) ctx.restore()                  // unwind the clip from begin
      eng?.end()
      // Run shape assist on release ONLY when hold-to-snap mode is off. When
      // hold-to-snap is on, a normal release leaves the rough stroke alone.
      if (eng && ctx && assist.shapeAssist && !assist.holdToSnap) {
        runShapeAssist(ctx, eng)
      }
    }
    preStrokeSnap.current = null
    snappedDuringStroke.current = false
    lastInputAt.current = 0

    activePointerId.current = null
    engineRef.current = null
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    onStrokeEnd?.()
  }, [onStrokeEnd, getActiveCtx, assist, runShapeAssist])

  // Imperative API — operates on whatever layer id is given.
  useImperativeHandle(ref, () => ({
    takeLayerSnapshot: (layerId: string) => {
      const c = layerCanvasRefs.current.get(layerId)
      if (!c) return null
      return c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
    },
    restoreLayerSnapshot: (layerId: string, snap: ImageData) => {
      const c = layerCanvasRefs.current.get(layerId)
      if (!c) return
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.putImageData(snap, 0, 0)
    },
    clearLayer: (layerId: string) => {
      const c = layerCanvasRefs.current.get(layerId)
      if (!c) return
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, c.width, c.height)
    },
    mergeIntoLayer: (sourceId: string, targetId: string) => {
      const src = layerCanvasRefs.current.get(sourceId)
      const dst = layerCanvasRefs.current.get(targetId)
      if (!src || !dst) return
      const ctx = dst.getContext('2d')!
      ctx.drawImage(src, 0, 0)
    },
    getCompositeCanvas: () => {
      const tmp = document.createElement('canvas')
      tmp.width = INTERNAL_SIZE
      tmp.height = INTERNAL_SIZE
      const ctx = tmp.getContext('2d')!
      for (const layer of layers) {
        if (!layer.visible) continue
        const c = layerCanvasRefs.current.get(layer.id)
        if (c) ctx.drawImage(c, 0, 0)
      }
      return tmp
    },
    getLayerDataURL: (layerId: string) => {
      const c = layerCanvasRefs.current.get(layerId)
      if (!c) return null
      try { return c.toDataURL('image/webp', 0.85) } catch { return null }
    },
    zoomIn:  () => { const next = Math.min(5, zoom * 1.25);    setZoom(next); onZoomChangeRef.current?.(next) },
    zoomOut: () => { const next = Math.max(0.1, zoom / 1.25); setZoom(next); onZoomChangeRef.current?.(next) },
    zoomFit: () => { setZoom(fitZoom); onZoomChangeRef.current?.(fitZoom) },
    getZoom: () => zoom,
    loadLayerFromDataURL: (layerId: string, dataURL: string) => {
      const c = layerCanvasRefs.current.get(layerId)
      if (!c) return Promise.resolve()
      return new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const ctx = c.getContext('2d')!
          ctx.clearRect(0, 0, c.width, c.height)
          ctx.drawImage(img, 0, 0)
          resolve()
        }
        img.onerror = () => reject(new Error('Image decode failed'))
        img.src = dataURL
      })
    },
  }), [layers, zoom, fitZoom])

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
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: stripLeft, top: stripTop,
                width: stripW, height: stripH,
                overflow: 'hidden',
                pointerEvents: 'none',
                background: 'var(--strip-bg)',
              }}
            >
              <img
                src={NEIGHBOR_IMAGES[i % NEIGHBOR_IMAGES.length]}
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
            </div>
          )
        })}

        {/* Active tile container — paper is ALWAYS white in both themes */}
        <div
          className="absolute rounded-md overflow-hidden tile-glow"
          style={{ left: sliver, top: sliver, width: tilePx, height: tilePx }}
        >
          <div className="absolute inset-0 bg-white" />

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

