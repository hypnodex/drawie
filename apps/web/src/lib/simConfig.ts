// Dev-only configuration for the neighbor live-drawing SIMULATION harness. Lets the dev panel
// (DrawingScreen) and the live-neighbor hook (Canvas) share state without prop threading: the panel
// writes localStorage + emits an event; the hook reads + subscribes.
//
// HARD prod gate: `simAllowed()` is false unless this is a dev build, so the simulator can never be
// enabled in production (import.meta.env.DEV is statically false in prod → these branches drop).

import type { SimMode } from '@drawie/data'

export interface SimConfig {
  enabled: boolean
  mode: SimMode
  count: number
}

const LS_KEY = 'drawie.simNeighbors'
const EVENT = 'drawie:simconfig'
const RESTART_EVENT = 'drawie:simrestart'

/** Dev builds only. In a production bundle this is statically false → the simulator tree-shakes out. */
export function simAllowed(): boolean {
  return !!import.meta.env.DEV
}

/** Read the current sim config. `enabled` also honours `?simulateNeighbors=1` for a one-shot enable. */
export function readSimConfig(): SimConfig {
  const fallback: SimConfig = { enabled: false, mode: 'cursor', count: 3 }
  if (!simAllowed()) return fallback
  let stored: Partial<SimConfig> = {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) stored = JSON.parse(raw)
  } catch { /* ignore malformed */ }
  const urlOn = new URLSearchParams(window.location.search).get('simulateNeighbors') === '1'
  return {
    enabled: urlOn || !!stored.enabled,
    mode: stored.mode === 'painting' ? 'painting' : 'cursor',
    count: Math.max(1, Math.min(8, stored.count ?? 3)),
  }
}

/** Persist a partial config change and notify subscribers. No-op outside dev. */
export function writeSimConfig(patch: Partial<SimConfig>): void {
  if (!simAllowed()) return
  const next = { ...readSimConfig(), ...patch }
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent<SimConfig>(EVENT, { detail: next }))
}

/** Subscribe to config changes (dev only). Returns an unsubscribe fn. */
export function onSimConfig(cb: (c: SimConfig) => void): () => void {
  if (!simAllowed()) return () => {}
  const handler = (e: Event) => cb((e as CustomEvent<SimConfig>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

/** Fire the "redraw" action — re-seed + restart the running simulation. */
export function restartSim(): void {
  if (!simAllowed()) return
  window.dispatchEvent(new Event(RESTART_EVENT))
}

/** Subscribe to restart requests (dev only). Returns an unsubscribe fn. */
export function onSimRestart(cb: () => void): () => void {
  if (!simAllowed()) return () => {}
  window.addEventListener(RESTART_EVENT, cb)
  return () => window.removeEventListener(RESTART_EVENT, cb)
}
