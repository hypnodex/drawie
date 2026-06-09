import type { Tile, TileId, TileStatus, CanvasId } from '../types/domain'
import { supabase } from '../supabase'

/**
 * Tile service — Supabase-backed. Reads map snake_case rows to domain `Tile`s.
 * Claiming and completing go through SECURITY DEFINER RPCs (claim_tile /
 * complete_tile) so the empty→in-progress→completed transitions are atomic and
 * authorized server-side. Tile artwork lives in the private `tiles` storage
 * bucket; we expose helpers to upload it and to fetch a signed view URL.
 */

type TileRow = {
  id: string; canvas_id: string; row: number; col: number; status: TileStatus
  assigned_user_id: string | null; contributor_name: string | null
  started_at: string | null; completed_at: string | null; artwork_path: string | null
}

export function rowToTile(r: TileRow): Tile {
  return {
    id: r.id,
    canvasId: r.canvas_id,
    row: r.row,
    col: r.col,
    status: r.status,
    assignedUserId: r.assigned_user_id ?? undefined,
    contributorName: r.contributor_name ?? undefined,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    artworkPath: r.artwork_path ?? undefined,
  }
}

export async function getTilesForCanvas(canvasId: CanvasId): Promise<Tile[]> {
  const { data, error } = await supabase
    .from('tiles').select('*').eq('canvas_id', canvasId).order('row').order('col')
  if (error) throw error
  return (data ?? []).map((r) => rowToTile(r as TileRow))
}

export async function getTile(canvasId: CanvasId, tileId: TileId): Promise<Tile | null> {
  const { data, error } = await supabase.from('tiles').select('*').eq('id', tileId).maybeSingle()
  if (error) throw error
  return data ? rowToTile(data as TileRow) : null
}

/**
 * Claim an artboard atomically. For free-pick canvases pass `tileId` to claim a
 * specific empty tile; otherwise a random free tile is assigned (`preferCenter`
 * gives the centre tile to the first joiner of a private canvas). Idempotent:
 * re-claiming returns your existing tile. Throws 'TILE_UNAVAILABLE' if full.
 */
export async function claimTile(
  canvasId: CanvasId, tileId?: TileId, preferCenter = false,
): Promise<Tile> {
  const { data, error } = await supabase.rpc('claim_tile', {
    p_canvas_id: canvasId,
    p_tile_id: tileId ?? undefined,
    p_prefer_center: preferCenter,
  })
  if (error) throw error
  return rowToTile(data as unknown as TileRow)
}

/** Mark the caller's tile complete, recording the uploaded artwork path. */
export async function completeTile(tileId: TileId, artworkPath?: string): Promise<Tile> {
  const { data, error } = await supabase.rpc('complete_tile', {
    p_tile_id: tileId,
    p_artwork_path: artworkPath ?? undefined,
  })
  if (error) throw error
  return rowToTile(data as unknown as TileRow)
}

/**
 * Complete a tile and, if it was the last one (canvas just became `completed`),
 * fire the `composite-mosaic` Edge Function to stitch the tiles into the final
 * mosaic + broadcast the reveal. Completing the tile is awaited; the composite
 * runs fire-and-forget so the artist isn't blocked.
 */
export async function completeTileAndMaybeReveal(
  canvasId: CanvasId, tileId: TileId, artworkPath?: string,
): Promise<Tile> {
  const tile = await completeTile(tileId, artworkPath)
  const { data } = await supabase
    .from('canvases').select('status, artwork_url').eq('id', canvasId).maybeSingle()
  if (data?.status === 'completed' && !data.artwork_url) {
    void supabase.functions.invoke('composite-mosaic', { body: { canvasId } })
  }
  return tile
}

/** Upload the composited tile PNG to the private `tiles` bucket; returns its path. */
export async function uploadTileArtwork(canvasId: CanvasId, tileId: TileId, blob: Blob): Promise<string> {
  const path = `${canvasId}/${tileId}.png`
  const { error } = await supabase.storage.from('tiles')
    .upload(path, blob, { upsert: true, contentType: 'image/png' })
  if (error) throw error
  return path
}

/** Signed URL to view a tile's artwork (private bucket). null if no artwork. */
export async function tileArtworkUrl(artworkPath?: string, expiresSec = 3600): Promise<string | null> {
  if (!artworkPath) return null
  const { data } = await supabase.storage.from('tiles').createSignedUrl(artworkPath, expiresSec)
  return data?.signedUrl ?? null
}
