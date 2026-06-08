import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Alert, Breadcrumbs, Button, Checkbox, CheckboxGroup, Input, Radio, RadioGroup,
  Separator, Spinner, Surface, TextArea,
} from '@heroui/react'
import { ButtonLink } from '../components/ui/ButtonLink'
import { useAuth } from '../state/AuthContext'
import { createCanvas } from '../services/canvasService'
import { CATEGORIES } from '../mock/categories'
import { STYLES } from '../mock/styles'
import { PALETTES, findPalette } from '../mock/palettes'
import { WizardStepper } from '../components/wizard/WizardStepper'
import { CategoryChip } from '../components/canvas/CategoryChip'
import { PalettePreview } from '../components/canvas/PalettePreview'
import { ProgressBar } from '../components/canvas/ProgressBar'
import { StatusBadge } from '../components/canvas/StatusBadge'
import { PremiumUpsellCard } from '../components/dashboard/PremiumUpsellCard'
import { Eyebrow } from '../components/ui/Eyebrow'
import { Heading } from '../components/ui/Heading'
import { useContentModeration } from '../hooks/useContentModeration'
import { gridForParticipants } from '../lib/privateGrid'
import { buildGuestLink, buildHostLink } from '../lib/canvasLink'
import { COMPLETED_TILES_REQUIRED_TO_FOUND } from '../types/domain'
import type { Canvas as CanvasDomain } from '../types/domain'
import type { ToolId } from '../types'

const WIZARD_STEPS = [
  { id: 'basic',   label: 'Basics' },
  { id: 'setup',   label: 'Setup' },
  { id: 'rules',   label: 'Rules' },
  { id: 'publish', label: 'Publish' },
]

type AspectRatioId = '1:1' | '4:3' | '16:9' | '21:9' | '3:4' | '9:16'

const GRID_RATIOS: { id: AspectRatioId; label: string; sizes: { rows: number; cols: number }[] }[] = [
  { id: '1:1',  label: '1:1',  sizes: [{ cols:2,rows:2 }, { cols:4,rows:4 }, { cols:5,rows:5 }, { cols:6,rows:6 }, { cols:8,rows:8 }, { cols:10,rows:10 }] },
  { id: '4:3',  label: '4:3',  sizes: [{ cols:4,rows:3 }, { cols:8,rows:6 }, { cols:12,rows:9 }] },
  { id: '16:9', label: '16:9', sizes: [{ cols:8,rows:5 }, { cols:16,rows:9 }] },
  { id: '21:9', label: '21:9', sizes: [{ cols:7,rows:3 }, { cols:14,rows:6 }] },
  { id: '3:4',  label: '3:4',  sizes: [{ cols:3,rows:4 }, { cols:6,rows:8 }, { cols:9,rows:12 }] },
  { id: '9:16', label: '9:16', sizes: [{ cols:5,rows:8 }, { cols:9,rows:16 }] },
]

const TOOL_OPTIONS: { id: ToolId; label: string }[] = [
  { id: 'brush', label: 'Brush' }, { id: 'pencil', label: 'Pencil' },
  { id: 'pen', label: 'Ink Pen' }, { id: 'marker', label: 'Marker' },
  { id: 'watercolor', label: 'Watercolor' }, { id: 'spray', label: 'Spray' },
  { id: 'eraser', label: 'Eraser' }, { id: 'smudge', label: 'Smudge' },
]

interface FormState {
  title: string; description: string; topic: string; category: string; style: string
  gridRows: number; gridCols: number; aspectRatioId: AspectRatioId
  visibility: 'public' | 'private-link'
  participationMode: 'free-pick' | 'random'
  /** Private canvases only: requested number of drawing participants. */
  participants: number
  styleGuidance: string
  paletteId: string | null
  allowedToolIds: ToolId[]
  background: string
}

const DEFAULT_FORM: FormState = {
  title: '', description: '', topic: '', category: 'Landscape', style: 'Painterly',
  gridRows: 5, gridCols: 5, aspectRatioId: '1:1' as AspectRatioId,
  visibility: 'public', participationMode: 'free-pick',
  participants: 6,
  styleGuidance: '', paletteId: null, allowedToolIds: [], background: '#ffffff',
}

