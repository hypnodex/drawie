import { useEffect, useState } from 'react'
import type { User } from '@drawie/data'

interface Props {
  user: Pick<User, 'name' | 'avatar' | 'photoUrl'> | null
  size?: number
  ringClassName?: string
}

/**
 * Project Avatar. When the user has a `photoUrl` it renders over the initials fallback; if the
 * image errors it's hidden so the fallback (initial on the hex `avatar` background) shows.
 * (Phase 2: was HeroUI/Radix Avatar; now a plain img-over-fallback — no component lib.)
 */
export function Avatar({ user, size = 32, ringClassName = '' }: Props) {
  const [imgError, setImgError] = useState(false)
  // Reset the error flag when the photo changes — otherwise a stable-position Avatar
  // (header / ProfileMenu) that errored for one persona stays on initials after a
  // persona switch even when the new user has a valid photo.
  useEffect(() => setImgError(false), [user?.photoUrl])
  const initial = user?.name.trim().charAt(0).toUpperCase() || '?'
  const fontPx = Math.round(size * 0.42)
  const showImg = !!user?.photoUrl && !imgError

  return (
    <span
      className={['relative inline-flex shrink-0 overflow-hidden rounded-full', ringClassName].join(' ')}
      style={{ width: size, height: size }}
      aria-label={user?.name ?? 'Unknown'}
    >
      <span
        className="w-full h-full flex items-center justify-center font-bold text-white"
        style={{ background: user?.avatar ?? 'var(--muted)', fontSize: fontPx }}
      >
        {initial}
      </span>
      {showImg && (
        <img
          src={user!.photoUrl}
          alt={user!.name}
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </span>
  )
}
