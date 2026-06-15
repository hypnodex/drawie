import { useRef, useState } from 'react'
import { Button } from '../components/ui/button'
import { HeroSection } from '../components/discovery/HeroSection'
import { DrawingOfTheMonth } from '../components/discovery/DrawingOfTheMonth'
import { FilterBar, DEFAULT_FILTERS, ActiveFilters } from '../components/discovery/FilterBar'
import { CanvasGrid } from '../components/canvas/CanvasGrid'
import { CanvasCard } from '../components/canvas/CanvasCard'
import { Heading } from '../components/ui/Heading'
import { listCanvases, listCompleted, listTrending } from '@drawie/data'
import { useAsync } from '../hooks/useAsync'
import type { Canvas, CanvasStatus } from '@drawie/data'

export default function DiscoveryScreen() {
  const [filters, setFilters] = useState<ActiveFilters>(DEFAULT_FILTERS)

  const completed = useAsync(() => listCompleted(), [], [] as Canvas[]).data.slice(0, 9)
  const trending = useAsync(() => listTrending(6), [], [] as Canvas[]).data
  const filtered = useAsync(
    () => listCanvases({
      category: filters.categories,
      status: filters.statuses as CanvasStatus[],
      sort: filters.sort,
      search: filters.search,
    }),
    [filters],
    [] as Canvas[],
  ).data

  return (
    <>
      <HeroSection />
      <DrawingOfTheMonth />

      <CarouselSection
        title="Recently completed"
        eyebrow="Gallery"
        description="Mosaics finished by the community. Each one is the work of dozens of strangers."
        items={completed}
      />

      <Section
        id="trending"
        title="Trending now"
        eyebrow="Live"
        index="In progress /"
        description="Active canvases with momentum — join in before it's done."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trending.map((c) => <CanvasCard key={c.id} canvas={c} />)}
        </div>
      </Section>

      <Section
        title="All canvases"
        eyebrow="Browse"
        index="Catalog /"
        description="Filter by category, status or search by topic."
      >
        <div className="flex flex-col gap-6">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            resultCount={filtered.length}
          />
          <CanvasGrid canvases={filtered} />
        </div>
      </Section>
    </>
  )
}

function Section({
  id, title, eyebrow, description, index, children,
}: {
  id?: string
  title: string
  eyebrow: string
  description?: string
  index?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="max-w-[1440px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
      <header className="mb-7 sm:mb-10">
        <Heading level={2} size="lg">{title}</Heading>
        {description && (
          <p className="mt-3 text-sm sm:text-base text-[var(--muted)] max-w-2xl leading-relaxed">{description}</p>
        )}
      </header>
      {children}
    </section>
  )
}

function CarouselSection({
  title, eyebrow, description, items,
}: {
  title: string
  eyebrow: string
  description?: string
  items: Canvas[]
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollByCard = (dir: 'prev' | 'next') => {
    const track = trackRef.current
    if (!track) return
    const firstCard = track.querySelector<HTMLElement>(':scope > *')
    const step = firstCard ? firstCard.offsetWidth + 24 : track.clientWidth * 0.8
    track.scrollBy({ left: step * (dir === 'next' ? 1 : -1), behavior: 'smooth' })
  }

  return (
    <section className="max-w-[1440px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
      <header className="mb-7 sm:mb-10 flex items-start justify-between gap-6">
        <div>
          <Heading level={2} size="lg">{title}</Heading>
          {description && (
            <p className="mt-3 text-sm sm:text-base text-[var(--muted)] max-w-2xl leading-relaxed">{description}</p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-2 mt-2 shrink-0">
          <CarouselArrow direction="prev" onPress={() => scrollByCard('prev')} />
          <CarouselArrow direction="next" onPress={() => scrollByCard('next')} primary />
        </div>
      </header>

      <div
        ref={trackRef}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory drawie-hide-scrollbar -mx-6 sm:-mx-10 px-6 sm:px-10 pb-2 scroll-pl-6 sm:scroll-pl-10"
      >
        {items.map((c) => (
          <div
            key={c.id}
            className="snap-start shrink-0 w-[300px] sm:w-[360px] lg:w-[400px]"
          >
            <CanvasCard canvas={c} />
          </div>
        ))}
      </div>
    </section>
  )
}

function CarouselArrow({
  direction, onPress, primary,
}: {
  direction: 'prev' | 'next'
  onPress: () => void
  primary?: boolean
}) {
  return (
    <Button
      onClick={onPress}
      aria-label={direction === 'prev' ? 'Previous' : 'Next'}
      className={[
        'w-11 h-11 rounded-full p-0',
        primary
          ? 'bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90'
          : 'bg-[var(--surface-secondary)] text-[var(--foreground)] hover:bg-[var(--surface-tertiary)]',
      ].join(' ')}
    >
      <svg
        width={14} height={14} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        className={direction === 'prev' ? '' : 'rotate-180'}
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Button>
  )
}
