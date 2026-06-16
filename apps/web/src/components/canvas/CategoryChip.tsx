import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'surface'

interface Props {
  label: string
  selected?: boolean
  onClick?: () => void
  /** `surface` = the project's "white chip on a tinted card" treatment (lifts off cream/mint cards). */
  tone?: Tone
  className?: string
}

/**
 * Category filter chip. (Phase 2: HeroUI Chip → shadcn Badge.) Selected = brand (default
 * variant); unselected = secondary; `tone="surface"` lifts it to white on tinted cards.
 * When `onClick` is provided it renders as a real <button> (keyboard + screen-reader
 * operable, with aria-pressed); otherwise it's a plain display Badge.
 */
export function CategoryChip({ label, selected, onClick, tone = 'default', className = '' }: Props) {
  const cls = cn(
    onClick && 'cursor-pointer select-none',
    !selected && tone === 'surface' && 'bg-[var(--surface)] text-[var(--foreground)] border-transparent',
    className,
  )
  const variant = selected ? 'default' : 'secondary'

  if (onClick) {
    return (
      <Badge asChild variant={variant} className={cls}>
        <button type="button" onClick={onClick} aria-pressed={!!selected}>{label}</button>
      </Badge>
    )
  }
  return <Badge variant={variant} className={cls}>{label}</Badge>
}
