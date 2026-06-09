import { useSearchParams } from 'react-router-dom'
import { Alert, Breadcrumbs, Button, Chip, Surface } from '@heroui/react'
import { ButtonLink } from '../components/ui/ButtonLink'
import { useAuth } from '../state/AuthContext'
import { Heading } from '../components/ui/Heading'
import { Eyebrow } from '../components/ui/Eyebrow'

// ── Data types ───────────────────────────────────────────────────────────────

interface Feature {
  id: string
  title: string
  blurb: string
  body: string[]
}

type CellDef =
  | { type: 'check' }
  | { type: 'dash' }
  | { type: 'text'; label: string }
  | { type: 'chip'; label: string }
  | { type: 'coming' }

interface CompRow {
  label: string
  free: CellDef
  pro: CellDef
}

// ── Static data ──────────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    id: 'found',
    title: 'Found canvases anytime',
    blurb: 'Skip the 5-tile requirement',
    body: [
      'Start your own mosaic the moment inspiration strikes — no warm-up runs needed.',
      'Premium founders also unlock private-link canvas visibility.',
    ],
  },
  {
    id: 'preview',
    title: 'Bigger neighbour previews',
    blurb: 'See ~3× more of each neighbour',
    body: [
      'Free contributors see a 5% sliver of each neighbour tile. Premium expands that to ~16%.',
      'Match colours and strokes across seams without guesswork.',
    ],
  },
  {
    id: 'export',
    title: '4K print exports',
    blurb: 'Premium-resolution downloads',
    body: [
      'Standard exports cap at 1 500 px on the long edge. Premium delivers a 4 000 px PNG fit for large-format print.',
      'Available on any completed canvas you contributed to.',
    ],
  },
]

const FEATURE_ICONS = [FoundIcon, PreviewIcon, ExportIcon]

const ROWS: CompRow[] = [
  { label: 'Contribute tiles',         free: { type: 'check' },                        pro: { type: 'check' } },
  { label: 'Save / bookmark canvases', free: { type: 'check' },                        pro: { type: 'check' } },
  { label: 'Found canvases',           free: { type: 'text', label: 'After 5 tiles' }, pro: { type: 'chip', label: 'Anytime' } },
  { label: 'Neighbour preview',        free: { type: 'text', label: '5% sliver' },     pro: { type: 'chip', label: '~16% sliver' } },
  { label: 'Standard export',          free: { type: 'text', label: '1 500 px JPG' },  pro: { type: 'text', label: '1 500 px JPG' } },
  { label: '4K print export',          free: { type: 'dash' },                         pro: { type: 'chip', label: '4 000 px PNG' } },
  { label: 'Private-link canvases',    free: { type: 'dash' },                         pro: { type: 'chip', label: 'Yes' } },
  { label: 'Priority discovery',       free: { type: 'dash' },                         pro: { type: 'coming' } },
]

// ── Screen ───────────────────────────────────────────────────────────────────

