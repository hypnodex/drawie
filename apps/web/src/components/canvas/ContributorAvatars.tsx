import type { Canvas } from '@drawie/data'
import { MOCK_USERS } from '../../mock/users'
import { UserAvatar } from '../ui/UserAvatar'

interface Props {
  canvas: Canvas
  size?: number
  max?: number
}

/**
 * Stack of contributor avatars (-space-x overlap). "+N" overflow tile uses
 * foreground/background tokens so it reads on any surface.
 */
export function ContributorAvatars({ canvas, size = 28, max = 4 }: Props) {
  const N = Math.min(max, canvas.activeContributors)
  const more = canvas.activeContributors - N
  const seed = hashSeed(canvas.id)
  const picks = []
  for (let i = 0; i < N; i++) {
    picks.push(MOCK_USERS[(seed + i * 7) % MOCK_USERS.length])
  }
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {picks.map((u, i) => (
          <UserAvatar
            key={i}
            user={u}
            size={size}
            ringClassName="ring-2 ring-[var(--background)]"
          />
        ))}
      </div>
      {more > 0 && (
        <span
          className="ml-1.5 inline-flex items-center justify-center font-bold rounded-full bg-[var(--foreground)] text-[var(--background)] ring-2 ring-[var(--background)]"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
        >
          +{more}
        </span>
      )}
    </div>
  )
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
