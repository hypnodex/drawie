import { Surface } from '@heroui/react'
import { ButtonLink } from '../ui/ButtonLink'
import type { Entitlement, User } from '@drawie/data'
import { COMPLETED_TILES_REQUIRED_TO_FOUND } from '@drawie/data'
import { Heading } from '../ui/Heading'

interface Props {
  user: User
  entitlement: Entitlement
}

export function ProgressCard({ user, entitlement }: Props) {
  const required = COMPLETED_TILES_REQUIRED_TO_FOUND
  const done = Math.min(required, user.completedTilesCount)
  const remaining = entitlement.remainingTilesToFound
  const eligible = entitlement.canCreateCanvas

  return (
    <Surface variant="secondary" className="rounded-[var(--radius)] overflow-hidden p-7 sm:p-9">
      <div className="grid sm:grid-cols-12 gap-6 sm:gap-10 items-center">
        <div className="sm:col-span-7 flex flex-col gap-3">
          {eligible ? (
            <>
              <Heading level={2} size="md">You can create your own canvas.</Heading>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                {entitlement.isPremium
                  ? 'Premium unlocks instant canvas creation, anytime.'
                  : `You've completed ${user.completedTilesCount} tiles — well past the ${required}-tile founding requirement.`}
              </p>
            </>
          ) : (
            <>
              <Heading level={2} size="md">
                {remaining} {remaining === 1 ? 'tile' : 'tiles'} to go.
              </Heading>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Complete <span className="font-bold text-[var(--foreground)]">{remaining} more {remaining === 1 ? 'tile' : 'tiles'}</span> to unlock canvas creation, or skip the wait with Premium.
              </p>
            </>
          )}

          <div className="flex flex-wrap gap-3 mt-2">
            {eligible ? (
              <ButtonLink to="/create-canvas" variant="primary" size="md" className="text-sm">
                Create canvas <span aria-hidden>→</span>
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/" variant="primary" size="md" className="text-sm">Find a canvas</ButtonLink>
                <ButtonLink to="/premium" variant="secondary" size="md" className="text-sm">Go Premium</ButtonLink>
              </>
            )}
          </div>
        </div>

        <div className="sm:col-span-5 flex flex-col gap-3 sm:items-end">
          <div className="flex items-baseline gap-2">
            <Heading level={3} size="xl" className="!text-6xl sm:!text-7xl tabular-nums">{done}</Heading>
            <span className="font-mono text-sm text-[var(--muted)] tabular-nums">/ {required} tiles</span>
          </div>
          <div className="grid grid-cols-5 gap-2 w-full max-w-[280px]">
            {Array.from({ length: required }).map((_, i) => {
              const filled = i < done
              return (
                <div
                  key={i}
                  className={[
                    'aspect-square rounded-xl transition-all',
                    filled ? 'bg-[var(--accent)]' : 'bg-[var(--surface)]',
                  ].join(' ')}
                />
              )
            })}
          </div>
          {user.completedTilesCount > required && (
            <span className="font-mono text-[11px] text-[var(--muted)]">
              +{user.completedTilesCount - required} extra completed
            </span>
          )}
        </div>
      </div>
    </Surface>
  )
}
