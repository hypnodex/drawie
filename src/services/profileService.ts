import type { User, UserId } from '../types/domain'
import { supabase } from '../lib/supabase'

/**
 * Profile reads for displaying *other* users (founders, contributors). The
 * full domain `User` (with derived counts) comes from the get_profile RPC;
 * lightweight avatar/name lookups for many ids use a direct profiles query
 * (profiles are world-readable). Missing derived fields default to empty —
 * enough for avatars and hover cards.
 */

interface ProfileLite {
  id: string; name: string; avatar: string; photo_url: string | null; is_premium: boolean
}

function liteToUser(r: ProfileLite): User {
  return {
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    photoUrl: r.photo_url ?? undefined,
    isPremium: !!r.is_premium,
    completedTilesCount: 0,
    savedCanvasIds: [],
    draftTileIds: [],
    contributedCanvasIds: [],
  }
}

/** Full domain profile (with completed/contributed counts) for one user. */
export async function getProfile(uid: UserId): Promise<User | null> {
  const { data, error } = await supabase.rpc('get_profile', { p_uid: uid })
  if (error) throw error
  return data ? (data as unknown as User) : null
}

/** Lightweight name/avatar lookups for a set of users, as a Map. */
export async function getProfilesByIds(ids: UserId[]): Promise<Map<UserId, User>> {
  const unique = Array.from(new Set(ids)).filter(Boolean)
  if (unique.length === 0) return new Map()
  const { data, error } = await supabase
    .from('profiles').select('id,name,avatar,photo_url,is_premium').in('id', unique)
  if (error) throw error
  const map = new Map<UserId, User>()
  for (const r of (data ?? []) as ProfileLite[]) map.set(r.id, liteToUser(r))
  return map
}
