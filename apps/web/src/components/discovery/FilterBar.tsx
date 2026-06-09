import { useState, type Key } from 'react'
import {
  buttonVariants, Button, Chip, Disclosure, Label,
  SearchField, Surface, ToggleButton, ToggleButtonGroup,
} from '@heroui/react'
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
        {/* HeroUI v3 SearchField — canonical compound (Label + Group → SearchIcon + Input + ClearButton) */}
        <SearchField
          value={filters.search}
          onChange={setSearch}
          aria-label="Search canvases"
          className="flex-1 min-w-[200px] max-w-md"
        >
          <Label className="sr-only">Search canvases</Label>
          <SearchField.Group className="w-full">
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search canvases…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {/* HeroUI v3 ToggleButtonGroup — single-select sort selector */}
        <ToggleButtonGroup
          selectionMode="single"
          selectedKeys={new Set([filters.sort])}
          onSelectionChange={(keys) => {
            const next = Array.from(keys as Set<Key>)[0] as ActiveFilters['sort'] | undefined
            if (next) setSort(next)
          }}
          aria-label="Sort canvases by"
          className="ml-auto"
        >
          {SORT_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} id={opt.value}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
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

        <Disclosure isExpanded={showCats} onExpandedChange={setShowCats} className="ml-2">
          <Disclosure.Heading>
            <Disclosure.Trigger className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Categories
              {filters.categories.length > 0 && (
                <Chip color="accent" variant="primary" size="sm" className="ml-1">
                  {filters.categories.length}
                </Chip>
              )}
              <Disclosure.Indicator>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </Disclosure.Indicator>
            </Disclosure.Trigger>
          </Disclosure.Heading>
        </Disclosure>

        <span className="ml-auto text-sm text-[var(--muted)]">
          <span className="font-bold text-[var(--foreground)]">{resultCount}</span> {resultCount === 1 ? 'result' : 'results'}
        </span>
        {hasActive && (
          <Button onPress={clear} variant="ghost" size="sm">
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
