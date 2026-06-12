import { useEffect, useMemo, useRef } from 'react'
import { StrokeEngine, replayStroke, type InputPoint, type StrokeSample, type ModelStroke } from '@drawie/core'
import { Canvas2DBackend } from '@drawie/renderer'
import {
  createNeighborReceiver, createStrokeAssembler, createStrokeBroadcaster, startNeighborSim,
  type ActiveStroke, type NeighborReceiver, type StrokeAssembler, type StrokeBroadcaster, type SimHandle, type TileKey,
} from '@drawie/data'
import { readSimConfig, onSimConfig, onSimRestart, simAllowed } from '../lib/simConfig'

/** Tile-local artboard resolution — must match Canvas.tsx INTERNAL_SIZE and @drawie/data ARTBOARD. */
const LIVE_SIZE = 2000

/** Per-cell on-screen sliver target + its blit geometry (registered by Canvas.tsx). */
export interface SliverGeom {
  /** Source rect in the 2000² offscreen (the inner-edge band the static <img> reveals). */
  srcX: number; srcY: number; srcW: number; srcH: number
  /** Destination canvas size in CSS px (= strip width/height). */
  destW: number; destH: number
  /** Map a tile-local coord (0..2000) to dest px: dest = coord * scale + off. */
  scale: number; offX: number; offY: number
}

interface CellLayer {
  canvas: HTMLCanvasElement
  backend: Canvas2DBackend
  engines: Map<string, StrokeEngine>
}

export interface LiveNeighborsApi {
  /** Broadcaster for the local user's own in-progress stroke (null in the /draw sandbox). */
  broadcaster: StrokeBroadcaster | null
  /** Canvas registers (or clears, el=null) the on-screen sliver canvas + geometry for a cell. */
  registerSliver(cell: number, el: HTMLCanvasElement | null, geom: SliverGeom | null): void
}

function toInput(s: StrokeSample): InputPoint {
  return { x: s.x, y: s.y, pressure: s.pressure, hasPressure: s.hasPressure, t: s.t }
}

export interface UseLiveNeighborsArgs {
  canvasId?: string
  tileRow?: number
  tileCol?: number
  gridRows?: number
  gridCols?: number
  userId?: string
}

/**
 * Owns the web live-neighbor layer: subscribes to neighbor tile channels (Broadcast), replays incoming
 * strokes into a per-neighbor offscreen via the shared engine, and blits ONLY the sliver region into the
 * on-screen sliver canvases that Canvas.tsx registers. Also exposes a broadcaster for the local user's
 * outgoing strokes, and (dev only) drives the simulation harness through the SAME dispatch path.
 *
 * Inert (no subscribe / no broadcast) in the /draw sandbox where canvasId/tile coords are absent.
 */
