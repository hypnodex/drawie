/**
 * Product-level domain types — separate from the drawing-engine types in
 * `../types.ts` so the drawing prototype stays self-contained.
 */

import type { ToolId } from '@drawie/core'

export type UserId = string
export type CanvasId = string
export type TileId = string

// ── Users ───────────────────────────────────────────────────────────────

export interface User {
  id: UserId
  name: string
  avatar: string           // hex background for the initials fallback
  photoUrl?: string        // optional portrait — when present, HeroUI Avatar.Image
                           // renders the photo and Avatar.Fallback (initial) only
                           // shows while loading or on error
  isPremium: boolean
  completedTilesCount: number
  savedCanvasIds: CanvasId[]
  draftTileIds: TileId[]
  contributedCanvasIds: CanvasId[]
}

export const COMPLETED_TILES_REQUIRED_TO_FOUND = 5

/**
 * The "one drawing per artboard per user" rule. Default **true** (production-safe): one tile
 * per artist per canvas. Each app overrides at startup from its OWN env (defaulting to true):
 *   - web    → VITE_ENFORCE_ONE_TILE_PER_USER        (apps/web/src/main.tsx)
 *   - native → EXPO_PUBLIC_ENFORCE_ONE_TILE_PER_USER (apps/native/src/supabase.ts)
 * Set the env to "false" in dev/test for fast single-account multi-tile testing.
 *
 * Injected via setEnforceOneTilePerUser() so this module stays free of `import.meta` (Metro
 * can't parse it) — mirroring the `dataDebug` live-flag pattern in supabase.ts.
 *
 * NOTE: this FRONTEND flag is only the UX guard. The AUTHORITATIVE rule is the `claim_tile` RPC:
 * the prod migration chain enforces one-tile (20260615000000_claim_tile_one_per_user); the
 * multi-tile relaxation is test-only (supabase/dev/claim_tile_allow_multiple.dev.sql).
 */
export let ENFORCE_ONE_TILE_PER_USER = true
export function setEnforceOneTilePerUser(on: boolean): void {
  ENFORCE_ONE_TILE_PER_USER = on
}

export interface Entitlement {
  userId: UserId
  isPremium: boolean
  canCreateCanvas: boolean
  canUseLargeNeighborPreview: boolean
  canExport4K: boolean
  remainingTilesToFound: number   // 0 if already eligible
}

export function computeEntitlement(user: User): Entitlement {
  const remaining = Math.max(
    0,
    COMPLETED_TILES_REQUIRED_TO_FOUND - user.completedTilesCount,
  )
  return {
    userId: user.id,
    isPremium: user.isPremium,
    canCreateCanvas: user.isPremium || remaining === 0,
    canUseLargeNeighborPreview: user.isPremium,
    canExport4K: user.isPremium,
    remainingTilesToFound: remaining,
  }
}

// ── Canvases ────────────────────────────────────────────────────────────

export type CanvasStatus = 'open' | 'almost-complete' | 'completed' | 'locked'

export interface CanvasConfig {
  gridRows: number
  gridCols: number
  /** Empty array = all tools allowed. */
  allowedTools: ToolId[]
  /** Explicit denylist on top of allowedTools, mainly for UX clarity. */
  disallowedTools?: ToolId[]
  /** null = any color; otherwise restrict color picker to these swatches. */
  colorPalette: string[] | null
  background: string                              // hex or 'transparent'
  styleGuidance: string
  participationMode: 'free-pick' | 'random'
  visibility: 'public' | 'private-link'
  /** Tunable by founder; premium users also get the large variant. */
  neighborPreviewSize: 'small' | 'large'
}

export interface Canvas extends CanvasConfig {
  id: CanvasId
  title: string
  description: string
  founderId: UserId
  founderName: string
  category: string
  topic: string
  style: string
  totalTiles: number
  completedTiles: number
  activeContributors: number
  status: CanvasStatus
  isTrending: boolean
  createdAt: string                              // ISO timestamp
  completedAt?: string
  previewGradient: string                         // CSS gradient string — cheap "thumbnail"
  finalGradient?: string
  /** Optional finished-artwork image URL. When set, the MosaicPreview
   *  renders this image instead of the procedural mock canvas for completed
   *  canvases. Served from /public, e.g. '/completed/1.jpg'. */
  artworkUrl?: string
  discussionCount: number

  // ── Private canvas (link-only, premium) ────────────────────────────────
  /** Number of drawing participants requested at creation (host excluded).
   *  Only set on private-link canvases. */
  participantCount?: number
  /** Opaque tokens embedded in the shareable links. Presence of these marks a
   *  link-only private canvas. The guest token is for participants, the host
   *  token grants the management console. */
  guestToken?: string
  hostToken?: string
}

// ── Tiles ───────────────────────────────────────────────────────────────

export type TileStatus = 'empty' | 'in-progress' | 'completed'

export interface Tile {
  id: TileId
  canvasId: CanvasId
  row: number
  col: number
  status: TileStatus
  assignedUserId?: UserId
  contributorName?: string
  startedAt?: string
  completedAt?: string
  /** Storage path of the composited tile artwork (bucket `tiles`), when drawn. */
  artworkPath?: string
}

// ── Notifications ──────────────────────────────────────────────────────

export type NotificationType = 'canvas-completed'

export interface Notification {
  /** Stable id derived from `${type}:${canvasId}` so re-deriving from data is idempotent. */
  id: string
  type: NotificationType
  canvasId: CanvasId
  canvasTitle: string
  /** ISO timestamp of the underlying event (canvas completed-at, etc.). */
  createdAt: string
  read: boolean
}

// ── Comments (skeleton, no compose UI in MVP) ──────────────────────────

export interface Comment {
  id: string
  canvasId: CanvasId
  userId: UserId
  userName: string
  text: string
  createdAt: string
}
