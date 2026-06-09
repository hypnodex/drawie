import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { CanvasId, Entitlement, Notification, User, UserId } from '@drawie/data'
import { computeEntitlement } from '@drawie/data'
import { supabase } from '@drawie/data'

/**
 * Session-based auth backed by Supabase. Replaces the old localStorage persona
 * switcher. The public API is preserved so existing consumers keep working;
 * new methods (signInWithEmail/Google/Guest, refreshUser) layer on top.
 *
 * In dev (`VITE_DEV_IMPERSONATE=true`) the seeded demo personas remain available
 * via `users` + `login(id)` (password sign-in), and we auto-impersonate the
 * default persona on first load to mirror the old zero-friction dev experience.
 */

const DEV_IMPERSONATE = import.meta.env.VITE_DEV_IMPERSONATE === 'true'
const DEV_DEFAULT_PERSONA: UserId = 'alex'
const DEV_PASSWORD = 'drawie123'

interface AuthContextValue {
  user: User | null
  entitlement: Entitlement | null
  isAuthed: boolean
  isGuest: boolean                                // anonymous (link-only) session
  isLoading: boolean                              // resolving the initial session
  users: User[]                                   // dev persona switcher (empty in prod)

  // ── Auth actions ────────────────────────────────────────────────────────
  login: (id: UserId) => Promise<void>            // dev impersonation (persona id or email)
  signInWithEmail: (email: string) => Promise<{ error?: string; sent?: boolean }>
  signInWithGoogle: () => Promise<{ error?: string }>
  signInAsGuest: () => Promise<{ error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>

  toggleSave: (canvasId: CanvasId) => Promise<void>
  recordTileSubmission: (canvasId?: CanvasId) => void
  setIsPremium: (value: boolean) => Promise<void> // dev/demo premium toggle

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: Notification[]
  unreadNotificationsCount: number
  markNotificationRead: (notificationId: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Shape returned by get_my_profile / get_profile RPCs. */
interface ProfilePayload extends User { isAnonymous?: boolean }

function mapNotifications(rows: Array<{
  id: string; type: string; canvas_id: string; canvas_title: string; created_at: string; read: boolean
}>): Notification[] {
  return rows.map((n) => ({
    id: n.id,
    type: 'canvas-completed',
    canvasId: n.canvas_id,
    canvasTitle: n.canvas_title,
    createdAt: n.created_at,
    read: n.read,
  }))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsersList] = useState<User[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const bootstrapped = useRef(false)

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase.rpc('get_my_notifications')
    setNotifications(data ? mapNotifications(data) : [])
  }, [])

  /** Re-read the signed-in user's profile + notifications from the backend. */
  const hydrate = useCallback(async (session: Session | null) => {
    if (!session) {
      setUser(null); setIsGuest(false); setNotifications([])
      return
    }
    setIsGuest(!!session.user.is_anonymous)
    const { data } = await supabase.rpc('get_my_profile')
    if (data) {
      const p = data as unknown as ProfilePayload
      setUser(p)
      setIsGuest(!!p.isAnonymous)
    } else {
      setUser(null)
    }
    await loadNotifications()
  }, [loadNotifications])

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await hydrate(data.session)
  }, [hydrate])

  // Dev-only: list the seeded personas for the switcher (full User incl. counts).
  const loadDemoUsers = useCallback(async () => {
    if (!DEV_IMPERSONATE) return
    const { data: rows } = await supabase
      .from('profiles').select('id').eq('is_anonymous', false).order('created_at').limit(12)
    if (!rows) return
    const full = await Promise.all(
      rows.map((r) => supabase.rpc('get_profile', { p_uid: r.id }).then((res) => res.data as unknown as User | null)),
    )
    setUsersList(full.filter(Boolean) as User[])
  }, [])

  // Initial session + auth-state subscription.
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      if (!data.session && DEV_IMPERSONATE && !bootstrapped.current) {
        // Mirror the old auto-login for a zero-friction dev start.
        bootstrapped.current = true
        await supabase.auth.signInWithPassword({
          email: `${DEV_DEFAULT_PERSONA}@drawie.test`, password: DEV_PASSWORD,
        }).catch(() => {})
      } else {
        await hydrate(data.session)
      }
      if (active) setIsLoading(false)
      void loadDemoUsers()
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrate(session)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [hydrate, loadDemoUsers])

  // ── Auth actions ──────────────────────────────────────────────────────────
  const login = useCallback(async (id: UserId) => {
    const email = id.includes('@') ? id : `${id}@drawie.test`
    await supabase.auth.signInWithPassword({ email, password: DEV_PASSWORD })
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: window.location.origin },
    })
    return error ? { error: error.message } : { sent: true }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: window.location.origin },
    })
    return error ? { error: error.message } : {}
  }, [])

  const signInAsGuest = useCallback(async () => {
    const { error } = await supabase.auth.signInAnonymously()
    return error ? { error: error.message } : {}
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null); setIsGuest(false); setNotifications([])
  }, [])

  const toggleSave = useCallback(async (canvasId: CanvasId) => {
    if (!user) return
    const saved = user.savedCanvasIds.includes(canvasId)
    setUser({ ...user, savedCanvasIds: saved
      ? user.savedCanvasIds.filter((x) => x !== canvasId)
      : [...user.savedCanvasIds, canvasId] })
    if (saved) await supabase.from('saved_canvases').delete().eq('user_id', user.id).eq('canvas_id', canvasId)
    else await supabase.from('saved_canvases').insert({ user_id: user.id, canvas_id: canvasId })
  }, [user])

  const recordTileSubmission = useCallback((_canvasId?: CanvasId) => {
    // Completion is recorded server-side by complete_tile; just re-hydrate so
    // counts/contributions/notifications reflect the new state.
    void refreshUser()
  }, [refreshUser])

  const setIsPremium = useCallback(async (value: boolean) => {
    if (!user) return
    setUser({ ...user, isPremium: value })
    await supabase.from('profiles').update({ is_premium: value }).eq('id', user.id)
  }, [user])

  const markNotificationRead = useCallback(async (notificationId: string) => {
    if (!user) return
    setNotifications((cur) => cur.map((n) => n.id === notificationId ? { ...n, read: true } : n))
    await supabase.from('notification_reads').upsert({ user_id: user.id, notification_id: notificationId })
  }, [user])

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return
    const unread = notifications.filter((n) => !n.read)
    setNotifications((cur) => cur.map((n) => ({ ...n, read: true })))
    if (unread.length) {
      await supabase.from('notification_reads')
        .upsert(unread.map((n) => ({ user_id: user.id, notification_id: n.id })))
    }
  }, [user, notifications])

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length, [notifications],
  )

  const value = useMemo<AuthContextValue>(() => ({
    user,
    entitlement: user ? computeEntitlement(user) : null,
    isAuthed: !!user,
    isGuest,
    isLoading,
    users,
    login, signInWithEmail, signInWithGoogle, signInAsGuest, logout, refreshUser,
    toggleSave, recordTileSubmission, setIsPremium,
    notifications, unreadNotificationsCount, markNotificationRead, markAllNotificationsRead,
  }), [
    user, isGuest, isLoading, users,
    login, signInWithEmail, signInWithGoogle, signInAsGuest, logout, refreshUser,
    toggleSave, recordTileSubmission, setIsPremium,
    notifications, unreadNotificationsCount, markNotificationRead, markAllNotificationsRead,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