const PREVIEW_GRADIENT = (palette: string[] | null) =>
  palette && palette.length >= 2
    ? `linear-gradient(135deg, ${palette[0]} 0%, ${palette[Math.floor(palette.length / 2)]} 60%, ${palette[palette.length - 1]} 100%)`
    : 'linear-gradient(135deg, #0d1a2d 0%, #5c8a6c 50%, #d6ee5a 100%)'

export default function CreateCanvasWizard() {
  const { user, entitlement } = useAuth()
  if (!user || !entitlement) return <Navigate to="/login" replace />
  if (!entitlement.canCreateCanvas) return <SoftLockedState />
  return <Wizard />
}

function SoftLockedState() {
  const { user, entitlement } = useAuth()
  if (!user || !entitlement) return null
  const remaining = entitlement.remainingTilesToFound
  const done = Math.min(COMPLETED_TILES_REQUIRED_TO_FOUND, user.completedTilesCount)

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 py-10 sm:py-14">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/dashboard">Dashboard</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/create-canvas">Create canvas</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="mt-6">
        <Heading level={1} size="lg">Found your own mosaic.</Heading>
        <p className="mt-4 text-base text-[var(--muted)] max-w-2xl leading-relaxed">
          You're not quite there yet — complete a few more tiles to earn the right to start
          your own canvas, or skip the wait with Premium.
        </p>
      </header>

      <Surface variant="secondary" className="mt-8 rounded-[var(--radius)] p-7 sm:p-9">
        <Heading level={2} size="md">
          {remaining} more {remaining === 1 ? 'tile' : 'tiles'} to unlock.
        </Heading>
        <p className="mt-4 text-base text-[var(--muted)] max-w-md leading-relaxed">
          Drawie founders earn it. Once you've contributed{' '}
          <span className="font-bold text-[var(--foreground)]">{COMPLETED_TILES_REQUIRED_TO_FOUND} tiles</span>{' '}
          to other mosaics, you can start your own.
        </p>
        <div className="mt-6 grid grid-cols-5 gap-2 w-full max-w-[340px]">
          {Array.from({ length: COMPLETED_TILES_REQUIRED_TO_FOUND }).map((_, i) => {
            const filled = i < done
            return (
              <div key={i} className={['aspect-square rounded-xl transition-all', filled ? 'bg-[var(--accent)]' : 'bg-[var(--surface)]'].join(' ')} />
            )
          })}
        </div>
        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <ButtonLink to="/" variant="primary" size="lg">Complete more tiles →</ButtonLink>
          <ButtonLink to="/premium?source=create" variant="secondary" size="lg">Go Premium</ButtonLink>
        </div>
      </Surface>

      <div className="mt-6"><PremiumUpsellCard /></div>
    </div>
  )
}

