import { Avatar as HUIAvatar } from '@heroui/react'
import type { User } from '@drawie/data'

interface Props {
  user: Pick<User, 'name' | 'avatar' | 'photoUrl'> | null
  size?: number
  ringClassName?: string
}

/**
 * Project Avatar built on HeroUI v3 Avatar (Radix-based).
 *
 *   - When the user has a `photoUrl`, render <Avatar.Image>. The Fallback
 *     (the initial on the hex `avatar` background) shows while the photo is
 *     loading and stays if the request errors.
 *   - When there is no photoUrl, only the Fallback renders.
 *
 * HeroUI's `size` prop is enum-only (sm | md | lg), so we keep the inline
 * width/height pixel sizing on the Root for consistent calibration with the
 * other surfaces (avatar stacks, profile menu, dashboard header).
 */
export function Avatar({ user, size = 32, ringClassName = '' }: Props) {
  const initial = (user?.name.trim().charAt(0).toUpperCase()) || '?'
  const fontPx = Math.round(size * 0.42)
  return (
    <HUIAvatar.Root
      className={['inline-flex shrink-0 overflow-hidden rounded-full', ringClassName].join(' ')}
      style={{ width: size, height: size }}
      aria-label={user?.name ?? 'Unknown'}
    >
      {user?.photoUrl && (
        <HUIAvatar.Image
          src={user.photoUrl}
          alt={user.name}
          className="w-full h-full object-cover"
        />
      )}
      <HUIAvatar.Fallback
        className="w-full h-full flex items-center justify-center font-bold text-white"
        style={{ background: user?.avatar ?? 'var(--muted)', fontSize: fontPx }}
      >
        {initial}
      </HUIAvatar.Fallback>
    </HUIAvatar.Root>
  )
}
