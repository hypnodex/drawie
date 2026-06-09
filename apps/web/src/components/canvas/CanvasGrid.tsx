import { Surface } from '@heroui/react'
import type { Canvas } from '@drawie/data'
import { CanvasCard } from './CanvasCard'

interface Props {
  canvases: Canvas[]
  emptyLabel?: string
}

export function CanvasGrid({
  canvases, emptyLabel = 'No canvases match these filters yet.',
}: Props) {
  if (canvases.length === 0) {
    return (
      <Surface variant="secondary" className="rounded-[var(--radius)] p-10 text-center">
        <div className="text-sm text-[var(--muted)]">{emptyLabel}</div>
      </Surface>
    )
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {canvases.map((c) => (
        <CanvasCard key={c.id} canvas={c} />
      ))}
    </div>
  )
}
