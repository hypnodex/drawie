import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import type { User } from '@drawie/data'
import { Avatar } from './Avatar'

type CardUser = Pick<
  User,
  'id' | 'name' | 'avatar' | 'photoUrl' | 'isPremium' | 'completedTilesCount' | 'contributedCanvasIds'
>

interface Props {
  user: CardUser
  size?: number
  ringClassName?: string
  /** Disable the hover card (e.g. very dense lists). Default: enabled. */
  hoverCard?: boolean
}

/**
 * Clickable avatar that navigates to the user's profile, with an interactive
 * hover card. Inside the card, only the "View profile" button is clickable —
 * the name / handle / stats are passive.
 *
 * Why this is built the way it is (an earlier hover card here caused a blink
 * loop and an HMR portal crash):
 *
 *   1. The card is a portaled, NON-MODAL Radix `Popover` (Phase 2: was HeroUI
 *      `Popover.Content`) anchored to the avatar via `PopoverAnchor` and driven
 *      by a controlled `open` — i.e. by hover, not by press. Radix Popover is
 *      non-modal by default (no underlay covering the trigger), which is what
 *      avoids the open→close→open blink; `onOpenAutoFocus` is prevented so the
 *      card doesn't steal focus on open. Portaling (PopoverContent portals) also
 *      lets the card escape the catalog card's `overflow-hidden`.
 *
 *   2. Hover-intent timers run on BOTH the avatar and the popover, so moving
 *      the pointer across the gap between them doesn't flicker it shut.
 *
 *   3. The "View profile" button calls `stopPropagation()`. React bubbles
 *      portal events through the *component* tree, so a contributor avatar
 *      lives (via ContributorAvatars) inside the `CanvasCard` <RouterLink>;
 *      without this, clicking it would navigate to the canvas, not the profile.
 */
export function UserAvatar({ user, size = 28, ringClassName = '', hoverCard = true }: Props) {
  const nav = useNavigate()
  const { open, setOpen, onEnter, onLeave } = useHoverIntent()

  const goToProfile = useCallback(
    (e: MouseEvent) => {
      // Stop the synthetic event from bubbling to an enclosing card link (the
      // avatar is rendered inside CanvasCard's <RouterLink>, and the popover
      // re-enters that React subtree via the portal).
      e.preventDefault()
      e.stopPropagation()
      nav(`/profile/${user.id}`)
    },
    [nav, user.id],
  )

  const avatar = (
    <button
      type="button"
      onClick={goToProfile}
      onMouseEnter={hoverCard ? onEnter : undefined}
      onMouseLeave={hoverCard ? onLeave : undefined}
      onFocus={hoverCard ? onEnter : undefined}
      onBlur={hoverCard ? onLeave : undefined}
      aria-label={`Open ${user.name}'s profile`}
      className="inline-flex cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] hover:scale-105 transition-transform"
    >
      <Avatar user={user} size={size} ringClassName={ringClassName} />
    </button>
  )

  if (!hoverCard) return avatar

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>{avatar}</PopoverAnchor>
      <PopoverContent
        side="top"
        sideOffset={10}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        // Own the card box: drop PopoverContent's default padding/width/radius and
        // use the brand overlay tokens so it reads as the project's hover card.
        className="w-64 max-w-none p-0 border-0 overflow-hidden rounded-[var(--radius)] bg-[var(--overlay)] text-[var(--foreground)] shadow-[var(--shadow-overlay)] outline-none"
      >
        <div
          role="dialog"
          aria-label={`${user.name} — profile preview`}
          onClick={(e) => e.stopPropagation()}
        >
          <UserHoverCard user={user} />
          <button
            type="button"
            onClick={goToProfile}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-[var(--separator)] bg-[var(--surface-secondary)] hover:bg-[var(--default)] text-[var(--accent)] font-bold text-xs transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
          >
            View profile
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Passive info section of the hover card (no interactive elements). */
function UserHoverCard({ user }: { user: CardUser }) {
  const canvasCount = user.contributedCanvasIds.length
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <Avatar user={user} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-[15px] leading-tight text-[var(--foreground)] truncate">
              {user.name}
            </span>
            {user.isPremium && <Badge>Pro</Badge>}
          </div>
          <div className="text-xs text-[var(--muted)] truncate">@{user.id}</div>
        </div>
      </div>

      <div className="mt-3 flex gap-5">
        <Stat n={user.completedTilesCount} label={user.completedTilesCount === 1 ? 'tile' : 'tiles'} />
        <Stat n={canvasCount} label={canvasCount === 1 ? 'canvas' : 'canvases'} />
      </div>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-lg font-extrabold tabular-nums text-[var(--foreground)]">{n}</span>
      <span className="text-[11px] text-[var(--muted)]">{label}</span>
    </div>
  )
}

/**
 * Open/close with intent: a short open delay and a longer close delay. The
 * close delay is what lets the pointer travel from the avatar to the popover
 * (and back) without the card flickering shut.
 */
function useHoverIntent(openDelay = 120, closeDelay = 0) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const onEnter = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), openDelay)
  }, [openDelay])

  const onLeave = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), closeDelay)
  }, [closeDelay])

  return { open, setOpen, onEnter, onLeave }
}
