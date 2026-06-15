import * as React from 'react'

import { cn } from '@/lib/utils'

type SurfaceVariant = 'default' | 'secondary' | 'tertiary'

const SURFACE: Record<SurfaceVariant, string> = {
  default: 'bg-card text-card-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  tertiary: 'bg-muted text-foreground',
}

/**
 * Project surface container — Phase 2 drop-in for HeroUI's Surface. `variant` picks the
 * background from the shared tokens (default=card, secondary, tertiary=muted); callers add
 * their own radius/padding/border. Keeps surface vs. on-surface buttons contrasting (default
 * panels are bg-card/white, so secondary buttons stand out). See ui-button-contrast memory.
 */
function Surface({
  variant = 'default',
  className,
  ...props
}: React.ComponentProps<'div'> & { variant?: SurfaceVariant }) {
  return <div data-slot="surface" className={cn(SURFACE[variant], className)} {...props} />
}

export { Surface }
