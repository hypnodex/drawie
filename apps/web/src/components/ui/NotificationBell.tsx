import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '../../state/AuthContext'
import { timeAgo } from '@drawie/data'
import { Eyebrow } from './Eyebrow'

/**
 * Notification bell. (Phase 2: HeroUI Button + Popover + Badge.Anchor + ScrollShadow
 * → shadcn Popover + ghost icon Button + an absolutely-anchored Badge + ScrollArea.)
 * The unread-count badge is rendered inside the trigger button, absolutely positioned
 * top-right (shadcn Badge has no `.Anchor`); the popover list scrolls in a capped overflow div.
 */
export function NotificationBell() {
  const {
    isAuthed, notifications, unreadNotificationsCount,
    markNotificationRead, markAllNotificationsRead,
  } = useAuth()
  const [open, setOpen] = useState(false)
  const nav = useNavigate()

  if (!isAuthed) return null

  const ariaLabel = unreadNotificationsCount > 0
    ? `${unreadNotificationsCount} new notification${unreadNotificationsCount === 1 ? '' : 's'}`
    : 'Notifications'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={ariaLabel} className="relative">
          <BellIcon />
          {unreadNotificationsCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none pointer-events-none">
              {unreadNotificationsCount > 9 ? '9+' : String(unreadNotificationsCount)}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="p-0 w-80 sm:w-96 bg-[var(--surface)] rounded-[var(--radius)] shadow-lg overflow-hidden outline-none"
      >
        <div className="outline-none">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--surface-secondary)]">
            <Eyebrow variant="dot">
              Notifications{notifications.length > 0 && (
                <span className="ml-1 font-mono text-[10px] opacity-65">({notifications.length})</span>
              )}
            </Eyebrow>
            {unreadNotificationsCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={markAllNotificationsRead}
                className="text-[11px] font-bold"
              >
                Mark all read
              </Button>
            )}
          </div>
          <Separator />
          {notifications.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-[var(--surface-tertiary)] flex items-center justify-center mb-3">
                <BellIcon className="text-[var(--muted)]" />
              </div>
              <div className="font-display font-extrabold text-lg text-[var(--foreground)]">
                All caught up
              </div>
              <p className="mt-2 text-xs text-[var(--muted)] max-w-[14rem] mx-auto leading-snug">
                You'll see a notification here when a canvas you've drawn a tile in is finished.
              </p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto drawie-hide-scrollbar">
              <ul className="w-full">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.read) markNotificationRead(n.id)
                        setOpen(false)
                        nav(`/canvas/${n.canvasId}`)
                      }}
                      className="w-full text-left block px-4 py-3 hover:bg-[var(--surface-secondary)] transition"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={[
                            'mt-1.5 w-2 h-2 rounded-full shrink-0',
                            n.read ? 'bg-[var(--default)]' : 'bg-[var(--accent)]',
                          ].join(' ')}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-mono text-[10px] font-bold text-[var(--success)]">
                              Canvas finished
                            </span>
                            <span className="font-mono text-[10px] text-[var(--muted)] shrink-0">
                              {timeAgo(n.createdAt)}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-[var(--foreground)]">
                            <span className="font-extrabold">{n.canvasTitle}</span>{' '}
                            is complete — your tile is part of the reveal.
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-[var(--accent)]">
                            View artwork →
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function BellIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}
