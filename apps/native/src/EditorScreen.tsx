import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, Pressable, ScrollView, ActivityIndicator, Alert, Image, type LayoutChangeEvent } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Skia, ImageFormat, type SkImage } from '@shopify/react-native-skia'
import type { ToolId, ToolSettings, ToolSettingsMap, AssistSettings, StrokeSample } from '@drawie/core'
import {
  uploadTileArtwork, completeTileAndMaybeReveal, releaseTile, moderateContent, GUIDELINES_MESSAGE,
  getTilesForCanvas, tileArtworkUrl, supabase, NEIGHBOR_OFFSETS, inGridNeighbors,
  type Tile, type Canvas,
} from '@drawie/data'
import { DrawCanvas, type DrawCanvasHandle } from './DrawCanvas'
import { LiveNeighborStrip } from './render/LiveNeighborStrip'
import { useLiveNeighborsNative } from './hooks/useLiveNeighborsNative'
import { readSimConfig, writeSimConfig, restartSim, simAllowed } from './lib/simConfig'
import { DEFAULT_SETTINGS, TOOL_IDS } from './tools'
import type { LayerMeta } from './ui/LayersPanel'
import { Text } from './components/ui/text'
import { cn } from './lib/cn'
import { LayersCard } from './components/editor/LayersCard'
import { ToolSettingsPanel } from './components/editor/ToolSettings'
import { MosaicGridSheet } from './components/editor/MosaicGridSheet'
import { TOOL_ICON, UndoIcon, RedoIcon, TrashIcon, SendIcon, ZoomInIcon, ZoomOutIcon, FitIcon, GridIcon, EyedropperIcon } from './components/icons'

import { tokenColors } from './theme/tokenColors'

// Icon colors (RN SVG needs concrete colors, not className tokens) — resolved from the token source.
const FG = tokenColors.foreground
const DESTRUCTIVE = tokenColors.destructive

const ARTBOARD = 2000 // must match DrawCanvas — the per-layer surface size we composite

// Build the moderation image: composite onto white, downscale to ≤1024, encode JPEG as a base64
// data URL — the same payload web's canvasToDataUrl produces for the `moderate` edge function.
// Allocates + disposes its own Skia scratch surface; throws if it can't be allocated.
function toModerationDataUrl(composite: SkImage): string {
  const w = Math.max(1, Math.round(ARTBOARD * Math.min(1, 1024 / ARTBOARD)))
  const surf = Skia.Surface.Make(w, w)
  if (!surf) throw new Error('Could not allocate the moderation surface.')
  const c = surf.getCanvas()
  c.clear(Skia.Color('#ffffff')) // white bg, matching web canvasToDataUrl
  c.drawImageRect(composite, Skia.XYWHRect(0, 0, ARTBOARD, ARTBOARD), Skia.XYWHRect(0, 0, w, w), Skia.Paint())
  surf.flush?.()
  const img = surf.makeImageSnapshot()
  const b64 = img.encodeToBase64(ImageFormat.JPEG, 92)
  img.dispose()
  surf.dispose?.()
  return `data:image/jpeg;base64,${b64}`
}

/**
 * Editor shell (STEP 4) — wraps DrawCanvas with editable per-tool settings (colour/size/
 * opacity/hardness/softness/texture), instant undo/redo/clear, and up to 3 LAYERS.
 *
 * Layers are independent stacked DrawCanvas instances (each its own surface + undo) rather than
 * a reworked multi-surface canvas — RN composites the transparent canvases over a white wrap,
 * z-ordered by the layers array. Only the active layer takes pen input (active prop + the
 * non-active wrappers are pointerEvents="none", so touches fall through to the active one).
 * Undo/redo/clear route to the active layer's ref; history is tracked per layer.
 */