export default function PremiumScreen() {
  const { user, entitlement, setIsPremium } = useAuth()
  const [params] = useSearchParams()
  const source = params.get('source')
  const isPremium = entitlement?.isPremium ?? false

  const sourceLabel = source === 'create'
    ? 'create your own canvas immediately'
    : source === 'export'
    ? 'unlock 4K print export'
    : 'unlock all premium features'

  return (
    <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-10 sm:py-14">
      <Breadcrumbs>
        <Breadcrumbs.Item href={user ? '/dashboard' : '/'}>{user ? 'Dashboard' : 'Discover'}</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/premium">Premium</Breadcrumbs.Item>
      </Breadcrumbs>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Surface variant="tertiary" className="mt-6 rounded-[var(--radius)] overflow-hidden">
        <div className="p-8 sm:p-12 flex flex-col md:flex-row md:items-center gap-10">

          {/* copy */}
          <div className="flex-1 min-w-0">
            <Chip
              color="accent" variant="primary" size="sm"
              className="mb-5 uppercase tracking-widest text-[10px] font-bold"
            >
              Pro tier
            </Chip>

            <Heading level={1} size="xl">
              Found bigger.<br />
              Draw deeper.<br />
              <span className="text-[var(--accent)]">Print sharper.</span>
            </Heading>

            <p className="mt-5 text-base sm:text-lg leading-relaxed text-[var(--muted)] max-w-xl">
              One tier, three concrete unlocks. Designed for serious collaborators
              and founders who want the full canvas experience.
              {source && (
                <>{' '}Use Premium to{' '}
                  <span className="font-semibold text-[var(--foreground)]">{sourceLabel}</span>.
                </>
              )}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {isPremium ? (
                <>
                  <Alert status="success" className="flex-none sm:max-w-sm">
                    <Alert.Content>
                      <Alert.Title>You're a Premium member</Alert.Title>
                    </Alert.Content>
                  </Alert>
                  <Button variant="secondary" size="lg" onPress={() => setIsPremium(false)}>
                    Turn off (demo)
                  </Button>
                </>
              ) : user ? (
                <Button variant="primary" size="lg" onPress={() => setIsPremium(true)}>
                  Enable Premium (demo) →
                </Button>
              ) : (
                <ButtonLink to="/login" variant="primary" size="lg">
                  Sign in to upgrade →
                </ButtonLink>
              )}
              {!isPremium && (
                <span className="text-sm text-[var(--muted)]">$9 / month · cancel anytime (mock)</span>
              )}
            </div>
          </div>

          {/* decorative mosaic */}
          <div className="hidden md:block shrink-0 select-none" aria-hidden>
            <MosaicDecoration />
          </div>
        </div>

        {/* stats strip */}
        <div className="border-t border-[var(--separator)] grid grid-cols-3 divide-x divide-[var(--separator)]">
          {[
            { value: '3',  label: 'exclusive unlocks' },
            { value: '$9', label: 'per month' },
            { value: '∞',  label: 'cancel anytime' },
          ].map(({ value, label }) => (
            <div key={label} className="py-4 flex flex-col items-center gap-1">
              <span className="text-2xl font-extrabold text-[var(--foreground)] tabular-nums">{value}</span>
              <span className="text-xs text-[var(--muted)]">{label}</span>
            </div>
          ))}
        </div>
      </Surface>

      {/* ── Feature cards ─────────────────────────────────────────────────── */}
      <section className="mt-10">
        <Eyebrow variant="dot" className="mb-5">What you unlock</Eyebrow>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = FEATURE_ICONS[i]
            return (
              <Surface key={f.id} variant="secondary" className="rounded-[var(--radius)] p-6 flex flex-col gap-5">
                {/* header row */}
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] shrink-0">
                    <Icon />
                  </div>
                  <Eyebrow className="tabular-nums">
                    {String(i + 1).padStart(2, '0')} / {String(FEATURES.length).padStart(2, '0')}
                  </Eyebrow>
                </div>

                {/* title */}
                <div>
                  <Heading level={3} size="sm">{f.title}</Heading>
                  <p className="mt-1.5 text-sm font-semibold text-[var(--accent)]">{f.blurb}</p>
                </div>

                {/* body */}
                <ul className="space-y-3 text-sm text-[var(--muted)] leading-relaxed flex-1">
                  {f.body.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <CheckIcon className="mt-0.5 shrink-0 text-[var(--success)]" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </Surface>
            )
          })}
        </div>
      </section>

      {/* ── Compare boxes ─────────────────────────────────────────────────── */}
      <section className="mt-10">
        <Eyebrow variant="dot" className="mb-5">Compare plans</Eyebrow>
        <div className="grid gap-4 sm:grid-cols-2 items-start">
          <FreePlanCard />
          <ProPlanCard
            isPremium={isPremium}
            hasUser={!!user}
            onEnable={() => setIsPremium(true)}
            onDisable={() => setIsPremium(false)}
          />
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      {!isPremium && (
        <Surface variant="tertiary" className="mt-10 rounded-[var(--radius)] p-8 sm:p-14 flex flex-col items-center text-center">
          <Chip
            color="accent" variant="primary" size="sm"
            className="mb-5 uppercase tracking-widest text-[10px] font-bold"
          >
            Try it now
          </Chip>

          <Heading level={2} size="lg" className="max-w-lg">
            Ready to draw<br />
            <span className="text-[var(--accent)]">at full depth?</span>
          </Heading>

          <p className="mt-5 text-sm text-[var(--muted)] max-w-md leading-relaxed">
            Toggles instantly in the demo. No credit card required.
            Switch back anytime from the profile menu.
          </p>

          <div className="mt-8">
            {user ? (
              <Button variant="primary" size="lg" onPress={() => setIsPremium(true)}>
                Enable Premium (demo) →
              </Button>
            ) : (
              <ButtonLink to="/login" variant="primary" size="lg">
                Sign in to upgrade →
              </ButtonLink>
            )}
          </div>
        </Surface>
      )}
    </div>
  )
}

// ── Plan cards ────────────────────────────────────────────────────────────────

function FreePlanCard() {
  return (
    <Surface variant="secondary" className="rounded-[var(--radius)] overflow-hidden flex flex-col">
      {/* header */}
      <div className="px-6 py-6 border-b border-[var(--separator)]">
        <Eyebrow className="mb-3">Free</Eyebrow>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-extrabold text-[var(--foreground)] tracking-tight">$0</span>
          <span className="text-sm text-[var(--muted)]">/ month</span>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)] leading-snug">
          Everything you need to start collaborating on mosaics.
        </p>
      </div>

      {/* feature rows */}
      <ul className="flex-1 divide-y divide-[var(--separator)]">
        {ROWS.map((row) => (
          <PlanRow key={row.label} label={row.label} def={row.free} />
        ))}
      </ul>
    </Surface>
  )
}

