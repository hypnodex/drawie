import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, Pressable, ScrollView, ActivityIndicator, Alert, Image, type LayoutChangeEvent } from 'react-native'
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
import { Slider } from './ui/Slider'
import { ColorPalette } from './ui/ColorPalette'
import { TexturePicker } from './ui/TexturePicker'
import { LayersPanel, type LayerMeta } from './ui/LayersPanel'
import { Text } from './components/ui/text'
import { cn } from './lib/cn'

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
  const hist = histById[activeId] ?? { canUndo: false, canRedo: false }
  const activeLayer = layers.find((L) => L.id === activeId) ?? layers[0]
  const ref = (id: number) => layerRefs.current.get(id)

  const addLayer = () => {
    if (layers.length >= 3) return
    const id = nextId.current++
    setLayers([...layers, { id, visible: true, opacity: 1 }])
    setActiveId(id)
  }
  const deleteLayer = () => {
    if (layers.length <= 1) return
    const next = layers.filter((L) => L.id !== activeId)
    setLayers(next)
    setActiveId(next[next.length - 1].id)
  }
  const toggleVisible = (id: number) =>
    setLayers((ls) => ls.map((L) => (L.id === id ? { ...L, visible: !L.visible } : L)))
  const setLayerOpacity = (v: number) =>
    setLayers((ls) => ls.map((L) => (L.id === activeId ? { ...L, opacity: v } : L)))

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
      <View className="flex-row items-center justify-between border-b border-border px-3.5 pt-3.5 pb-1.5">
        <Pressable onPress={exitOrDiscard} hitSlop={8} disabled={submitting} className="w-[60px]">
          <Text className="text-[15px] font-semibold text-primary">‹ Tiles</Text>
        </Pressable>
        <Text className="text-sm font-semibold text-muted-foreground">{tile ? `Tile · r${tile.row + 1} c${tile.col + 1}` : 'Draw'}</Text>
        {canSubmit ? (
          <Pressable onPress={submit} disabled={submitting} hitSlop={8} className={cn('h-8 min-w-[60px] items-center justify-center rounded-2xl bg-primary px-3.5', submitting && 'opacity-50')}>
            {submitting ? <ActivityIndicator size="small" color="white" /> : <Text className="text-[13px] font-bold text-primary-foreground">Submit</Text>}
          </Pressable>
        ) : (
          <View className="w-[60px]" />
        )}
      </View>
      {!!submitError && <Text numberOfLines={2} className="px-3 py-1 text-center text-xs text-destructive">{submitError}</Text>}
      {!!canvas?.styleGuidance && <Text numberOfLines={2} className="px-4 pt-1 text-center text-xs italic text-muted-foreground">“{canvas.styleGuidance}”</Text>}
      <View className="flex-1 bg-muted" onLayout={onWrapLayout}>
        {inner > 0 && (
          <View style={{ position: 'absolute', left: stageLeft, top: stageTop, width: S, height: S }}>
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
                <View key={cell} style={{ position: 'absolute', left: stripLeft, top: stripTop, width: stripW, height: stripH, overflow: 'hidden', backgroundColor: '#eceef3' }}>
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

            {/* Artboard — inset by `sliver`; white paper, stacked layer canvases. */}
            <View style={{ position: 'absolute', left: sliver, top: sliver, width: inner, height: inner, backgroundColor: '#fff' }}>
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
                    onHistory={(h) => setHistById((m) => ({ ...m, [L.id]: h }))}
                    onLiveStart={onLiveStart}
                    onLiveAppend={onLiveAppend}
                    onLiveEnd={onLiveEnd}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ── Brush-settings sheet — toggled by the dock's "Brush" button; hidden by default so the
            canvas gets full space (web-style: settings live in a popover, not always on screen). ── */}
      {settingsOpen && (
        <View className="gap-2 border-t border-border bg-card px-3 pt-3 pb-2 shadow-lg">
          <ColorPalette color={s.color} onChange={(c) => patch({ color: c })} palette={palette} />
          <Slider label="Size" value={s.size} min={1} max={120} onChange={(v) => patch({ size: v })} />
          <Slider label="Opacity" value={s.opacity} min={0.05} max={1} step={0.01} onChange={(v) => patch({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Hardness" value={s.hardness} min={0} max={1} step={0.01} onChange={(v) => patch({ hardness: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Softness" value={s.softness} min={0} max={1} step={0.01} onChange={(v) => patch({ softness: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <TexturePicker value={s.texture} onChange={(t) => patch({ texture: t })} />
          <LayersPanel layers={layers} activeId={activeId} onSelect={setActiveId} onToggleVisible={toggleVisible} onAdd={addLayer} onDelete={deleteLayer} />
          <Slider label="Layer α" value={activeLayer.opacity} min={0} max={1} step={0.01} onChange={setLayerOpacity} format={(v) => `${Math.round(v * 100)}%`} />
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
        </View>
      )}

      {/* ── Tool dock — always visible, compact: undo/redo · tools (scroll) · Brush(settings) · Clear ── */}
      <View className="flex-row items-center gap-1.5 border-t border-border bg-muted px-2 pt-2 pb-7">
        <Pressable onPress={() => { ref(activeId)?.undo(); live.broadcaster?.undo() }} disabled={!hist.canUndo} className={cn('h-9 w-9 items-center justify-center rounded-full bg-secondary', !hist.canUndo && 'opacity-[0.35]')}>
          <Text className="text-lg font-bold text-foreground">↶</Text>
        </Pressable>
        <Pressable onPress={() => { ref(activeId)?.redo(); live.broadcaster?.redo() }} disabled={!hist.canRedo} className={cn('h-9 w-9 items-center justify-center rounded-full bg-secondary', !hist.canRedo && 'opacity-[0.35]')}>
          <Text className="text-lg font-bold text-foreground">↷</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1" contentContainerClassName="items-center gap-1.5 px-1">
          {allowedTools.map((id) => (
            <Pressable key={id} onPress={() => setTool(id)} className={cn('rounded-full px-3.5 py-2', tool === id ? 'bg-primary' : 'bg-secondary')}>
              <Text className={cn('text-[13px]', tool === id ? 'font-semibold text-primary-foreground' : 'text-secondary-foreground')}>{id}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={() => setSettingsOpen((o) => !o)} className={cn('h-9 flex-row items-center gap-1.5 rounded-full px-3', settingsOpen ? 'bg-primary' : 'bg-secondary')}>
          <View className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: s.color }} />
          <Text className={cn('text-[13px] font-semibold', settingsOpen ? 'text-primary-foreground' : 'text-secondary-foreground')}>Brush</Text>
        </Pressable>
        <Pressable onPress={() => { ref(activeId)?.clear(); live.broadcaster?.clearStrokes() }} className="h-9 items-center justify-center rounded-full bg-destructive px-3.5">
          <Text className="text-[13px] font-semibold text-destructive-foreground">Clear</Text>
        </Pressable>
      </View>
    </View>
  )
}