// Bump on every native edit batch so we can confirm on-device that the iPad loaded the fresh bundle
// (this worktree's Metro doesn't auto-watch, so stale bundles are the usual false alarm).
const BUILD = 'b28'
export function EditorScreen({ canvasId, tile, canvas, onExit }: { canvasId?: string; tile?: Tile; canvas?: Canvas; onExit?: () => void }) {
  // Founder constraints — restrict the tool bar + colour palette to what this canvas allows.
  const allowedTools = canvas?.allowedTools?.length ? TOOL_IDS.filter((t) => canvas.allowedTools.includes(t)) : TOOL_IDS
  const palette = canvas?.colorPalette ?? undefined
  const [tool, setTool] = useState<ToolId>(() => allowedTools[0] ?? 'brush')
  const [settingsMap, setSettingsMap] = useState<ToolSettingsMap>(() => {
    if (!palette?.length) return DEFAULT_SETTINGS
    const forced = palette[0] // every tool starts on a palette colour so the restriction holds before first pick
    return Object.fromEntries(TOOL_IDS.map((t) => [t, { ...DEFAULT_SETTINGS[t], color: forced }])) as ToolSettingsMap
  })
  const [layers, setLayers] = useState<LayerMeta[]>([{ id: 1, visible: true, opacity: 1 }])
  const [activeId, setActiveId] = useState(1)
  const [histById, setHistById] = useState<Record<number, { canUndo: boolean; canRedo: boolean }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false) // brush-settings sheet, hidden by default (web-style)
  const [mosaicOpen, setMosaicOpen] = useState(false) // "view the whole mosaic while drawing" (#2)
  const [bgColor, setBgColor] = useState('#ffffff') // artboard background colour (the 'BG color' tool; re-applicable)
  const [pickMode, setPickMode] = useState(false) // eyedropper: next canvas tap samples a colour (#7)
  const nextId = useRef(2)
  const layerRefs = useRef(new Map<number, DrawCanvasHandle>())

  // ── realtime live-neighbor layer ──────────────────────────────────────────
  const [userId, setUserId] = useState<string | undefined>(undefined)
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? undefined)).catch(() => {}) }, [])
  const live = useLiveNeighborsNative({
    canvasId, tileRow: tile?.row, tileCol: tile?.col,
    gridRows: canvas?.gridRows, gridCols: canvas?.gridCols, userId,
  })
  const currentStrokeId = useRef<string | null>(null)
  const onLiveStart = (st: { toolId: ToolId; settings: ToolSettings; assist: AssistSettings; seed: number; first: StrokeSample }) => {
    const bc = live.broadcaster
    if (!bc) return
    currentStrokeId.current = `${st.seed.toString(36)}-${Date.now()}`
    bc.begin({ strokeId: currentStrokeId.current, toolId: st.toolId, settings: st.settings, assist: st.assist, seed: st.seed }, st.first)
  }
  const onLiveAppend = (samples: StrokeSample[]) => { if (currentStrokeId.current) live.broadcaster?.append(samples) }
  const onLiveEnd = (ticks?: number[]) => { if (currentStrokeId.current) { live.broadcaster?.end(undefined, ticks); currentStrokeId.current = null } }

  // Static neighbor artwork (real adjacent-tile art) — fetched once for the slivers.
  const [neighborArt, setNeighborArt] = useState<Record<number, string>>({})
  useEffect(() => {
    if (!canvasId || !tile || !canvas?.gridRows || !canvas?.gridCols) return
    let cancelled = false
    ;(async () => {
      try {
        const tiles = await getTilesForCanvas(canvasId)
        const byPos = new Map(tiles.map((t) => [`${t.row}:${t.col}`, t]))
        const cells = inGridNeighbors({ row: tile.row, col: tile.col }, canvas.gridRows, canvas.gridCols)
        const out: Record<number, string> = {}
        await Promise.all(cells.map(async ({ cell, row, col }) => {
          const nt = byPos.get(`${row}:${col}`)
          if (nt?.artworkPath) {
            const uri = await tileArtworkUrl(nt.artworkPath)
            if (uri) out[cell] = uri
          }
        }))
        if (!cancelled) setNeighborArt(out)
      } catch { /* slivers just stay empty */ }
    })()
    return () => { cancelled = true }
  }, [canvasId, tile?.row, tile?.col, canvas?.gridRows, canvas?.gridCols])

  // Stage layout — measured so the artboard can be inset, leaving a sliver margin for the neighbors.
  const [wrap, setWrap] = useState({ w: 0, h: 0 })
  const onWrapLayout = (e: LayoutChangeEvent) => setWrap({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })

  // Dev-only simulation config (the harness for testing without a 2nd user).
  const [simCfg, setSimCfg] = useState(readSimConfig)
  const applySim = (patch: Partial<typeof simCfg>) => { setSimCfg((c) => ({ ...c, ...patch })); writeSimConfig(patch) }

  const s = settingsMap[tool]
  const patch = (p: Partial<ToolSettings>) => setSettingsMap((m) => ({ ...m, [tool]: { ...m[tool], ...p } }))
  // 'BG color' tool: the picked colour IS the artboard background, applied live — change it any number
  // of times (it sits behind the art and never covers strokes), unlike a one-shot pixel fill.
  useEffect(() => { if (tool === 'bucket') setBgColor(s.color) }, [tool, s.color])
  // Eyedropper: arm pick mode + hide the popover so the canvas is tappable; the next tap samples a pixel.
  const startEyedrop = () => { setPickMode(true); setSettingsOpen(false) }
  const onPickColor = (hex: string | null) => { patch({ color: hex ?? bgColor }); setPickMode(false); setSettingsOpen(true) }
  const hist = histById[activeId] ?? { canUndo: false, canRedo: false }
  const activeLayer = layers.find((L) => L.id === activeId) ?? layers[0]
  const ref = (id: number) => layerRefs.current.get(id)

  const addLayer = () => {
    if (layers.length >= 3) return
    const id = nextId.current++
    setLayers([...layers, { id, visible: true, opacity: 1 }])
    setActiveId(id)
  }
  const deleteLayer = (id: number = activeId) => {
    if (layers.length <= 1) return
    const next = layers.filter((L) => L.id !== id)
    setLayers(next)
    if (id === activeId) setActiveId(next[next.length - 1].id)
  }
  // Merge-down: composite layer `id` onto the layer directly below it (array order = z, bottom→top),
  // then drop the merged layer. Honors the source layer's opacity so the result is WYSIWYG.
  const mergeDown = (id: number) => {
    const idx = layers.findIndex((L) => L.id === id)
    if (idx <= 0) return // bottom layer has nothing beneath it
    const below = layers[idx - 1]
    const img = ref(id)?.snapshot()
    if (img) {
      ref(below.id)?.mergeImage(img)
      img.dispose()
    }
    const next = layers.filter((L) => L.id !== id)
    setLayers(next)
    setActiveId(below.id)
  }
  const toggleVisible = (id: number) =>
    setLayers((ls) => ls.map((L) => (L.id === id ? { ...L, visible: !L.visible } : L)))

  // Submit the tile artwork. Composite the VISIBLE layers (array order = z-order, bottom→top)
  // at their per-layer opacity into one transparent PNG — WYSIWYG with what's on screen, and
  // transparent-where-unpainted like the web composite (getCompositeCanvas) — then upload it to
  // the `tiles` bucket and complete_tile (which fires the mosaic reveal on the final tile).
  // Mirrors web CanvasDrawScreen.onSubmit + DrawingScreen's moderation gate: the artwork is screened
  // server-side (the `moderate` edge function) BEFORE publishing; a block aborts and keeps the work.
  const submit = async () => {
    if (!canvasId || !tile || submitting) return
    setSubmitError(null)
    setSubmitting(true)
    const snaps: SkImage[] = []
    let composite: SkImage | null = null
    try {
      const surface = Skia.Surface.Make(ARTBOARD, ARTBOARD)
      if (!surface) throw new Error('Could not allocate a canvas surface.')
      const sc = surface.getCanvas()
      sc.clear(Skia.Color('rgba(0,0,0,0)')) // fresh surfaces aren't guaranteed blank (see RNSkiaBackend.createSurface)
      // Background colour (the 'BG color' tool) — painted behind every layer. Skipped at the default
      // white so untouched tiles stay transparent (existing behaviour).
      if (bgColor.toLowerCase() !== '#ffffff') {
        const bgPaint = Skia.Paint()
        bgPaint.setColor(Skia.Color(bgColor))
        sc.drawRect(Skia.XYWHRect(0, 0, ARTBOARD, ARTBOARD), bgPaint)
      }
      const paint = Skia.Paint()
      for (const L of layers) {
        if (!L.visible) continue
        const img = ref(L.id)?.snapshot()
        if (!img) continue
        snaps.push(img)
        paint.setAlphaf(L.opacity)
        sc.drawImage(img, 0, 0, paint)
      }
      surface.flush?.()
      composite = surface.makeImageSnapshot()
      surface.dispose?.()

      // Moderation gate — screen the artwork before it's published. A block leaves the canvas
      // untouched so the user can edit and resubmit (mirrors web passesModeration()).
      const verdict = await moderateContent({ imageDataUrl: toModerationDataUrl(composite) })
      if (!verdict.allowed) {
        setSubmitError(verdict.message || GUIDELINES_MESSAGE)
        setSubmitting(false)
        return
      }

      // RN supabase-storage uploads an ArrayBuffer reliably (Blob/FormData are flaky on RN).
      // encodeToBytes returns a plain ArrayBuffer-backed array; the cast just drops the
      // SharedArrayBuffer arm of ArrayBufferLike that .slice() widens to.
      const bytes = composite.encodeToBytes() // PNG
      const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const path = await uploadTileArtwork(canvasId, tile.id, body)
      await completeTileAndMaybeReveal(canvasId, tile.id, path)
      onExit?.() // back to the grid; it reloads on mount and shows this tile completed
    } catch (e) {
      console.warn('[submit] FAILED:', e instanceof Error ? e.message : String(e))
      setSubmitError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    } finally {
      snaps.forEach((sn) => sn.dispose())
      composite?.dispose()
    }
  }
  const canSubmit = !!canvasId && !!tile

  // Exiting WITHOUT submitting = discard: release the claimed tile back to empty so it isn't left
  // stuck in-progress (and others can claim it). Confirm only when there's drawing to lose.
  const exitOrDiscard = () => {
    if (submitting) return
    if (!tile || !canvasId) { onExit?.(); return }
    const release = async () => {
      try { await releaseTile(tile.id) } catch { /* best-effort — leaving regardless */ }
      onExit?.()
    }
    const hasDrawn = Object.values(histById).some((h) => h.canUndo)
    if (!hasDrawn) { void release(); return }
    Alert.alert(
      'Discard tile?',
      "Your drawing won't be saved, and the tile will be freed for others.",
      [
        { text: 'Keep drawing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => void release() },
      ],
    )
  }

  // ── canvas zoom/pan (STEP 4) ────────────────────────────────────────────────
  // Drawing is stylus-only (DrawCanvas ignores non-pen touches), so finger gestures are free for
  // navigation: pinch to zoom, two-finger drag to pan when zoomed in. The transform is applied to
  // the whole stage (artboard + neighbor slivers); RNGH maps the pen's touch through the transform
  // so drawing stays aligned while magnified. Fit/−/+ buttons mirror the web zoom controls.
  const zScale = useSharedValue(1)
  const zSaved = useSharedValue(1)
  const zTx = useSharedValue(0)
  const zTy = useSharedValue(0)
  const zSavedTx = useSharedValue(0)
  const zSavedTy = useSharedValue(0)
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: zTx.value }, { translateY: zTy.value }, { scale: zScale.value }],
  }))
  const zoomGesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onUpdate((e) => { 'worklet'; const t = zSaved.value * e.scale; zScale.value = t < 1 ? 1 : t > 6 ? 6 : t })
      .onEnd(() => { 'worklet'; zSaved.value = zScale.value })
    const drag = Gesture.Pan()
      .minPointers(2)
      .onUpdate((e) => { 'worklet'; if (zScale.value <= 1) return; zTx.value = zSavedTx.value + e.translationX; zTy.value = zSavedTy.value + e.translationY })
      .onEnd(() => { 'worklet'; zSavedTx.value = zTx.value; zSavedTy.value = zTy.value })
    return Gesture.Simultaneous(pinch, drag)
    // shared values are stable refs — safe to build the gesture once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const resetPan = () => { zTx.value = withTiming(0); zTy.value = withTiming(0); zSavedTx.value = 0; zSavedTy.value = 0 }
  const zoomBy = (f: number) => {
    const t = Math.max(1, Math.min(6, zScale.value * f))
    zScale.value = withTiming(t); zSaved.value = t
    if (t === 1) resetPan()
  }
  const zoomFit = () => { zScale.value = withTiming(1); zSaved.value = 1; resetPan() }

  // Sliver-stage geometry (mirrors web Canvas.tsx with tilePx → inner): a centred S×S stage with the
  // artboard inset by `sliver` on all sides; the up-to-8 neighbor strips fill the margin.
  const S = Math.min(wrap.w, wrap.h)
  const sliver = Math.max(8, Math.round(S * 0.05))
  const inner = S - 2 * sliver
  const stageLeft = (wrap.w - S) / 2
  const stageTop = (wrap.h - S) / 2
  const innerOffset = inner - sliver
  const gridKnown = tile != null && canvas?.gridRows != null && canvas?.gridCols != null
  const neighborCells = gridKnown && inner > 0
    ? inGridNeighbors({ row: tile!.row, col: tile!.col }, canvas!.gridRows, canvas!.gridCols)
    : []

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border bg-background px-3 pt-3 pb-2">
        <Pressable onPress={exitOrDiscard} hitSlop={8} disabled={submitting} className="w-24 flex-row items-center gap-1.5">
          <Text className="text-[15px] font-semibold text-foreground">← Leave</Text>
          <Text className="text-[9px] font-bold text-primary">{BUILD}</Text>
        </Pressable>
        <View className="flex-1 items-center px-2">
          {canvas?.styleGuidance ? (
            <>
              <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Style rules</Text>
              <Text numberOfLines={1} className="text-xs italic text-foreground">“{canvas.styleGuidance}”</Text>
            </>
          ) : (
            <Text className="text-sm font-semibold text-muted-foreground">{tile ? `Tile · r${tile.row + 1} c${tile.col + 1}` : 'Draw'}</Text>
          )}
        </View>
        {canSubmit ? (
          <Pressable onPress={submit} disabled={submitting} hitSlop={8} className={cn('h-9 w-24 flex-row items-center justify-center gap-1.5 rounded-full bg-primary', submitting && 'opacity-50')}>
            {submitting ? <ActivityIndicator size="small" color="white" /> : <><SendIcon size={15} color="white" /><Text className="text-[13px] font-bold text-primary-foreground">Submit</Text></>}
          </Pressable>
        ) : (
          <View className="w-24" />
        )}
      </View>
      {!!submitError && <Text numberOfLines={2} className="px-3 py-1 text-center text-xs text-destructive">{submitError}</Text>}
      <View className="flex-1 overflow-hidden bg-muted" onLayout={onWrapLayout}>
        {inner > 0 && (
          <GestureDetector gesture={zoomGesture}>
            <Animated.View style={[{ position: 'absolute', left: stageLeft, top: stageTop, width: S, height: S }, zoomStyle]}>
            {/* Neighbor slivers — static adjacent-tile art + the ephemeral live layer on top. */}
            {neighborCells.map(({ cell }) => {
              const o = NEIGHBOR_OFFSETS[cell]
              const stripLeft = o.col === -1 ? 0 : o.col === 0 ? sliver : sliver + inner
              const stripTop = o.row === -1 ? 0 : o.row === 0 ? sliver : sliver + inner
              const stripW = o.col === 0 ? inner : sliver
              const stripH = o.row === 0 ? inner : sliver
              const imgOffsetLeft = o.col === -1 ? -innerOffset : 0
              const imgOffsetTop = o.row === -1 ? -innerOffset : 0
              const art = neighborArt[cell]
              return (
                <View key={cell} style={{ position: 'absolute', left: stripLeft, top: stripTop, width: stripW, height: stripH, overflow: 'hidden', backgroundColor: '#d7dce6', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(20,28,40,0.18)' }}>
                  {art && (
                    <Image
                      source={{ uri: art }}
                      style={{ position: 'absolute', left: imgOffsetLeft, top: imgOffsetTop, width: inner, height: inner }}
                      resizeMode="cover"
                    />
                  )}
                  <LiveNeighborStrip
                    cell={cell} inner={inner} stripW={stripW} stripH={stripH}
                    imgOffsetLeft={imgOffsetLeft} imgOffsetTop={imgOffsetTop} register={live.registerStrip}
                  />
                </View>
              )
            })}

            {/* Artboard — inset by `sliver`; white paper, stacked layer canvases. Green ring + drop
                shadow (mirrors the web) so the active drawing area reads as the focus. */}
            <View
              className="border-2 border-primary"
              style={{ position: 'absolute', left: sliver, top: sliver, width: inner, height: inner, backgroundColor: bgColor, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 8 }}
            >
              {layers.map((L, i) => (
                <View
                  key={L.id}
                  style={[StyleSheet.absoluteFill, { zIndex: i, opacity: L.visible ? L.opacity : 0 }]}
                  pointerEvents={L.id === activeId ? 'auto' : 'none'}
                >
                  <DrawCanvas
                    ref={(h) => { if (h) layerRefs.current.set(L.id, h); else layerRefs.current.delete(L.id) }}
                    active={L.id === activeId}
                    tool={tool}
                    settings={s}
                    picking={pickMode && L.id === activeId}
                    onPick={onPickColor}
                    blocked={settingsOpen || mosaicOpen}
                    onHistory={(h) => setHistById((m) => ({ ...m, [L.id]: h }))}
                    onLiveStart={onLiveStart}
                    onLiveAppend={onLiveAppend}
                    onLiveEnd={onLiveEnd}
                  />
                </View>
              ))}
            </View>
            </Animated.View>
          </GestureDetector>
        )}
        {/* ── Floating chrome over the canvas (web-style): Layers card · settings popover · tool dock ── */}
        <View className="absolute right-3 top-3">
          <LayersCard layers={layers} activeId={activeId} onSelect={setActiveId} onToggleVisible={toggleVisible} onAdd={addLayer} onDelete={deleteLayer} onMerge={mergeDown} />
        </View>

        {/* Zoom controls (top-left) — pinch / two-finger drag also work; mirrors the web Fit/−/+. */}
        <View className="absolute left-3 top-3 gap-1.5">
          <Pressable onPress={() => zoomBy(1.4)} hitSlop={4} className="h-11 w-11 items-center justify-center rounded-xl bg-card shadow-lg">
            <ZoomInIcon size={21} color={FG} />
          </Pressable>
          <Pressable onPress={() => zoomBy(1 / 1.4)} hitSlop={4} className="h-11 w-11 items-center justify-center rounded-xl bg-card shadow-lg">
            <ZoomOutIcon size={21} color={FG} />
          </Pressable>
          <Pressable onPress={zoomFit} hitSlop={4} className="h-11 w-11 items-center justify-center rounded-xl bg-card shadow-lg">
            <FitIcon size={20} color={FG} />
          </Pressable>
          {!!canvasId && (
            <Pressable onPress={() => setMosaicOpen(true)} hitSlop={4} className="mt-1 h-11 w-11 items-center justify-center rounded-xl bg-card shadow-lg">
              <GridIcon size={20} color={FG} />
            </Pressable>
          )}
        </View>

        {/* Settings popover — opens above the dock when you tap the active tool (web pattern).
            Contextual per-tool controls (ToolSettings) like the web; scrolls when a tool is control-heavy. */}
        {settingsOpen && (
          <View pointerEvents="box-none" className="absolute inset-x-0 bottom-[104px] items-center px-3">
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false} className="w-full max-w-md rounded-2xl bg-card shadow-lg" contentContainerClassName="gap-2 p-3">
              <ToolSettingsPanel tool={tool} settings={s} onChange={patch} palette={palette} onEyedrop={startEyedrop} />
              {simAllowed() && (
                <View className="mt-0.5 flex-row items-center gap-1.5">
                  <Text className="text-[10px] font-bold uppercase text-muted-foreground">DEV</Text>
                  <Pressable onPress={() => applySim({ enabled: !simCfg.enabled })} className={cn('rounded-lg px-2 py-1', simCfg.enabled ? 'bg-primary' : 'bg-secondary')}>
                    <Text className={cn('text-[11px] font-semibold', simCfg.enabled ? 'text-primary-foreground' : 'text-secondary-foreground')}>{simCfg.enabled ? 'sim on' : 'sim off'}</Text>
                  </Pressable>
                  <Pressable onPress={() => applySim({ mode: simCfg.mode === 'cursor' ? 'painting' : 'cursor' })} className="rounded-lg bg-secondary px-2 py-1">
                    <Text className="text-[11px] font-semibold text-secondary-foreground">{simCfg.mode}</Text>
                  </Pressable>
                  <Pressable onPress={() => applySim({ count: simCfg.count >= 8 ? 1 : simCfg.count + 1 })} className="rounded-lg bg-secondary px-2 py-1">
                    <Text className="text-[11px] font-semibold text-secondary-foreground">n {simCfg.count}</Text>
                  </Pressable>
                  <Pressable onPress={() => restartSim()} className="rounded-lg bg-secondary px-2 py-1">
                    <Text className="text-[11px] font-semibold text-secondary-foreground">redraw</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* Eyedropper armed — tell the user to tap the canvas. */}
        {pickMode && (
          <View pointerEvents="box-none" className="absolute inset-x-0 top-3 items-center">
            <Pressable onPress={() => setPickMode(false)} className="flex-row items-center gap-2 rounded-full bg-foreground/90 px-3.5 py-2 shadow-lg">
              <EyedropperIcon size={15} color="white" />
              <Text className="text-xs font-semibold text-background">Tap a colour on the canvas · tap here to cancel</Text>
            </Pressable>
          </View>
        )}

        {/* Floating tool dock — icon tools (w/ color dot) · undo/redo · clear. Tap the active tool to open
            settings. The outer ScrollView's content centers the pill when it fits (content-width, NOT
            full-width) and lets it scroll horizontally only if it ever exceeds the screen. */}
        <View pointerEvents="box-none" className="absolute inset-x-0 bottom-3 px-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
          >
            <View className="flex-row items-center gap-1 rounded-[28px] bg-card p-2 shadow-lg">
              {allowedTools.map((id) => {
                const Icon = TOOL_ICON[id]
                const active = tool === id
                const showDot = id !== 'eraser' && id !== 'smudge'
                return (
                  <Pressable key={id} onPress={() => { if (active) setSettingsOpen((o) => !o); else { setTool(id); setSettingsOpen(true) } }} className={cn('h-14 w-14 items-center justify-center rounded-2xl', active && 'bg-primary')}>
                    <Icon size={28} color={active ? 'white' : FG} />
                    {showDot && <View className="absolute bottom-2 right-2 h-3 w-3 rounded-full border border-white" style={{ backgroundColor: settingsMap[id].color }} />}
                  </Pressable>
                )
              })}
              <View className="mx-0.5 h-8 w-px bg-border" />
              <Pressable onPress={() => { ref(activeId)?.undo(); live.broadcaster?.undo() }} disabled={!hist.canUndo} className={cn('h-12 w-12 items-center justify-center rounded-2xl', !hist.canUndo && 'opacity-40')}>
                <UndoIcon size={23} color={FG} />
              </Pressable>
              <Pressable onPress={() => { ref(activeId)?.redo(); live.broadcaster?.redo() }} disabled={!hist.canRedo} className={cn('h-12 w-12 items-center justify-center rounded-2xl', !hist.canRedo && 'opacity-40')}>
                <RedoIcon size={23} color={FG} />
              </Pressable>
              <View className="mx-0.5 h-8 w-px bg-border" />
              <Pressable onPress={() => { ref(activeId)?.clear(); live.broadcaster?.clearStrokes() }} className="h-12 w-12 items-center justify-center rounded-2xl">
                <TrashIcon size={23} color={DESTRUCTIVE} />
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>

      {mosaicOpen && !!canvasId && (
        <MosaicGridSheet canvasId={canvasId} canvas={canvas} userTile={tile} onClose={() => setMosaicOpen(false)} />
      )}
    </View>
  )
}