export function useLiveNeighbors(args: UseLiveNeighborsArgs): LiveNeighborsApi {
  const { canvasId, tileRow, tileCol, gridRows, gridCols, userId } = args
  const enabled =
    canvasId != null && tileRow != null && tileCol != null && gridRows != null && gridCols != null

  const cellsRef = useRef<Map<number, CellLayer>>(new Map())
  const sliversRef = useRef<Map<number, { ctx: CanvasRenderingContext2D; geom: SliverGeom }>>(new Map())
  const cursorsRef = useRef<Array<{ cell: number; x: number; y: number }>>([])
  const rafRef = useRef<number | null>(null)
  const broadcasterRef = useRef<StrokeBroadcaster | null>(null)

  // Stable API object (refs inside stay current across renders).
  const api = useMemo<LiveNeighborsApi>(() => ({
    get broadcaster() { return broadcasterRef.current },
    registerSliver(cell, el, geom) {
      if (!el || !geom) { sliversRef.current.delete(cell); return }
      const ctx = el.getContext('2d')
      if (ctx) sliversRef.current.set(cell, { ctx, geom })
    },
  }), [])

  useEffect(() => {
    // Sandbox mode (DEV only): the /draw sandbox has no tile, but we still want to demo the simulator
    // without any backend. It runs the assembler + sim locally (NO channels, NO broadcaster) against a
    // synthetic centre tile so all 8 neighbors are in-grid.
    const sandbox = !enabled && simAllowed()
    if (!enabled && !sandbox) return
    const self: TileKey = enabled
      ? { canvasId: canvasId!, row: tileRow!, col: tileCol! }
      : { canvasId: 'sandbox', row: 1, col: 1 }
    const gRows = enabled ? gridRows! : 3
    const gCols = enabled ? gridCols! : 3
    const senderId = userId ?? `web-${Math.random().toString(36).slice(2, 9)}`

    const cells = cellsRef.current
    let dirty = false // a sliver layer changed and needs re-blitting
    const ensureCell = (cell: number): CellLayer => {
      let layer = cells.get(cell)
      if (!layer) {
        const canvas = document.createElement('canvas')
        canvas.width = LIVE_SIZE
        canvas.height = LIVE_SIZE
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        layer = { canvas, backend: new Canvas2DBackend(ctx), engines: new Map() }
        cells.set(cell, layer)
      }
      return layer
    }
    // Mark the sliver layer changed so the next frame re-blits it. The content PERSISTS — neighbors'
    // strokes stay visible until they undo/clear or this editor closes (no time-based fade).
    const touch = (_cell: number) => { dirty = true; ensureRaf() }

    const handlers = {
      onStart(s: ActiveStroke) {
        const layer = ensureCell(s.cell)
        const eng = new StrokeEngine(layer.backend, s.toolId, s.settings, s.assist, s.seed)
        eng.begin(toInput(s.samples[0]))
        for (let i = 1; i < s.samples.length; i++) eng.extend(toInput(s.samples[i]))
        layer.engines.set(s.key, eng)
        touch(s.cell)
      },
      onAppend(s: ActiveStroke, newSamples: StrokeSample[]) {
        const eng = cells.get(s.cell)?.engines.get(s.key)
        if (!eng) return
        for (const ns of newSamples) eng.extend(toInput(ns))
        touch(s.cell)
      },
      onEnd(s: ActiveStroke) {
        const eng = cells.get(s.cell)?.engines.get(s.key)
        eng?.end()
        cells.get(s.cell)?.engines.delete(s.key)
        touch(s.cell)
      },
      onRerender(cell: number, strokes: ModelStroke[]) {
        // History changed on the drawer's side — rebuild this cell from the remaining strokes.
        const layer = cells.get(cell)
        if (!layer) return
        layer.engines.clear() // undo/redo/clear happen between strokes; drop any stale in-progress engine
        layer.backend.clear()
        for (const st of strokes) replayStroke(layer.backend, st)
        touch(cell)
      },
    }

    // Real tile → subscribe to neighbor channels + broadcast outgoing. Sandbox → local assembler only
    // (no network, no broadcaster) so the simulator can run with zero backend.
    const receiver: NeighborReceiver | null = enabled ? createNeighborReceiver(self, gRows, gCols, handlers) : null
    const assembler: StrokeAssembler = receiver ?? createStrokeAssembler({ row: self.row, col: self.col }, handlers)
    if (enabled) broadcasterRef.current = createStrokeBroadcaster(self, senderId)

    // ── dev simulation harness (cannot run in prod: simAllowed() === import.meta.env.DEV, and
    //    startNeighborSim hard-returns inert unless dev:true) ──
    let sim: SimHandle | null = null
    let offSimCfg: (() => void) | null = null
    let offSimRestart: (() => void) | null = null
    if (simAllowed()) {
      const make = () => startNeighborSim({
        dev: true, dispatch: assembler.dispatch, self, gridRows: gRows, gridCols: gCols,
        mode: readSimConfig().mode, neighborCount: readSimConfig().count, seed: 0x1234abcd,
      })
      if (readSimConfig().enabled) sim = make()
      offSimCfg = onSimConfig((c) => {
        if (c.enabled && !sim) { sim = make(); ensureRaf() }
        else if (!c.enabled && sim) { sim.dispose(); sim = null }
        else if (sim) { sim.setMode(c.mode); sim.setNeighborCount(c.count) }
      })
      offSimRestart = onSimRestart(() => sim?.restart())
    }

    function clearAllSlivers() {
      for (const { ctx, geom } of sliversRef.current.values()) ctx.clearRect(0, 0, geom.destW, geom.destH)
    }

    // The blit loop runs only while there's a change to render (dirty) or the sim animates cursors;
    // when it goes idle it STOPS but leaves the sliver canvases intact, so the neighbors' strokes stay
    // on screen (no fade). A later change re-arms it via touch()→ensureRaf().
    function frame() {
      const wasDirty = dirty
      dirty = false
      cursorsRef.current = sim ? sim.getCursors().map((c) => ({ cell: c.cell, x: c.x, y: c.y })) : []

      for (const [cell, { ctx, geom }] of sliversRef.current) {
        ctx.clearRect(0, 0, geom.destW, geom.destH)
        const l = cells.get(cell)
        if (l) ctx.drawImage(l.canvas, geom.srcX, geom.srcY, geom.srcW, geom.srcH, 0, 0, geom.destW, geom.destH)
        // Fake-cursor dot (sim only).
        for (const cur of cursorsRef.current) {
          if (cur.cell !== cell) continue
          const dx = cur.x * geom.scale + geom.offX
          const dy = cur.y * geom.scale + geom.offY
          if (dx < -4 || dy < -4 || dx > geom.destW + 4 || dy > geom.destH + 4) continue
          ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(124,140,255,0.95)'; ctx.fill()
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke()
        }
      }

      if (sim != null || wasDirty || dirty) rafRef.current = requestAnimationFrame(frame)
      else rafRef.current = null // idle: stop, but keep the slivers' content on screen
    }
    function ensureRaf() {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(frame)
    }
    if (sim) ensureRaf()

    return () => {
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      offSimCfg?.()
      offSimRestart?.()
      sim?.dispose()
      receiver?.dispose()
      broadcasterRef.current?.dispose()
      broadcasterRef.current = null
      for (const l of cells.values()) for (const e of l.engines.values()) { try { e.end() } catch { /* noop */ } }
      cells.clear()
      clearAllSlivers()
    }
  }, [enabled, canvasId, tileRow, tileCol, gridRows, gridCols, userId])

  return api
}
