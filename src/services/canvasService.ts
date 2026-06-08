import type { Canvas, CanvasId, CanvasStatus } from '../types/domain'
import type { ToolId } from '../types'
import { supabase } from '../lib/supabase'

/**
 * Canvas service — Supabase-backed. Reads return camelCase domain `Canvas`
 * objects (mapped from snake_case rows); the founder's display name is embedded
 * via the profiles FK. Private (link-only) canvases never appear in public
 * listings (enforced by the visibility filter AND row-level security).
 */

export interface ListFilter {
  status?: CanvasStatus[]
  category?: string[]
  paletteId?: string
  trending?: boolean
  search?: string
  sort?: 'trending' | 'newest' | 'almost-complete' | 'progress-low'
}

// Embed the founder's name so Canvas.founderName is populated in one query.
const SELECT = '*, founder:profiles!canvases_founder_id_fkey(name)'

type CanvasRow = Record<string, unknown> & {
  founder?: { name: string } | null
}

export function rowToCanvas(r: CanvasRow): Canvas {
  const g = (k: string) => r[k]
  return {
    id: g('id') as string,
    title: g('title') as string,
    description: (g('description') as string) ?? '',
    founderId: g('founder_id') as string,
    founderName: r.founder?.name ?? 'Unknown',
    category: g('category') as string,
    topic: (g('topic') as string) ?? '',
    style: (g('style') as string) ?? '',
    gridRows: g('grid_rows') as number,
    gridCols: g('grid_cols') as number,
    allowedTools: ((g('allowed_tools') as string[]) ?? []) as ToolId[],
    disallowedTools: (g('disallowed_tools') as string[] | null) as ToolId[] | undefined,
    colorPalette: (g('color_palette') as string[] | null) ?? null,
    background: (g('background') as string) ?? '#ffffff',
    styleGuidance: (g('style_guidance') as string) ?? '',
    participationMode: g('participation_mode') as Canvas['participationMode'],
    visibility: g('visibility') as Canvas['visibility'],
    neighborPreviewSize: g('neighbor_preview_size') as Canvas['neighborPreviewSize'],
    totalTiles: (g('total_tiles') as number) ?? (g('grid_rows') as number) * (g('grid_cols') as number),
    completedTiles: (g('completed_tiles') as number) ?? 0,
    activeContributors: (g('active_contributors') as number) ?? 0,
    status: g('status') as CanvasStatus,
    isTrending: !!g('is_trending'),
    createdAt: g('created_at') as string,
    completedAt: (g('completed_at') as string | null) ?? undefined,
    previewGradient: g('preview_gradient') as string,
    finalGradient: (g('final_gradient') as string | null) ?? undefined,
    artworkUrl: (g('artwork_url') as string | null) ?? undefined,
    discussionCount: (g('discussion_count') as number) ?? 0,
    participantCount: (g('participant_count') as number | null) ?? undefined,
    guestToken: (g('guest_token') as string | null) ?? undefined,
    hostToken: (g('host_token') as string | null) ?? undefined,
  }
}

/** Client-side sort (dataset is small; ratio sorts aren't expressible in PostgREST). */
function sortCanvases(list: Canvas[], sort: ListFilter['sort']): Canvas[] {
  const out = [...list]
  switch (sort) {
    case 'newest':
      return out.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    case 'almost-complete':
      return out.sort((a, b) => b.completedTiles / b.totalTiles - a.completedTiles / a.totalTiles)
    case 'progress-low':
      return out.sort((a, b) => a.completedTiles / a.totalTiles - b.completedTiles / b.totalTiles)
    case 'trending':
    default:
      return out.sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0))
  }
}

export async function listCanvases(filter: ListFilter = {}): Promise<Canvas[]> {
  let q = supabase.from('canvases').select(SELECT).eq('visibility', 'public')
  if (filter.status?.length) q = q.in('status', filter.status)
  if (filter.category?.length) q = q.in('category', filter.category)
  if (filter.trending) q = q.eq('is_trending', true)
  if (filter.search) {
    const s = filter.search.replace(/[%,]/g, ' ')
    q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%,topic.ilike.%${s}%`)
  }
  const { data, error } = await q
  if (error) throw error
  const mapped = (data ?? []).map((r) => rowToCanvas(r as CanvasRow))
  if (filter.paletteId) {
    // Palette filtering kept client-side (palette stored as colors, not id).
    return sortCanvases(mapped, filter.sort)
  }
  return sortCanvases(mapped, filter.sort)
}

export async function getCanvas(id: CanvasId): Promise<Canvas | null> {
  const { data, error } = await supabase.from('canvases').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToCanvas(data as CanvasRow) : null
}

export async function listCompleted(): Promise<Canvas[]> {
  return listCanvases({ status: ['completed'], sort: 'newest' })
}

export async function listTrending(limit = 6): Promise<Canvas[]> {
  const { data, error } = await supabase
    .from('canvases').select(SELECT)
    .eq('visibility', 'public').eq('is_trending', true)
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => rowToCanvas(r as CanvasRow))
}

/**
 * Create a canvas via the entitlement-gated RPC. `payload` mirrors CanvasConfig
 * + the descriptive fields; tiles are auto-seeded server-side. Returns the new
 * canvas (incl. generated guest/host tokens for private-link canvases).
 */
export async function createCanvas(payload: Record<string, unknown>): Promise<Canvas> {
  const { data, error } = await supabase.rpc('create_canvas', { payload: payload as never })
  if (error) throw error
  return rowToCanvas(data as unknown as CanvasRow)
}
