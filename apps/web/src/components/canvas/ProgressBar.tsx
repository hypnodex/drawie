import { Label, ProgressBar as HUIProgressBar } from '@heroui/react'

interface Props {
  completed: number
  total: number
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Canvas completion progress — strict HeroUI v3 ProgressBar per spec.
 * Defaults: color="accent", variant compound (Track + Fill required).
 * `<ProgressBar.Output />` auto-formats the value as a percentage (matches
 * `formatOptions={ style: 'percent' }` default), so no inline width / classes
 * are needed on the Fill — HeroUI computes it from the `value` prop.
 */
export function ProgressBar({ completed, total, showText = true, size = 'sm' }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  return (
    <HUIProgressBar value={pct} size={size} aria-label="Canvas completion">
      {showText && (
        <div className="flex items-center justify-between mb-1.5 text-[11px]">
          <Label>{completed} / {total} tiles</Label>
          <HUIProgressBar.Output />
        </div>
      )}
      <HUIProgressBar.Track>
        <HUIProgressBar.Fill />
      </HUIProgressBar.Track>
    </HUIProgressBar>
  )
}
