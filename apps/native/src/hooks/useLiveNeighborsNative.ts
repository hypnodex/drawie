import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  createNeighborReceiver, createStrokeBroadcaster, startNeighborSim,
  type NeighborReceiver, type StrokeBroadcaster, type SimHandle, type TileKey,
} from '@drawie/data'
import type { StripHandle } from '../render/LiveNeighborStrip'
import { readSimConfig, onSimConfig, onSimRestart, simAllowed } from '../lib/simConfig'

// A neighbor's live strokes PERSIST until they undo/clear or this editor closes (no short fade). We
// only reclaim a cell's 2000² surface after it's been quiet for a long time, as a memory safety net.
const IDLE_MS = 180000

export interface LiveNeighborsNativeApi {
  /** Broadcaster for the local user's in-progress stroke (null when there's no tile context). */
  broadcaster: StrokeBroadcaster | null
  /** Each LiveNeighborStrip registers (or clears) its imperative handle here. */
  registerStrip(cell: number, handle: StripHandle | null): void
}

export interface UseLiveNeighborsNativeArgs {
  canvasId?: string
  tileRow?: number
  tileCol?: number
  gridRows?: number
  gridCols?: number
  userId?: string
}

/**
 * Native counterpart of the web useLiveNeighbors hook: subscribes to neighbor tile channels, routes
 * assembled strokes to the matching LiveNeighborStrip (which replays them through the shared engine),
 * exposes a broadcaster for the local user's outgoing strokes, and (dev only) drives the simulation
 * harness through the SAME dispatch path. Inert when there's no tile context.
 */
export function useLiveNeighborsNative(args: UseLiveNeighborsNativeArgs): LiveNeighborsNativeApi {
  const { canvasId, tileRow, tileCol, gridRows, gridCols, userId } = args
  const enabled =
    canvasId != null && tileRow != null && tileCol != null && gridRows != null && gridCols != null

  const stripsRef = useRef<Map<number, StripHandle>>(new Map())
  const broadcasterRef = useRef<StrokeBroadcaster | null>(null)

  const registerStrip = useCallback((cell: number, handle: StripHandle | null) => {
    if (handle) stripsRef.current.set(cell, handle)
    else stripsRef.current.delete(cell)
  }, [])

  const api = useMemo<LiveNeighborsNativeApi>(() => ({
    get broadcaster() { return broadcasterRef.current },
    registerStrip,
  }), [registerStrip])

  useEffect(() => {
    if (!enabled) return
    const self: TileKey = { canvasId: canvasId!, row: tileRow!, col: tileCol! }
    const senderId = userId ?? `native-${Math.random().toString(36).slice(2, 9)}`
    const strips = stripsRef.current

    const receiver: NeighborReceiver = createNeighborReceiver(self, gridRows!, gridCols!, {
      onStart(s) { strips.get(s.cell)?.onStart(s) },
      onAppend(s, n) { strips.get(s.cell)?.onAppend(s, n) },
      onEnd(s) { strips.get(s.cell)?.onEnd(s) },
      onRerender(cell, strokes) { strips.get(cell)?.rerender(strokes) },
    })

    broadcasterRef.current = createStrokeBroadcaster(self, senderId)

    // ── dev simulation harness (cannot run in prod: simAllowed() === __DEV__, and startNeighborSim
    //    hard-returns inert unless dev:true) ──
    let sim: SimHandle | null = null
    let offCfg: (() => void) | null = null
    let offRestart: (() => void) | null = null
    if (simAllowed()) {
      const make = () => startNeighborSim({
        dev: true, dispatch: receiver.dispatch, self, gridRows: gridRows!, gridCols: gridCols!,
        mode: readSimConfig().mode, neighborCount: readSimConfig().count, seed: 0x1234abcd,
      })
      if (readSimConfig().enabled) sim = make()
      offCfg = onSimConfig((c) => {
        if (c.enabled && !sim) sim = make()
        else if (!c.enabled && sim) { sim.dispose(); sim = null }
        else if (sim) { sim.setMode(c.mode); sim.setNeighborCount(c.count) }
      })
      offRestart = onSimRestart(() => sim?.restart())
    }

    // Idle sweep — free a neighbor's surface once its live strokes have gone quiet.
    const sweep = setInterval(() => {
      const now = Date.now()
      for (const h of strips.values()) {
        const last = h.lastActivity()
        if (last > 0 && now - last > IDLE_MS) h.clearAll()
      }
    }, 1500)

    return () => {
      clearInterval(sweep)
      offCfg?.()
      offRestart?.()
      sim?.dispose()
      receiver.dispose()
      broadcasterRef.current?.dispose()
      broadcasterRef.current = null
    }
  }, [enabled, canvasId, tileRow, tileCol, gridRows, gridCols, userId])

  return api
}
