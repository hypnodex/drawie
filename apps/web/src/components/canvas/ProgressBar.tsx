import { cn } from '@/lib/utils'

interface Props {
  completed: number
  total: number
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Canvas completion progress bar. (Phase 2: was HeroUI ProgressBar; now a plain token-styled
 * bar — track = --default, fill = --accent — no component lib.)
 */
export function ProgressBar({ completed, total, showText = true, size = 'sm' }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  const h = size === 'lg' ? 'h-3' : size === 'md' ? 'h-2.5' : 'h-2'
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Canvas completion">
      {showText && (
        <div className="flex items-center justify-between mb-1.5 text-[11px]">
          <span className="text-[var(--muted)]">{completed} / {total} tiles</span>
          <span className="tabular-nums font-bold text-[var(--foreground)]">{pct}%</span>
        </div>
      )}
      <div className={cn('w-full rounded-full bg-[var(--default)] overflow-hidden', h)}>
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
