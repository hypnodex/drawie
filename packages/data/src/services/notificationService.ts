/**
 * Notifications are derived server-side (get_my_notifications) and surfaced
 * through AuthContext; only this small relative-time formatter remains here,
 * used by the notification dropdown and canvas detail.
 */
export function timeAgo(iso: string, now = Date.now()): string {
  const diffSec = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (diffSec < 60) return 'Just now'
  const m = Math.floor(diffSec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}
