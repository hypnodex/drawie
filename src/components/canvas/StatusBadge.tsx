import { Chip } from '@heroui/react'
import type { CanvasStatus } from '../../types/domain'

const LABEL: Record<CanvasStatus, string> = {
  'open':            'Open',
  'almost-complete': 'Almost done',
  'completed':       'Completed',
  'locked':          'Locked',
}

/**
 * HeroUI v3 Chip per spec — sentence case, no custom CSS.
 * Defaults are color="default", variant="secondary", size="md".
 */
const VARIANT: Record<
  CanvasStatus,
  { color: 'default' | 'accent' | 'success'; variant: 'primary' | 'soft' | 'secondary' }
> = {
  'open':            { color: 'default', variant: 'soft' },
  'almost-complete': { color: 'accent',  variant: 'primary' },
  'completed':       { color: 'success', variant: 'primary' },
  'locked':          { color: 'default', variant: 'secondary' },
}

export function StatusBadge({ status, className }: { status: CanvasStatus; className?: string }) {
  const { color, variant } = VARIANT[status]
  return (
    <Chip color={color} variant={variant} size="sm" className={className}>
      {LABEL[status]}
    </Chip>
  )
}
