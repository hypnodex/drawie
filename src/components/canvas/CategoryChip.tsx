import { Chip } from '@heroui/react'

type Tone = 'default' | 'surface'

interface Props {
  label: string
  selected?: boolean
  onClick?: () => void
  /**
   * Visual tone for the chip background.
   *   "default" — uses HeroUI's default `Chip color="default" variant="secondary"`,
   *               which sits on the page background.
   *   "surface" — Drawie2's "on-tinted-card" variant: white background, used
   *               when the chip lives on a Surface variant="secondary" (cream)
   *               or "tertiary" (mint) card and needs to lift visually. This
   *               is the project's extension to the HeroUI Chip color set.
   */
  tone?: Tone
  className?: string
}

/**
 * HeroUI v3 Chip per spec — sentence case, default size/variant.
 * Adds one DS extension: `tone="surface"` for chips that sit on tinted cards.
 */
export function CategoryChip({
  label, selected, onClick, tone = 'default', className = '',
}: Props) {
  if (selected) {
    return (
      <Chip
        color="accent"
        variant="primary"
        size="sm"
        className={['cursor-pointer select-none', className].join(' ')}
        onClick={onClick}
      >
        {label}
      </Chip>
    )
  }
  if (tone === 'surface') {
    return (
      <Chip
        color="default"
        variant="secondary"
        size="sm"
        className={[
          'cursor-pointer select-none',
          // The DS-level "white chip" treatment — lifts off tinted card
          // surfaces. Background is var(--surface) (white), foreground is
          // var(--foreground) (deep ink), no border.
          'bg-[var(--surface)] text-[var(--foreground)] border-0',
          className,
        ].join(' ')}
        onClick={onClick}
      >
        {label}
      </Chip>
    )
  }
  return (
    <Chip
      color="default"
      variant="secondary"
      size="sm"
      className={['cursor-pointer select-none', className].join(' ')}
      onClick={onClick}
    >
      {label}
    </Chip>
  )
}