function ProPlanCard({
  isPremium, hasUser, onEnable, onDisable,
}: {
  isPremium: boolean
  hasUser: boolean
  onEnable: () => void
  onDisable: () => void
}) {
  return (
    <Surface
      variant="secondary"
      className="rounded-[var(--radius)] overflow-hidden flex flex-col ring-2 ring-[var(--accent)]"
    >
      {/* accent header */}
      <div className="px-6 py-6 border-b border-[var(--accent)]/20 bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]">
        <div className="flex items-center justify-between mb-3">
          <Eyebrow className="text-[var(--accent)] font-bold">Pro</Eyebrow>
          <Chip color="accent" variant="primary" size="sm"
            className="text-[9px] uppercase tracking-widest font-bold">
            Most popular
          </Chip>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-extrabold text-[var(--foreground)] tracking-tight">$9</span>
          <span className="text-sm text-[var(--muted)]">/ month</span>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)] leading-snug">
          Full canvas control, bigger previews, and print-quality output.
        </p>
      </div>

      {/* feature rows */}
      <ul className="flex-1 divide-y divide-[var(--separator)]">
        {ROWS.map((row) => (
          <PlanRow key={row.label} label={row.label} def={row.pro} pro />
        ))}
      </ul>

      {/* CTA */}
      <div className="px-6 pb-6 pt-4">
        {isPremium ? (
          <>
            <Alert status="success" className="mb-3">
              <Alert.Content><Alert.Title>You're on Pro</Alert.Title></Alert.Content>
            </Alert>
            <Button variant="secondary" size="md" fullWidth onPress={onDisable}>
              Turn off (demo)
            </Button>
          </>
        ) : hasUser ? (
          <Button variant="primary" size="lg" fullWidth onPress={onEnable}>
            Enable Premium (demo) →
          </Button>
        ) : (
          <ButtonLink to="/login" variant="primary" size="lg" fullWidth>
            Sign in to upgrade →
          </ButtonLink>
        )}
      </div>
    </Surface>
  )
}

function PlanRow({ label, def, pro = false }: { label: string; def: CellDef; pro?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4 px-6 py-3">
      <span className="text-sm text-[var(--foreground)]">{label}</span>
      <span className="shrink-0">
        <CellContent def={def} pro={pro} />
      </span>
    </li>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CellContent({ def, pro = false }: { def: CellDef; pro?: boolean }) {
  switch (def.type) {
    case 'check':
      return (
        <span className={['inline-flex', pro ? 'text-[var(--success)]' : 'text-[var(--foreground)]/40'].join(' ')}>
          <CheckIcon />
        </span>
      )
    case 'dash':
      return <span className="text-[var(--muted)] text-sm">—</span>
    case 'text':
      return <span className="text-sm text-[var(--muted)]">{def.label}</span>
    case 'chip':
      return <Chip color="accent" variant="primary" size="sm">{def.label}</Chip>
    case 'coming':
      return (
        <Chip color="default" variant="secondary" size="sm" className="text-[var(--muted)] text-[10px]">
          Coming soon
        </Chip>
      )
  }
}

/** Decorative 8×6 mosaic with three shades of the accent green. */
function MosaicDecoration() {
  const pattern = [
    [2, 0, 1, 2, 0, 1, 2, 0],
    [0, 1, 2, 0, 2, 0, 1, 2],
    [1, 2, 0, 1, 0, 2, 0, 1],
    [2, 0, 1, 2, 1, 0, 2, 0],
    [0, 2, 0, 1, 2, 1, 0, 2],
    [1, 0, 2, 0, 1, 2, 1, 0],
  ]
  const bg = (v: number) =>
    v === 2 ? 'var(--accent)' :
    v === 1 ? 'color-mix(in oklab, var(--accent) 40%, transparent)' :
              'color-mix(in oklab, var(--accent) 10%, transparent)'

  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
      {pattern.flat().map((v, i) => (
        <div key={i} className="w-8 h-8 rounded-lg" style={{ background: bg(v) }} />
      ))}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function FoundIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 17.5h6M17 14.5v6" />
    </svg>
  )
}

function PreviewIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12c0 0 3.5-7 10-7s10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3.5l2.5 2.5M21 3.5L18.5 6M3 20.5l2.5-2.5M21 20.5L18.5 18" />
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M3 12l4.5-4 4 4 3-2.5L21 14" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
