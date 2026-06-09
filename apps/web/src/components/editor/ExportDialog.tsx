import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Chip, Modal } from '@heroui/react'
import type { Canvas } from '@drawie/data'
import { useAuth } from '../../state/AuthContext'
import { Eyebrow } from '../ui/Eyebrow'

interface Props {
  isOpen: boolean
  onClose: () => void
  canvas: Canvas
}

type TierId = 'low' | 'high' | 'print'
type ExportState = 'idle' | 'preparing' | 'done'

interface Tier {
  id: TierId
  label: string
  dimensions: string
  format: 'JPG' | 'PNG'
  desc: string
  gridDots: number  // dot-grid cells per side — more = visually higher res
  free: boolean
}

const TIERS: Tier[] = [
  {
    id: 'low',
    label: 'Low res',
    dimensions: '800 × 800 px',
    format: 'JPG',
    desc: 'Optimised for social media and quick sharing.',
    gridDots: 3,
    free: true,
  },
  {
    id: 'high',
    label: 'High res',
    dimensions: '1 500 × 1 500 px',
    format: 'JPG',
    desc: 'High quality for screens and digital display.',
    gridDots: 5,
    free: true,
  },
  {
    id: 'print',
    label: 'Print quality',
    dimensions: '4 000 × 4 000 px',
    format: 'PNG',
    desc: 'Full resolution, lossless PNG — suitable for large-format print.',
    gridDots: 7,
    free: false,
  },
]

export function ExportDialog({ isOpen, onClose, canvas }: Props) {
  const { entitlement } = useAuth()
  const nav = useNavigate()
  const [tierId, setTierId] = useState<TierId>('high')
  const [exportState, setExportState] = useState<ExportState>('idle')

  const isPremium = entitlement?.isPremium ?? false
  const selectedTier = TIERS.find((t) => t.id === tierId)!

  const handleExport = async () => {
    setExportState('preparing')
    await new Promise((r) => setTimeout(r, 1100))
    setExportState('done')
  }

  const close = () => {
    onClose()
    setTimeout(() => { setExportState('idle'); setTierId('high') }, 250)
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && close()}>
      <Modal.Backdrop variant="blur">
        <Modal.Container size="md" placement="center">
          <Modal.Dialog>

            <Modal.Header className="mb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow variant="dot">Export artwork</Eyebrow>
                  <h2 className="mt-1.5 text-xl font-extrabold tracking-tight text-[var(--foreground)]">
                    {canvas.title}
                  </h2>
                </div>
                <Chip color="success" variant="primary" size="sm" className="shrink-0 mt-1">
                  Completed
                </Chip>
              </div>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-2.5">
              {TIERS.map((tier) => {
                const locked = !tier.free && !isPremium
                return (
                  <TierCard
                    key={tier.id}
                    tier={tier}
                    selected={tierId === tier.id}
                    locked={locked}
                    onSelect={() => { if (!locked) setTierId(tier.id) }}
                    onUpgrade={() => { close(); nav('/premium?source=export') }}
                  />
                )
              })}

              {exportState === 'done' && (
                <div className="mt-1 p-4 rounded-2xl flex items-center justify-between gap-3 bg-[color-mix(in_oklab,var(--success)_10%,transparent)]">
                  <div>
                    <p className="text-sm font-bold text-[var(--foreground)]">Export ready</p>
                    <p className="text-xs text-[var(--muted)] font-mono mt-0.5">
                      {selectedTier.dimensions} · {selectedTier.format}
                    </p>
                  </div>
                  <Button variant="primary" size="sm" onPress={close}>
                    Download ↓
                  </Button>
                </div>
              )}
            </Modal.Body>

            <Modal.Footer className="mt-4 flex items-center justify-between gap-3">
              <Button variant="ghost" size="md" onPress={close}>Cancel</Button>
              {exportState !== 'done' && (
                <Button
                  variant="primary"
                  size="md"
                  onPress={handleExport}
                  isDisabled={exportState === 'preparing'}
                >
                  {exportState === 'preparing'
                    ? 'Preparing…'
                    : `Export ${selectedTier.dimensions} →`}
                </Button>
              )}
            </Modal.Footer>

          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

// ── Tier card ─────────────────────────────────────────────────────────────────

function TierCard({
  tier, selected, locked, onSelect, onUpgrade,
}: {
  tier: Tier
  selected: boolean
  locked: boolean
  onSelect: () => void
  onUpgrade: () => void
}) {
  return (
    <button
      type="button"
      onClick={locked ? undefined : onSelect}
      className={[
        'w-full flex items-center gap-4 p-4 rounded-2xl text-left transition active:scale-[0.99]',
        locked
          ? 'bg-[var(--surface-secondary)] cursor-default opacity-70'
          : selected
          ? 'bg-[color-mix(in_oklab,var(--accent)_12%,var(--surface-secondary))] ring-2 ring-[var(--accent)]'
          : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] cursor-pointer',
      ].join(' ')}
    >
      <DotGrid size={tier.gridDots} active={selected && !locked} locked={locked} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-extrabold text-[var(--foreground)]">{tier.label}</span>
          {tier.free
            ? <Chip color="default" variant="soft" size="sm">Free</Chip>
            : <Chip color="accent" variant="primary" size="sm">Premium</Chip>
          }
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
          {tier.dimensions} · {tier.format}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)] leading-snug">{tier.desc}</p>

        {locked && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUpgrade() }}
            className="mt-2 text-[11px] font-bold text-[var(--accent)] hover:opacity-75 transition-opacity inline-flex items-center gap-1"
          >
            Unlock with Premium
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>

      {!locked ? (
        <span className={[
          'shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition',
          selected
            ? 'border-[var(--accent)] bg-[var(--accent)]'
            : 'border-[var(--separator)] bg-transparent',
        ].join(' ')}>
          {selected && <span className="w-2 h-2 rounded-full bg-[var(--accent-foreground)]" />}
        </span>
      ) : (
        <span className="shrink-0 text-[var(--muted)]"><LockIcon /></span>
      )}
    </button>
  )
}

// ── Resolution visualiser ─────────────────────────────────────────────────────

function DotGrid({ size, active, locked }: { size: number; active: boolean; locked: boolean }) {
  const color = locked ? 'var(--muted)' : active ? 'var(--accent)' : 'var(--foreground)'
  return (
    <div
      className="shrink-0 grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, width: 44, height: 44 }}
      aria-hidden
    >
      {Array.from({ length: size * size }).map((_, i) => (
        <div
          key={i}
          className="rounded-[1px] transition-colors"
          style={{ background: color, opacity: active ? 0.8 : 0.18 }}
        />
      ))}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