function Wizard() {
  const { user, entitlement } = useAuth()
  const isPremium = entitlement?.isPremium ?? false
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [createdLinks, setCreatedLinks] = useState<{ canvas: CanvasDomain } | null>(null)
  const moderation = useContentModeration()

  const palette = useMemo(
    () => (form.paletteId ? findPalette(form.paletteId)?.colors ?? null : null),
    [form.paletteId],
  )

  const stepValid: boolean[] = [
    form.title.trim().length > 1 && form.topic.trim().length > 0,
    true,
    form.styleGuidance.trim().length > 5,
    true,
  ]
  const canAdvance = stepValid[step]

  const onPublish = async () => {
    if (!user) return

    // Screen the canvas's text (title / description / topic / style rules)
    // before anything is created. Blocked content never reaches the catalog.
    const clean = await moderation.check({
      texts: [form.title, form.description, form.topic, form.styleGuidance],
    })
    if (!clean) return

    setPublishing(true)

    // Private canvases derive their grid from the participant count, are
    // always random-assigned, and get a guest + host link (generated server-side).
    const isPrivate = form.visibility === 'private-link' && isPremium
    const layout = isPrivate ? gridForParticipants(form.participants) : null
    const gridRows = layout ? layout.rows : form.gridRows
    const gridCols = layout ? layout.cols : form.gridCols

    try {
      const canvas = await createCanvas({
        title: form.title,
        description: form.description || form.topic,
        category: form.category,
        topic: form.topic,
        style: form.style,
        gridRows,
        gridCols,
        allowedTools: form.allowedToolIds,
        colorPalette: palette,
        background: form.background,
        styleGuidance: form.styleGuidance,
        participationMode: isPrivate ? 'random' : form.participationMode,
        visibility: isPrivate ? 'private-link' : 'public',
        neighborPreviewSize: 'small',
        previewGradient: PREVIEW_GRADIENT(palette),
        ...(isPrivate && { participantCount: form.participants }),
      })

      if (isPrivate) {
        setPublishing(false)
        setCreatedLinks({ canvas })   // show the links screen instead of navigating
        return
      }
      nav(`/canvas/${canvas.id}`, { replace: true })
    } catch (e) {
      setPublishing(false)
      setPublishError(
        e instanceof Error && e.message.includes('NOT_ENTITLED')
          ? 'You need 5 completed tiles (or Premium) to found a canvas.'
          : 'Could not publish the canvas. Please try again.',
      )
    }
  }

  if (createdLinks) {
    return <PrivateLinksCreated canvas={createdLinks.canvas} />
  }

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 py-10 sm:py-14">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/dashboard">Dashboard</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/create-canvas">Create canvas</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="mt-6 flex flex-col gap-5">
        <Heading level={1} size="lg">Found your mosaic.</Heading>
        <WizardStepper
          steps={WIZARD_STEPS}
          current={step}
          onJump={(i) => stepValid.slice(0, i).every(Boolean) && setStep(i)}
        />
      </header>

      <Surface variant="secondary" className="mt-8 rounded-[var(--radius)] p-6 sm:p-8">
        {step === 0 && <BasicsStep form={form} setForm={setForm} />}
        {step === 1 && <SetupStep  form={form} setForm={setForm} isPremium={isPremium} />}
        {step === 2 && <RulesStep  form={form} setForm={setForm} />}
        {step === 3 && <PublishStep form={form} palette={palette} />}
      </Surface>

      {moderation.isFlagged && (
        <Alert status="danger" className="mt-6">
          <Alert.Content>
            <Alert.Title>
              {moderation.status === 'error' ? "Couldn't review the canvas" : 'Cannot publish'}
            </Alert.Title>
            <Alert.Description className="text-sm leading-snug">{moderation.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {publishError && (
        <Alert status="danger" className="mt-6">
          <Alert.Content>
            <Alert.Title>Cannot publish</Alert.Title>
            <Alert.Description className="text-sm leading-snug">{publishError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="md"
          onPress={() => { moderation.reset(); setStep((s) => Math.max(0, s - 1)) }}
          isDisabled={step === 0 || publishing || moderation.isChecking}
        >
          ← Back
        </Button>
        {step < WIZARD_STEPS.length - 1 ? (
          <Button
            variant="primary"
            size="md"
            onPress={() => setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))}
            isDisabled={!canAdvance}
          >
            Continue →
          </Button>
        ) : (
          <Button variant="primary" size="md" onPress={onPublish} isDisabled={publishing || moderation.isChecking}>
            {moderation.isChecking
              ? <><Spinner size="sm" /> Reviewing content…</>
              : publishing
                ? <><Spinner size="sm" /> Publishing…</>
                : <>Publish canvas <span aria-hidden>→</span></>}
          </Button>
        )}
      </div>
    </div>
  )
}

function PrivateLinksCreated({ canvas }: { canvas: CanvasDomain }) {
  const nav = useNavigate()
  const origin = window.location.origin
  const guestLink = buildGuestLink(origin, canvas)
  const hostLink = buildHostLink(origin, canvas)

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 py-10 sm:py-14">
      <header className="text-center mb-8">
        <Eyebrow variant="dot" className="justify-center">Private canvas created</Eyebrow>
        <Heading level={1} size="lg" className="mt-3">Share your links</Heading>
        <p className="mt-3 text-sm text-[var(--muted)] max-w-md mx-auto leading-relaxed">
          "{canvas.title}" is invite-only. Send the guest link to participants, and keep the host
          link to manage the canvas. Each participant is assigned an artboard automatically on join.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <LinkRow
          label="Guest link"
          hint="For all participants — no account needed."
          url={guestLink}
        />
        <LinkRow
          label="Host link"
          hint="Private — opens the management console."
          url={hostLink}
          accent
        />
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Button variant="primary" size="lg" fullWidth onPress={() => nav(`/host/${canvas.hostToken}`)}>
          Open host console →
        </Button>
        <Button variant="secondary" size="lg" fullWidth onPress={() => nav('/dashboard')}>
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}

function LinkRow({ label, hint, url, accent }: { label: string; hint: string; url: string; accent?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <Surface
      variant="secondary"
      className={['rounded-[var(--radius)] p-4', accent ? 'ring-1 ring-[var(--accent)]' : ''].join(' ')}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-sm font-extrabold text-[var(--foreground)]">{label}</span>
        <span className="text-[11px] text-[var(--muted)]">{hint}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate px-3 py-2 rounded-lg bg-[var(--surface)] font-mono text-xs text-[var(--muted)]">
          {url}
        </code>
        <Button variant={copied ? 'secondary' : 'primary'} size="sm" onPress={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
      </div>
    </Surface>
  )
}

function BasicsStep({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeader eyebrow="Step 1 of 4" title="The basics" body="Give your canvas a name, topic and category. This is what visitors see first." />

      <Field label="Title" required>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Reef Bloom" maxLength={48} />
      </Field>

      <Field label="Topic / theme" required hint="A short phrase describing the subject. Used in cards and detail.">
        <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Coral reef ecosystem at dawn" maxLength={64} />
      </Field>

      <Field label="Short description" hint="One or two sentences. Optional.">
        <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Tell people what to expect, why you're starting this mosaic." maxLength={240} />
      </Field>

      <Separator />

      <Field label="Category">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <CategoryChip key={c} label={c} selected={form.category === c} onClick={() => setForm({ ...form, category: c })} tone="surface" />
          ))}
        </div>
      </Field>

      <Field label="Style">
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map((s) => (
            <CategoryChip key={s} label={s} selected={form.style === s} onClick={() => setForm({ ...form, style: s })} tone="surface" />
          ))}
        </div>
      </Field>
    </div>
  )
}

