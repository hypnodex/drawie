import type { Canvas, Tile, UserId } from '../types/domain'
import { supabase } from '../lib/supabase'
import { rowToCanvas } from './canvasService'
import { rowToTile, getTilesForCanvas } from './tileService'

/**
 * Private-canvas session service — Supabase RPC-backed. Token resolution,
 * tile assignment, and host controls are SECURITY DEFINER functions: a guest/
 * host token authorizes access, after which the caller becomes a member and
 * normal RLS governs reads/writes. Participants are derived from tiles (whoever
 * holds an artboard), so there is no separate participants store.
 */

export interface PrivateParticipant {
  id: UserId
  name: string
  tileId: string
  status: Tile['status']
  isHost: boolean
}

export interface JoinResult {
  canvas: Canvas
  tile: Tile
}

/** Resolve a guest token, join, and get an assigned artboard (centre if first). */
export async function joinPrivateCanvas(guestToken: string): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('join_private_canvas', { p_token: guestToken })
  if (error) throw error
  const obj = data as unknown as { canvas: Record<string, unknown>; tile: Record<string, unknown> }
  return {
    canvas: rowToCanvas(obj.canvas as never),
    tile: rowToTile(obj.tile as never),
  }
}

/** Resolve a host token → the canvas, recording the caller as host. */
export async function resolveHostToken(hostToken: string): Promise<Canvas> {
  const { data, error } = await supabase.rpc('resolve_host_token', { p_token: hostToken })
  if (error) throw error
  return rowToCanvas(data as unknown as never)
}

/** The current host of a private canvas (for the console to verify control). */
export async function getHostId(canvasId: string): Promise<UserId | null> {
  const { data } = await supabase.from('private_sessions').select('host_id').eq('canvas_id', canvasId).maybeSingle()
  return data?.host_id ?? null
}

/** Participants = everyone holding a tile, derived from the tiles table. */
export async function getParticipants(canvasId: string, hostId: string | null): Promise<PrivateParticipant[]> {
  const tiles = await getTilesForCanvas(canvasId)
  return tiles
    .filter((t) => t.assignedUserId)
    .map((t) => ({
      id: t.assignedUserId!,
      name: t.contributorName ?? 'Guest',
      tileId: t.id,
      status: t.status,
      isHost: t.assignedUserId === hostId,
    }))
}

export async function reassignParticipant(canvasId: string, tileId: string, targetUserId: UserId): Promise<void> {
  const { error } = await supabase.rpc('host_reassign', {
    p_canvas_id: canvasId, p_tile_id: tileId, p_target_user: targetUserId,
  })
  if (error) throw error
}

export async function kickParticipant(canvasId: string, targetUserId: UserId): Promise<void> {
  const { error } = await supabase.rpc('host_kick', { p_canvas_id: canvasId, p_target_user: targetUserId })
  if (error) throw error
}
