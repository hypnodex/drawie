import { useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { Canvas, Image, Skia, type SkImage } from '@shopify/react-native-skia'
import { useSharedValue } from 'react-native-reanimated'
import { StrokeEngine, replayStroke, type InputPoint, type StrokeSample, type ModelStroke } from '@drawie/core'
import type { ActiveStroke } from '@drawie/data'
import { RNSkiaBackend } from './RNSkiaBackend'

/** Tile-local artboard resolution — must match DrawCanvas ARTBOARD / Canvas.tsx INTERNAL_SIZE. */
const LIVE_SIZE = 2000

function toInput(s: StrokeSample): InputPoint {
  return { x: s.x, y: s.y, pressure: s.pressure, hasPressure: s.hasPressure, t: s.t }
}

/** Imperative surface the receiver drives for one neighbor cell. */
export interface StripHandle {
  onStart(s: ActiveStroke): void
  onAppend(s: ActiveStroke, newSamples: StrokeSample[]): void
  onEnd(s: ActiveStroke): void
  /** Re-render from the given committed strokes (drawer undid/redid/cleared). */
  rerender(strokes: ModelStroke[]): void
  clearAll(): void
  lastActivity(): number
}

interface Props {
  cell: number
  /** Artboard display size (px) — the neighbor tile is drawn at this scale, then clipped to the strip. */
  inner: number
  stripW: number
  stripH: number
  /** Reveal offset (px) so the strip shows the neighbor's inner edge (mirrors web imgOffset). */
  imgOffsetLeft: number
  imgOffsetTop: number
  register: (cell: number, handle: StripHandle | null) => void
}

/**
 * Transient live layer for ONE neighbor cell. Replays incoming strokes (via the shared engine) into an
 * offscreen 2000² Skia surface and displays only the sliver region — the same inner-edge band the static
 * <Image> reveals. Strictly ephemeral: never composited into the user's tile. The 2000² surface is
 * allocated lazily on first activity and freed on idle/unmount to bound memory.
 *
 * RN-Skia discipline (ported from DrawCanvas): `alive` guards an in-flight snapshot rAF against a
 * disposed surface; display snapshots are coalesced to ≤1/frame with the frame-before image disposed.
 */
export function LiveNeighborStrip({ cell, inner, stripW, stripH, imgOffsetLeft, imgOffsetTop, register }: Props) {
  const image = useSharedValue<SkImage | null>(null)
  const backendRef = useRef<RNSkiaBackend | null>(null)
  const engines = useRef<Map<string, StrokeEngine>>(new Map())
  const lastActivityRef = useRef(0)

  const alive = useRef(true)
  const displayScheduled = useRef(false)
  const prevDisplay = useRef<SkImage | null>(null)

  const ensureBackend = useCallback(() => {
    if (!backendRef.current) {
      const surface = Skia.Surface.Make(LIVE_SIZE, LIVE_SIZE)
      if (!surface) return null
      backendRef.current = new RNSkiaBackend(surface, true)
    }
    return backendRef.current
  }, [])

  const scheduleDisplay = useCallback(() => {
    if (displayScheduled.current) return
    displayScheduled.current = true
    requestAnimationFrame(() => {
      displayScheduled.current = false
      const backend = backendRef.current
      if (!alive.current || !backend) return
      backend.flush()
      const snap = backend.surface.makeImageSnapshot()
      const toDispose = prevDisplay.current
      prevDisplay.current = image.value
      image.value = snap
      toDispose?.dispose()
    })
  }, [image])

  const clearAll = useCallback(() => {
    for (const e of engines.current.values()) { try { e.end() } catch { /* already ended */ } }
    engines.current.clear()
    const old = image.value
    image.value = null
    prevDisplay.current?.dispose()
    prevDisplay.current = null
    old?.dispose()
    backendRef.current?.dispose()
    backendRef.current = null
    lastActivityRef.current = 0
  }, [image])

  const handle = useMemo<StripHandle>(() => ({
    onStart(s) {
      const backend = ensureBackend()
      if (!backend) return
      const eng = new StrokeEngine(backend, s.toolId, s.settings, s.assist, s.seed)
      eng.begin(toInput(s.samples[0]))
      for (let i = 1; i < s.samples.length; i++) eng.extend(toInput(s.samples[i]))
      engines.current.set(s.key, eng)
      lastActivityRef.current = Date.now()
      scheduleDisplay()
    },
    onAppend(s, newSamples) {
      const eng = engines.current.get(s.key)
      if (!eng) return
      for (const ns of newSamples) eng.extend(toInput(ns))
      lastActivityRef.current = Date.now()
      scheduleDisplay()
    },
    onEnd(s) {
      const eng = engines.current.get(s.key)
      try { eng?.end() } catch { /* noop */ }
      engines.current.delete(s.key)
      lastActivityRef.current = Date.now()
      scheduleDisplay()
    },
    rerender(strokes) {
      for (const e of engines.current.values()) { try { e.end() } catch { /* noop */ } }
      engines.current.clear()
      const backend = strokes.length ? ensureBackend() : backendRef.current
      if (!backend) return
      backend.clear()
      for (const st of strokes) replayStroke(backend, st)
      lastActivityRef.current = Date.now()
      scheduleDisplay()
    },
    clearAll,
    lastActivity: () => lastActivityRef.current,
  }), [ensureBackend, scheduleDisplay, clearAll])

  useEffect(() => {
    register(cell, handle)
    return () => {
      register(cell, null)
      alive.current = false
      for (const e of engines.current.values()) { try { e.end() } catch { /* noop */ } }
      engines.current.clear()
      image.value?.dispose?.()
      prevDisplay.current?.dispose?.()
      backendRef.current?.dispose()
      backendRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, handle])

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image image={image} x={imgOffsetLeft} y={imgOffsetTop} width={inner} height={inner} fit="fill" />
    </Canvas>
  )
}