const MIN_PARTICIPANTS = 2
const MAX_PARTICIPANTS = 64

function SetupStep({
  form, setForm, isPremium,
}: {
  form: FormState
  setForm: (f: FormState) => void
  isPremium: boolean
}) {
  const isPrivate = form.visibility === 'private-link'
  const layout = gridForParticipants(form.participants)

  return (
    <div className="flex flex-col gap-6">
      <StepHeader eyebrow="Step 2 of 4" title="Canvas setup" body="How big is the mosaic and how do people join?" />

      <Field label="Visibility">
        <RadioGroup
          value={form.visibility}
          onChange={(v) => {
            const vis = v as FormState['visibility']
            // Private canvases are link-only and always random-assigned.
            setForm({
              ...form,
              visibility: vis,
              participationMode: vis === 'private-link' ? 'random' : form.participationMode,
            })
          }}
        >
          <div className="flex flex-col gap-2">
            <RadioCard value="public" label="Public" hint="Anyone can find and join from Discover." />
            <RadioCard
              value="private-link"
              label={isPremium ? 'Private link' : 'Private link · Premium'}
              hint={isPremium
                ? 'Hidden from discovery — only people with the link can join.'
                : 'Premium only. Upgrade to create invite-only canvases.'}
              disabled={!isPremium}
            />
          </div>
        </RadioGroup>
      </Field>

      {isPrivate ? (
        <Field
          label="Participants"
          hint="Number of people drawing (the host isn't counted). The mosaic layout is calculated automatically."
        >
          <div className="flex items-center gap-3">
            <Stepper
              value={form.participants}
              min={MIN_PARTICIPANTS}
              max={MAX_PARTICIPANTS}
              onChange={(participants) => {
                const g = gridForParticipants(participants)
                setForm({ ...form, participants, gridCols: g.cols, gridRows: g.rows })
              }}
            />
          </div>

          {/* Computed layout preview */}
          <div className="mt-4 flex items-center gap-4 p-4 rounded-2xl bg-[var(--surface-secondary)]">
            <div className="relative w-20 h-20 shrink-0">
              <div
                className="absolute inset-0 grid gap-[2px]"
                style={{
                  gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                }}
              >
                {Array.from({ length: layout.cells }).map((_, i) => {
                  const isHostCell = i >= form.participants
                  return (
                    <div
                      key={i}
                      className={[
                        'rounded-[2px]',
                        isHostCell ? 'bg-[var(--accent)]' : 'bg-[var(--foreground)]/25',
                      ].join(' ')}
                    />
                  )
                })}
              </div>
            </div>
            <div className="text-sm">
              <div className="font-extrabold text-[var(--foreground)]">
                {layout.cols} × {layout.rows} mosaic · {layout.ratio}
              </div>
              <div className="text-[var(--muted)] mt-0.5">
                {form.participants} {form.participants === 1 ? 'participant' : 'participants'}
                {layout.hostExtra > 0 && (
                  <> · <span className="text-[var(--accent)] font-semibold">
                    {layout.hostExtra} host artboard{layout.hostExtra === 1 ? '' : 's'}
                  </span></>
                )}
              </div>
            </div>
          </div>
        </Field>
      ) : (
        <>
          <Field label="Aspect ratio">
            <div className="flex flex-wrap gap-1.5">
              {GRID_RATIOS.map((r) => (
                <CategoryChip
                  key={r.id}
                  label={r.label}
                  selected={form.aspectRatioId === r.id}
                  tone="surface"
                  onClick={() => {
                    const first = r.sizes[0]
                    setForm({ ...form, aspectRatioId: r.id, gridCols: first.cols, gridRows: first.rows })
                  }}
                />
              ))}
            </div>
          </Field>

          <Field label="Grid size" hint={`${form.gridCols}×${form.gridRows} · ${form.gridRows * form.gridCols} tiles`}>
            <div className="flex flex-wrap gap-2">
              {(GRID_RATIOS.find((r) => r.id === form.aspectRatioId) ?? GRID_RATIOS[0]).sizes.map((g) => {
                const sel = g.rows === form.gridRows && g.cols === form.gridCols
                return (
                  <button
                    key={`${g.cols}x${g.rows}`}
                    type="button"
                    onClick={() => setForm({ ...form, gridCols: g.cols, gridRows: g.rows })}
                    className={[
                      'flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition active:scale-95',
                      sel ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'bg-[var(--surface)] hover:bg-[var(--surface-tertiary)] text-[var(--foreground)]',
                    ].join(' ')}
                  >
                    <div className="relative w-10 h-10 overflow-hidden">
                      <div
                        className="absolute inset-0 grid gap-[1px]"
                        style={{
                          gridTemplateColumns: `repeat(${g.cols}, 1fr)`,
                          gridTemplateRows: `repeat(${g.rows}, 1fr)`,
                        }}
                      >
                        {Array.from({ length: g.rows * g.cols }).map((_, i) => (
                          <div key={i} className={['rounded-[1px]', sel ? 'bg-[var(--foreground)]/60' : 'bg-[var(--foreground)]/15'].join(' ')} />
                        ))}
                      </div>
                    </div>
                    <div className="text-xs font-bold tabular-nums">{g.cols}×{g.rows}</div>
                    <div className="text-[10px] font-semibold opacity-60">{g.cols * g.rows} tiles</div>
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Tile assignment">
            <RadioGroup value={form.participationMode} onChange={(v) => setForm({ ...form, participationMode: v as FormState['participationMode'] })}>
              <div className="flex flex-col gap-2">
                <RadioCard value="free-pick" label="Free pick" hint="Contributors choose their tile." />
                <RadioCard value="random" label="Random" hint="Tile is assigned on join." />
              </div>
            </RadioGroup>
          </Field>
        </>
      )}
    </div>
  )
}

function RulesStep({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const allToolsAllowed = form.allowedToolIds.length === 0

  return (
    <div className="flex flex-col gap-6">
      <StepHeader eyebrow="Step 3 of 4" title="Style rules" body="Set the constraints that make this mosaic recognizable." />

      <Field label="Style guidance" required hint="Shown to every contributor inside drawing mode. Keep it punchy.">
        <TextArea value={form.styleGuidance} onChange={(e) => setForm({ ...form, styleGuidance: e.target.value })} rows={3} placeholder="e.g. Strong directional lighting. Leave white space. No neon." maxLength={200} />
      </Field>

      <Separator />

      <Field label="Allowed tools" hint={allToolsAllowed ? 'All tools allowed (no restriction)' : `${form.allowedToolIds.length} of ${TOOL_OPTIONS.length} allowed`}>
        <CheckboxGroup value={form.allowedToolIds} onChange={(v) => setForm({ ...form, allowedToolIds: v as ToolId[] })}>
          <div className="flex flex-wrap gap-2">
            {TOOL_OPTIONS.map((t) => (
              <Checkbox key={t.id} value={t.id}>
                <Checkbox.Control />
                <Checkbox.Content>{t.label}</Checkbox.Content>
              </Checkbox>
            ))}
          </div>
        </CheckboxGroup>
        {!allToolsAllowed && (
          <Button variant="ghost" size="sm" onPress={() => setForm({ ...form, allowedToolIds: [] })} className="self-start mt-2 text-[11px] font-semibold text-[var(--accent)]">
            Allow all tools
          </Button>
        )}
      </Field>

      <Field label="Color palette" hint="Restrict the color picker to a specific palette. Optional.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <PaletteCard label="No restriction" colors={['#0d1a2d', '#264363', '#2f5742', '#5c8a6c', '#d6ee5a', '#dfeacf']} selected={!form.paletteId} onClick={() => setForm({ ...form, paletteId: null })} free />
          {PALETTES.map((p) => (
            <PaletteCard key={p.id} label={p.name} colors={p.colors} selected={form.paletteId === p.id} onClick={() => setForm({ ...form, paletteId: p.id })} />
          ))}
        </div>
      </Field>

      <Field label="Background">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.background === 'transparent' ? '#ffffff' : form.background}
            onChange={(e) => setForm({ ...form, background: e.target.value })}
            className="w-10 h-10 rounded-xl cursor-pointer"
            disabled={form.background === 'transparent'}
          />
          <Input
            value={form.background}
            onChange={(e) => setForm({ ...form, background: e.target.value })}
            className="flex-1"
          />
          <Button
            variant={form.background === 'transparent' ? 'primary' : 'secondary'}
            size="md"
            onPress={() => setForm({ ...form, background: form.background === 'transparent' ? '#ffffff' : 'transparent' })}
            className="text-xs font-bold"
          >
            Transparent
          </Button>
        </div>
      </Field>
    </div>
  )
}

function PublishStep({ form, palette }: { form: FormState; palette: string[] | null }) {
  const total = form.gridRows * form.gridCols
  return (
    <div className="flex flex-col gap-6">
      <StepHeader eyebrow="Step 4 of 4" title="Preview & publish" body="Final check before your canvas goes live." />

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl overflow-hidden bg-[var(--surface)] max-h-64">
          <div className="relative w-full" style={{ background: PREVIEW_GRADIENT(palette), aspectRatio: `${form.gridCols}/${form.gridRows}` }}>
            <div className="absolute inset-0 backdrop-blur-md bg-white/10" />
            <div className="absolute inset-3 grid gap-[2px] opacity-90" style={{ gridTemplateColumns: `repeat(${form.gridCols}, 1fr)`, gridTemplateRows: `repeat(${form.gridRows}, 1fr)` }}>
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} className="rounded-[1px] bg-white/20 backdrop-blur-sm" />
              ))}
            </div>
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5"><StatusBadge status="open" /></div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <CategoryChip label={form.category} tone="surface" />
              <CategoryChip label={form.style} tone="surface" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">{form.title || 'Untitled canvas'}</h3>
              <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{form.description || form.topic || '—'}</p>
            </div>
            <ProgressBar completed={0} total={total} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <SummaryRow label="Grid">{form.gridRows} × {form.gridCols} · {total} tiles</SummaryRow>
          <SummaryRow label="Visibility">{form.visibility === 'public' ? 'Public' : 'Private link'}</SummaryRow>
          <SummaryRow label="Tile assignment">{form.participationMode === 'free-pick' ? 'Free pick' : 'Random'}</SummaryRow>
          <SummaryRow label="Background">{form.background}</SummaryRow>
          <SummaryRow label="Palette">
            {palette ? <div className="flex items-center gap-2"><PalettePreview colors={palette} size={14} /><span className="text-[11px] text-[var(--muted)]">{palette.length} colors</span></div> : 'No restriction'}
          </SummaryRow>
          <SummaryRow label="Tools">
            {form.allowedToolIds.length === 0 ? 'All tools' : form.allowedToolIds.map((t) => TOOL_OPTIONS.find((o) => o.id === t)?.label).join(', ')}
          </SummaryRow>
          <Surface variant="secondary" className="mt-2 rounded-2xl p-4">
            <Eyebrow variant="dot" className="mb-2 inline-block">Style guidance</Eyebrow>
            <p className="mt-1 text-xs italic text-[var(--foreground)] leading-snug">"{form.styleGuidance || '—'}"</p>
          </Surface>
        </div>
      </div>
    </div>
  )
}

function StepHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-[var(--muted)] font-bold">{eyebrow}</div>
      <Heading level={2} size="sm" className="mt-1.5">{title}</Heading>
      <p className="mt-1.5 text-sm text-[var(--muted)]">{body}</p>
    </div>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-baseline gap-1.5">
        <span className="text-[11px] text-[var(--muted)] font-bold">{label}</span>
        {required && <span className="text-[10px] text-[var(--danger)] font-bold">required</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--muted)] leading-snug">{hint}</p>}
    </div>
  )
}

function RadioCard({ value, label, hint, disabled }: { value: string; label: string; hint: string; disabled?: boolean }) {
  return (
    <Radio
      value={value}
      isDisabled={disabled}
      className="flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition bg-[var(--surface)] hover:bg-[var(--surface-tertiary)] data-[selected=true]:bg-[var(--surface)] data-[selected=true]:ring-1 data-[selected=true]:ring-[var(--accent)] data-[disabled=true]:opacity-55 data-[disabled=true]:cursor-not-allowed"
    >
      <Radio.Control />
      <Radio.Content>
        <div className="text-sm font-bold text-[var(--foreground)]">{label}</div>
        <div className="text-[11px] text-[var(--muted)] mt-0.5">{hint}</div>
      </Radio.Content>
    </Radio>
  )
}

