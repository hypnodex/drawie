import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Surface } from '@/components/ui/Surface'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { CanvasStatus } from '@drawie/data'
import { CATEGORIES } from '../../mock/categories'
import { CategoryChip } from '../canvas/CategoryChip'

export interface ActiveFilters {
  categories: string[]
  statuses: CanvasStatus[]
  sort: 'trending' | 'newest' | 'almost-complete' | 'progress-low'
  search: string
}

export const DEFAULT_FILTERS: ActiveFilters = {
  categories: [],
  statuses: [],
  sort: 'trending',
  search: '',
}

const STATUS_OPTIONS: { value: CanvasStatus; label: string }[] = [
  { value: 'open',            label: 'Open' },
  { value: 'almost-complete', label: 'Almost done' },
  { value: 'completed',       label: 'Completed' },
]

const SORT_OPTIONS: { value: ActiveFilters['sort']; label: string }[] = [
  { value: 'trending',         label: 'Trending' },
  { value: 'newest',           label: 'Newest' },
  { value: 'almost-complete',  label: 'Almost done' },
  { value: 'progress-low',     label: 'Just started' },
]

interface Props {
  filters: ActiveFilters
  onChange: (f: ActiveFilters) => void
  resultCount: number
}

export function FilterBar({ filters, onChange, resultCount }: Props) {
  const [showCats, setShowCats] = useState(false)

  const toggleCategory = (c: string) => {
    const next = filters.categories.includes(c)
      ? filters.categories.filter((x) => x !== c)
      : [...filters.categories, c]
    onChange({ ...filters, categories: next })
  }
  const toggleStatus = (s: CanvasStatus) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter((x) => x !== s)
      : [...filters.statuses, s]
    onChange({ ...filters, statuses: next })
  }
  const setSort = (s: ActiveFilters['sort']) => onChange({ ...filters, sort: s })
  const setSearch = (q: string) => onChange({ ...filters, search: q })
  const clear = () => onChange(DEFAULT_FILTERS)
  const hasActive =
    filters.categories.length > 0 ||
    filters.statuses.length > 0 ||
    filters.search.length > 0 ||
    filters.sort !== 'trending'

  return (
    <Surface variant="secondary" className="rounded-[var(--radius)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search field (Phase 2: HeroUI SearchField compound → Input + leading icon + clear button) */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted)] pointer-events-none" aria-hidden />
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search canvases…"
            aria-label="Search canvases"
            className="pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center size-6 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Sort selector (Phase 2: HeroUI ToggleButtonGroup → shadcn single-select ToggleGroup) */}
        <ToggleGroup
          type="single"
          value={filters.sort}
          onValueChange={(v) => { if (v) setSort(v as ActiveFilters['sort']) }}
          variant="outline"
          size="sm"
          aria-label="Sort canvases by"
          className="ml-auto"
        >
          {SORT_OPTIONS.map((opt) => (
            <ToggleGroupItem key={opt.value} value={opt.value} className="px-3">
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((s) => (
          <CategoryChip
            key={s.value}
            label={s.label}
            tone="surface"
            selected={filters.statuses.includes(s.value)}
            onClick={() => toggleStatus(s.value)}
          />
        ))}

        {/* Phase 2: HeroUI Disclosure (used only as a controlled toggle) → plain toggle Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowCats((v) => !v)}
          aria-expanded={showCats}
          className="ml-2"
        >
          Categories
          {filters.categories.length > 0 && (
            <Badge className="ml-1">{filters.categories.length}</Badge>
          )}
          <svg
            width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden
            className={['transition-transform', showCats ? 'rotate-180' : ''].join(' ')}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Button>

        <span className="ml-auto text-sm text-[var(--muted)]">
          <span className="font-bold text-[var(--foreground)]">{resultCount}</span> {resultCount === 1 ? 'result' : 'results'}
        </span>
        {hasActive && (
          <Button onClick={clear} variant="ghost" size="sm">
            Clear all
          </Button>
        )}
      </div>

      {showCats && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              tone="surface"
              selected={filters.categories.includes(c)}
              onClick={() => toggleCategory(c)}
            />
          ))}
        </div>
      )}
    </Surface>
  )
}
