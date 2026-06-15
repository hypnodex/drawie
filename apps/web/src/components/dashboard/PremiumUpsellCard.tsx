import { Link as RouterLink } from 'react-router-dom'
import { Surface } from '../ui/Surface'
import { ButtonLink } from '../ui/ButtonLink'
import { Heading } from '../ui/Heading'

const FEATURES = [
  'Create canvases anytime — skip the 5-tile requirement',
  'See larger neighbor previews while drawing',
  '4K exports for any canvas you contributed to',
]

interface Props {
  variant?: 'full' | 'compact'
}

export function PremiumUpsellCard({ variant = 'full' }: Props) {
  if (variant === 'compact') {
    return (
      <RouterLink
        to="/premium"
        className="block p-4 rounded-2xl bg-[var(--surface-tertiary)] hover:bg-[var(--default)] transition group"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 font-extrabold text-sm text-[var(--foreground)]">
            Create canvases anytime
          </div>
          <span className="text-[var(--foreground)] group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </RouterLink>
    )
  }

  return (
    <Surface variant="tertiary" className="rounded-[var(--radius)] p-7 sm:p-9">
      <Heading level={2} size="md">
        Skip the wait. Draw bigger.
        <br />
        <span className="text-[var(--muted)]">Print sharper.</span>
      </Heading>
      <p className="mt-3 text-sm text-[var(--muted)] max-w-md leading-relaxed">
        Premium unlocks founder powers and higher-fidelity output across the platform.
      </p>

      <ul className="mt-6 space-y-2.5">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm text-[var(--foreground)] font-medium">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--foreground)] shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <ButtonLink to="/premium" variant="primary" size="md" className="mt-7 text-sm">
        Compare plans <span aria-hidden>→</span>
      </ButtonLink>
    </Surface>
  )
}
