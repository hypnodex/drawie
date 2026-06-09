import { useState } from 'react'
import { Button, Tooltip } from '@heroui/react'
import { Layer, MAX_LAYERS } from '@drawie/core'
import {
  ChevronDownIcon, EyeIcon, EyeOffIcon, LayersIcon,
  MergeDownIcon, PlusIcon, TrashIcon,
} from '../icons'

interface Props {
  layers: Layer[]
  activeLayerId: string
  onSelect: (id: string) => void
  onToggleVisible: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onMergeDown: (id: string) => void
  floating?: boolean
}

export function LayersPanel({
  layers, activeLayerId, onSelect, onToggleVisible, onAdd, onRemove, onMergeDown, floating,
}: Props) {
  const reversed = [...layers].reverse()
  const canAdd = layers.length < MAX_LAYERS
  const canRemove = layers.length > 1
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className={[
        'flex flex-col gap-2',
        floating ? 'w-64 p-3 rounded-2xl bg-[var(--surface)]/95 backdrop-blur shadow-lg' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--muted)]">
          <LayersIcon width={12} height={12} />
          <span>Layers</span>
          <span className="text-[var(--muted)] normal-case tracking-normal">
            ({layers.length}/{MAX_LAYERS})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <Tooltip.Trigger>
              <Button isIconOnly size="sm" variant="secondary" onPress={onAdd} isDisabled={!canAdd} aria-label="Add layer">
                <PlusIcon width={16} height={16} />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>{canAdd ? 'Add layer' : `Max ${MAX_LAYERS} layers`}</Tooltip.Content>
          </Tooltip>
          {floating && (
            <Tooltip>
              <Tooltip.Trigger>
                <Button isIconOnly size="sm" variant="ghost" onPress={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand' : 'Collapse'}>
                  <span className={['inline-flex transition-transform', collapsed ? '-rotate-90' : ''].join(' ')}>
                    <ChevronDownIcon width={18} height={18} />
                  </span>
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>{collapsed ? 'Expand' : 'Collapse'}</Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </div>

      {!collapsed && (
        <ul className="flex flex-col gap-1">
          {reversed.map((layer, displayIndex) => {
            const active = layer.id === activeLayerId
            const realIndex = layers.length - 1 - displayIndex
            const canMerge = realIndex > 0
            return (
              <li key={layer.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(layer.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(layer.id) }}
                  aria-pressed={active}
                  className={[
                    'group flex items-center gap-2 px-2.5 py-2 rounded-xl transition cursor-pointer',
                    active
                      ? 'bg-[color-mix(in_oklab,var(--accent)_15%,var(--surface))] text-[var(--foreground)]'
                      : 'bg-[var(--surface-secondary)] text-[var(--muted)] hover:bg-[var(--surface-tertiary)]',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleVisible(layer.id) }}
                    title={layer.visible ? 'Hide layer' : 'Show layer'}
                    aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                    className={[
                      'flex items-center justify-center w-8 h-8 rounded-lg active:scale-90 transition-transform',
                      layer.visible ? 'text-[var(--foreground)]' : 'text-[var(--muted)]',
                    ].join(' ')}
                  >
                    {layer.visible ? <EyeIcon width={17} height={17} /> : <EyeOffIcon width={17} height={17} />}
                  </button>

                  <span className={['flex-1 text-sm font-medium truncate', layer.visible ? '' : 'opacity-60'].join(' ')}>
                    {layer.name}
                  </span>

                  <span className="text-[11px] text-[var(--muted)] font-mono">{realIndex + 1}</span>

                  {canMerge && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onMergeDown(layer.id) }}
                      title="Merge down"
                      aria-label="Merge down"
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--accent)] transition"
                    >
                      <MergeDownIcon width={16} height={16} />
                    </button>
                  )}
                  {canRemove && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRemove(layer.id) }}
                      title="Delete layer"
                      aria-label="Delete layer"
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--danger)] transition"
                    >
                      <TrashIcon width={15} height={15} />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
