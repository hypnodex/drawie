import type { Canvas } from '../types/domain'
import { supabase } from '../lib/supabase'
import { getCanvas } from './canvasService'

/**
 * Monthly "Drawing of the Month" voting — Supabase-backed. One vote per user
 * per month (enforced by the votes PK). Counts blend persisted community seed
 * votes (vote_seeds) with real user votes via SECURITY DEFINER functions, so
 * tallies aggregate across all users while respecting per-row RLS on writes.
 */

export const VOTE_MONTH_KEY = '2026-06'
export const VOTE_MONTH_LABEL = 'June 2026'

/** The canvas the current user voted for this month, if any. */
export async function getUserVote(): Promise<string | null> {
  const { data } = await supabase
    .from('votes').select('canvas_id').eq('month_key', VOTE_MONTH_KEY).maybeSingle()
  return data?.canvas_id ?? null
}

export async function castVote(canvasId: string): Promise<void> {
  const { error } = await supabase.rpc('cast_vote', { p_canvas_id: canvasId, p_month_key: VOTE_MONTH_KEY })
  if (error) throw error
}

export async function retractVote(): Promise<void> {
  const { error } = await supabase.rpc('retract_vote', { p_month_key: VOTE_MONTH_KEY })
  if (error) throw error
}

export async function getVoteCount(canvasId: string): Promise<number> {
  const { data } = await supabase.rpc('vote_count', { p_canvas: canvasId, p_month: VOTE_MONTH_KEY })
  return data ?? 0
}

export async function getTotalVoters(): Promise<number> {
  const { data } = await supabase.rpc('total_voters', { p_month: VOTE_MONTH_KEY })
  return data ?? 0
}

/** Completed public canvas with the most votes this month. */
export async function getDrawingOfTheMonth(): Promise<Canvas | null> {
  const { data: board } = await supabase.rpc('vote_board', { p_month: VOTE_MONTH_KEY })
  if (!board || board.length === 0) return null
  const top = board.reduce((best, c) => (c.votes > best.votes ? c : best), board[0])
  return getCanvas(top.canvas_id)
}
