import { memo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { buttonVariants, Chip, Surface } from '@heroui/react'
import type { Canvas } from '@drawie/data'
import { MosaicPreview } from './MosaicPreview'
import { ProgressBar } from './ProgressBar'
import { StatusBadge } from './StatusBadge'
import { CategoryChip } from './CategoryChip'
import { ContributorAvatars } from './ContributorAvatars'
import { PalettePreview } from './PalettePreview'

interface Props {
  canvas: Canvas
}

export const CanvasCard = memo(function CanvasCard({ canvas }: Props) {
  const isCompleted = canvas.status === 'completed'
  const cta = isCompleted ? 'View artwork' : 'View canvas'

  return (
    <RouterLink
      to={`/canvas/${canvas.id}`}
      className="group block transition-transform hover:-translate-y-0.5"
    >
      <Surface variant="secondary" className="overflow-hidden rounded-[var(--radius)] block">
        <div className="relative">
          <MosaicPreview canvas={canvas} />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <StatusBadge status={canvas.status} />
            {canvas.isTrending && !isCompleted && (
              <Chip color="accent" variant="primary" size="sm">
                Trending
              </Chip>
            )}
          </div>
          {canvas.colorPalette && (
            <div className="absolute bottom-3 right-3">
              <PalettePreview colors={canvas.colorPalette} />
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <CategoryChip label={canvas.category} tone="surface" />
              <CategoryChip label={canvas.style} tone="surface" />
            </div>
            <span className="font-mono text-[10px] text-[var(--muted)] tabular-nums shrink-0">
              {String(canvas.gridRows).padStart(2, '0')}×{String(canvas.gridCols).padStart(2, '0')}
            </span>
          </div>

          <div>
            <h3 className="text-lg font-extrabold leading-tight tracking-tight text-[var(--foreground)]">
              {canvas.title}
            </h3>
            <p className="text-[13px] leading-snug text-[var(--muted)] mt-1 line-clamp-2">
              {canvas.description}
            </p>
          </div>

          <ProgressBar completed={canvas.completedTiles} total={canvas.totalTiles} />

          <div className="flex items-center justify-between gap-2 pt-1">
            <ContributorAvatars canvas={canvas} />
            {/*
              The whole card is the RouterLink, so the visible CTA wears HeroUI
              Button styles via `buttonVariants()` rather than being a real
              <Button> — nesting an interactive button inside a link is bad
              a11y and would also fight the card's click handler.
            */}
            <span
              role="presentation"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              {cta}
              <span aria-hidden>→</span>
            </span>
          </div>
        </div>
      </Surface>
    </RouterLink>
  )
})
