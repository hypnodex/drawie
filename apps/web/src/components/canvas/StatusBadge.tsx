import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CanvasStatus } from '@drawie/data'

const LABEL: Record<CanvasStatus, string> = {
  'open':            'Open',
  'almost-complete': 'Almost done',
  'completed':       'Completed',
  'locked':          'Locked',
}

// (Phase 2: HeroUI Chip color/variant → shadcn Badge variant + token classes.)
// completed = brand accent green ("done"); almost-complete = warning amber ("nearly there")
// so the two end-states stay visually distinct, not just by label text.
const VARIANT: Record<CanvasStatus, { variant: 'default' | 'secondary'; className?: string }> = {
  'open':            { variant: 'secondary' },
  'almost-complete': { variant: 'default', className: 'bg-[var(--warning)] text-[var(--warning-foreground)] border-transparent' },
  'completed':       { variant: 'default' },
  'locked':          { variant: 'secondary' },
}

export function StatusBadge({ status, className }: { status: CanvasStatus; className?: string }) {
  const v = VARIANT[status]
  return (
    <Badge variant={v.variant} className={cn(v.className, className)}>
      {LABEL[status]}
    </Badge>
  )
}
