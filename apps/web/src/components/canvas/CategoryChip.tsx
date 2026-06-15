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
 */
export function CategoryChip({ label, selected, onClick, tone = 'default', className = '' }: Props) {
  if (selected) {
    return (
      <Badge onClick={onClick} className={cn('cursor-pointer select-none', className)}>
        {label}
      </Badge>
    )
  }
  return (
    <Badge
      variant="secondary"
      onClick={onClick}
      className={cn(
        'cursor-pointer select-none',
        tone === 'surface' && 'bg-[var(--surface)] text-[var(--foreground)] border-transparent',
        className,
      )}
    >
      {label}
    </Badge>
  )
}