/** Compact +/− number stepper. */
function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)))
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[var(--surface-secondary)]">
      <button type="button" onClick={() => set(value - 1)} disabled={value <= min}
        className="w-10 h-10 rounded-xl text-lg font-bold text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed transition">−</button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => set(parseInt(e.target.value, 10) || min)}
        className="w-16 h-10 text-center bg-transparent text-lg font-extrabold tabular-nums text-[var(--foreground)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => set(value + 1)} disabled={value >= max}
        className="w-10 h-10 rounded-xl text-lg font-bold text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed transition">+</button>
    </div>
  )
}

function PaletteCard({ label, colors, selected, onClick, free }: { label: string; colors: string[]; selected: boolean; onClick: () => void; free?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col gap-2 p-3 rounded-2xl transition active:scale-95 text-left',
        selected ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'bg-[var(--surface)] hover:bg-[var(--surface-tertiary)] text-[var(--foreground)]',
      ].join(' ')}
    >
      <div className="flex items-center gap-1">
        {colors.slice(0, 6).map((c, i) => <span key={i} className="w-5 h-5 rounded-md" style={{ background: c }} />)}
      </div>
      <div className="text-xs font-bold">
        {label}
        {free && <span className="ml-1.5 text-[9px] font-bold text-[var(--muted)]">Default</span>}
      </div>
    </button>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-[11px] text-[var(--muted)] font-bold">{label}</span>
      <span className="text-sm text-[var(--muted)] font-medium text-right">{children}</span>
    </div>
  )
}
