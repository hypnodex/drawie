import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge, Button, Popover, ScrollShadow, Separator,
} from '@heroui/react'
import { useAuth } from '../../state/AuthContext'
import { timeAgo } from '@drawie/data'
import { Eyebrow } from './Eyebrow'

/**
 * Notification bell — built strictly to the v3 Button + Popover + Badge specs.
 *
 *   Button: <Button isIconOnly variant="tertiary"> ... </Button>
 *     — default size "md", icon centered, no custom CSS needed.
 *
 *   Popover: <Popover>{button}<Popover.Content>...</Popover.Content></Popover>
 *     — Button goes directly inside; no Popover.Trigger wrapper.
 *
 *   Badge: <Badge.Anchor><icon /><Badge color="accent" placement="top-right">n</Badge></Badge.Anchor>
 *     — Anchor wraps the anchored content; the Badge sits beside it as a sibling.
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
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Badge.Anchor>
        <Button isIconOnly variant="tertiary" aria-label={ariaLabel}>
          <BellIcon />
        </Button>
        {unreadNotificationsCount > 0 && (
          <Badge color="accent" size="sm" placement="top-right">
            {unreadNotificationsCount > 9 ? '9+' : String(unreadNotificationsCount)}
          </Badge>
        )}
      </Badge.Anchor>

      <Popover.Content
        placement="bottom right"
        className="p-0 w-80 sm:w-96 bg-[var(--surface)] rounded-[var(--radius)] shadow-lg overflow-hidden outline-none"
      >
        <Popover.Dialog className="outline-none">
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
                onPress={markAllNotificationsRead}
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
            <ScrollShadow className="max-h-[60vh]">
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
            </ScrollShadow>
          )}
        </Popover.Dialog>
      </Popover.Content>
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
