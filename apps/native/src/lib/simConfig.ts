// Dev-only config for the neighbor live-drawing SIMULATION harness (native). In-memory + listener so
// the dev control (EditorScreen) and the hook (useLiveNeighborsNative) share state. HARD prod gate:
// simAllowed() === __DEV__, false in release builds, so the simulator can never run in production.

import type { SimMode } from '@drawie/data'

declare const __DEV__: boolean

export interface SimConfig {
  enabled: boolean
  mode: SimMode
  count: number
}

export function simAllowed(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__
}

let state: SimConfig = { enabled: false, mode: 'cursor', count: 3 }
const listeners = new Set<(c: SimConfig) => void>()
const restartListeners = new Set<() => void>()

export function readSimConfig(): SimConfig {
  return state
}

export function writeSimConfig(patch: Partial<SimConfig>): void {
  if (!simAllowed()) return
  state = { ...state, ...patch, count: Math.max(1, Math.min(8, patch.count ?? state.count)) }
  listeners.forEach((l) => l(state))
}

export function onSimConfig(cb: (c: SimConfig) => void): () => void {
  if (!simAllowed()) return () => {}
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function restartSim(): void {
  if (!simAllowed()) return
  restartListeners.forEach((l) => l())
}

export function onSimRestart(cb: () => void): () => void {
  if (!simAllowed()) return () => {}
  restartListeners.add(cb)
  return () => restartListeners.delete(cb)
}
