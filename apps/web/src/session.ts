import type { AssistSettings, ToolId, ToolSettingsMap, DrawDocument } from '@drawie/core'

/**
 * Lightweight session persistence to localStorage. As of Phase 3 a draft stores
 * the **vector document model** (`document`) — small, resolution-independent, and
 * re-renderable. Legacy drafts that stored layer canvases as WebP data URLs
 * (`layers`) are still read: they paint as a flattened background (their strokes
 * cannot be re-derived). Anything regenerable from defaults is not persisted.
 */

/** Legacy single-canvas key. The drawing screen now accepts a per-tile key
 *  (e.g. `drawie.tile.<tileId>.session.v1`) and falls back to this one when
 *  no key is provided (covers the standalone /draw playground). */
export const DEFAULT_SESSION_KEY = 'drawie.session.v1'

export interface SavedLayer {
  id: string
  name: string
  visible: boolean
  dataURL: string
}

export interface SavedSession {
  /** Vector model (preferred, Phase 3+). */
  document?: DrawDocument
  /** Legacy raster layers (WebP data URLs). Read-only fallback for old drafts. */
  layers?: SavedLayer[]
  activeLayerId: string
  tool: ToolId
  settingsMap: ToolSettingsMap
  secondaryColor: string
  recentColors: string[]
  assist: AssistSettings
  theme: 'dark' | 'light'
  timeRemainingSec: number
  savedAt: number
}

export function saveSession(s: SavedSession, key: string = DEFAULT_SESSION_KEY): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(s))
    return true
  } catch (e) {
    console.warn('Drawie: save failed —', e)
    return false
  }
}

export function loadSession(key: string = DEFAULT_SESSION_KEY): SavedSession | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as SavedSession
  } catch {
    return null
  }
}

export function clearSession(key: string = DEFAULT_SESSION_KEY) {
  try { localStorage.removeItem(key) } catch {}
}

export function formatTimer(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(t / 60)
  const s = t % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
