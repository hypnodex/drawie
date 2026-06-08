import { useRef, useState } from 'react'
import {
  Alert, Badge, Breadcrumbs, Button, Checkbox, CheckboxGroup,
  Chip, Input, Modal, Popover, Radio, RadioGroup, ScrollShadow,
  Separator, Spinner, Surface, Tab, Table, Tabs, TextArea, Tooltip,
} from '@heroui/react'
import { Heading } from '../components/ui/Heading'
import { Eyebrow } from '../components/ui/Eyebrow'
import { CategoryChip } from '../components/canvas/CategoryChip'
import { StatusBadge } from '../components/canvas/StatusBadge'
import { ProgressBar } from '../components/canvas/ProgressBar'

// ── TOC ──────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'typography',     title: 'Typography' },
  { id: 'colors',         title: 'Color tokens' },
  { id: 'buttons',        title: 'Buttons' },
  { id: 'chips',          title: 'Chips' },
  { id: 'badge',          title: 'Badge' },
  { id: 'form',           title: 'Form controls' },
  { id: 'surface',        title: 'Surface' },
  { id: 'feedback',       title: 'Feedback' },
  { id: 'navigation',     title: 'Navigation' },
  { id: 'modal',          title: 'Modal' },
  { id: 'overlays',       title: 'Overlays' },
  { id: 'scroll-shadow',  title: 'Scroll shadow' },
  { id: 'app-components', title: 'App components' },
]

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DesignSystemScreen() {
  return (
    <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-10 sm:py-14">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Discover</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/design-system">Design System</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="mt-6 mb-12">
        <Heading level={1} size="xl">Design System</Heading>
        <p className="mt-3 text-base text-[var(--muted)] max-w-2xl leading-relaxed">
          Typography, color tokens, and every HeroUI and app-specific component
          used across Drawie — in one place.
        </p>
      </header>

      <div className="grid lg:grid-cols-[200px_1fr] gap-10 items-start">
        {/* Sticky TOC */}
        <nav className="hidden lg:flex flex-col gap-0.5 sticky top-20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mb-2 px-2">
            On this page
          </p>
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-2 py-1.5 rounded-lg text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
            >
              {s.title}
            </a>
          ))}
        </nav>

        {/* Content */}
        <div className="flex flex-col gap-16 min-w-0">
          <TypographySection />
          <ColorSection />
          <ButtonSection />
          <ChipSection />
          <BadgeSection />
          <FormSection />
          <SurfaceSection />
          <FeedbackSection />
          <NavigationSection />
          <ModalSection />
          <OverlaysSection />
          <ScrollShadowSection />
          <AppComponentsSection />
        </div>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function SectionBlock({ id, title, description, children }: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-6 pb-4 border-b border-[var(--separator)]">
        <Heading level={2} size="sm">{title}</Heading>
        {description && (
          <p className="mt-1.5 text-sm text-[var(--muted)]">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

// ── 1. Typography ─────────────────────────────────────────────────────────────

function TypographySection() {
  return (
    <SectionBlock id="typography" title="Typography" description="Heading sizes, Eyebrow variants, and prose scale. All set in Figtree.">
      <div className="flex flex-col gap-6">
        {(['3xl','2xl','xl','lg','md','sm','xs'] as const).map((size) => (
          <div key={size} className="flex items-baseline gap-4">
            <Eyebrow className="w-8 shrink-0">{size}</Eyebrow>
            <Heading level={2} size={size}>The quick mosaic</Heading>
          </div>
        ))}

        <Separator />

        <Row label="Eyebrow variants">
          <Eyebrow>Default eyebrow</Eyebrow>
          <Eyebrow variant="dot">Dot eyebrow</Eyebrow>
          <Eyebrow variant="index">Index eyebrow /</Eyebrow>
        </Row>

        <Separator />

        <div className="flex flex-col gap-2 max-w-prose">
          <p className="text-lg leading-relaxed text-[var(--foreground)]">Large body — One canvas. Many hands. A surprise at the end.</p>
          <p className="text-base leading-relaxed text-[var(--foreground)]">Base body — Every artwork is broken into hidden tiles. You only see yours and a thin edge from each neighbor.</p>
          <p className="text-sm leading-relaxed text-[var(--muted)]">Small body / muted — When everyone finishes, the full mosaic is revealed.</p>
          <p className="text-xs leading-relaxed text-[var(--muted)]">XS / caption — Tap an empty tile to claim your spot.</p>
          <p className="font-mono text-[11px] text-[var(--muted)]">Mono / eyebrow — 12 × 12 · 144 tiles</p>
        </div>
      </div>
    </SectionBlock>
  )
}

// ── 2. Colors ─────────────────────────────────────────────────────────────────

const TOKEN_GROUPS = [
  { label: 'Page',        tokens: ['--background','--foreground','--overlay'] },
  { label: 'Surface',     tokens: ['--surface','--surface-secondary','--surface-tertiary'] },
  { label: 'Interactive', tokens: ['--accent','--accent-foreground','--default','--default-foreground','--focus'] },
  { label: 'Semantic',    tokens: ['--success','--success-foreground','--warning','--warning-foreground','--danger','--danger-foreground'] },
  { label: 'Utility',     tokens: ['--muted','--separator','--border'] },
  { label: 'Field',       tokens: ['--field-background','--field-foreground','--field-placeholder'] },
]

function ColorSection() {
  return (
    <SectionBlock id="colors" title="Color tokens" description="All CSS custom properties defined in the editorial theme. Used as var(--token) throughout the app.">
      <div className="flex flex-col gap-6">
        {TOKEN_GROUPS.map((g) => (
          <div key={g.label}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">{g.label}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {g.tokens.map((t) => (
                <div key={t} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-secondary)]">
                  <div
                    className="w-9 h-9 rounded-lg shrink-0 border border-[var(--separator)]"
                    style={{ background: `var(${t})` }}
                  />
                  <span className="font-mono text-[10px] text-[var(--muted)] break-all leading-snug">{t}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionBlock>
  )
}

// ── 3. Buttons ────────────────────────────────────────────────────────────────

function ButtonSection() {
  return (
    <SectionBlock id="buttons" title="Buttons" description="HeroUI Button — all variants and sizes.">
      <div className="flex flex-col gap-6">
        <Row label="Variants">
          {(['primary','secondary','tertiary','ghost','danger-soft','danger'] as const).map((v) => (
            <Button key={v} variant={v} size="md">{v}</Button>
          ))}
        </Row>
        <Row label="Sizes (primary)">
          {(['sm','md','lg'] as const).map((s) => (
            <Button key={s} variant="primary" size={s}>{s}</Button>
          ))}
        </Row>
        <Row label="States">
          <Button variant="primary" isDisabled>Disabled</Button>
          <Button variant="secondary" isDisabled>Disabled</Button>
          <Button variant="primary" isIconOnly aria-label="icon">★</Button>
          <Button variant="secondary" fullWidth className="max-w-[200px]">Full width</Button>
        </Row>
      </div>
    </SectionBlock>
  )
}

// ── 4. Chips ──────────────────────────────────────────────────────────────────

function ChipSection() {
  return (
    <SectionBlock id="chips" title="Chips" description="HeroUI Chip — color × variant combinations used across the app.">
      <div className="flex flex-col gap-5">
        {(['default','accent','success','warning','danger'] as const).map((color) => (
          <Row key={color} label={color}>
            {(['primary','secondary','soft'] as const).map((variant) => (
              <Chip key={variant} color={color} variant={variant} size="sm">{variant}</Chip>
            ))}
            <Chip color={color} variant="primary" size="sm">sm</Chip>
            <Chip color={color} variant="primary" size="md">md</Chip>
            <Chip color={color} variant="primary" size="lg">lg</Chip>
          </Row>
        ))}
      </div>
    </SectionBlock>
  )
}

// ── 5. Badge ──────────────────────────────────────────────────────────────────

function BadgeSection() {
  return (
    <SectionBlock id="badge" title="Badge" description="HeroUI Badge.Anchor — used on the notification bell.">
      <Row>
        <Badge.Anchor>
          <Button isIconOnly variant="secondary" aria-label="notifications">🔔</Button>
          <Badge color="accent" size="sm" placement="top-right">3</Badge>
        </Badge.Anchor>
        <Badge.Anchor>
          <Button isIconOnly variant="secondary" aria-label="messages">✉</Button>
          <Badge color="danger" size="sm" placement="top-right">12</Badge>
        </Badge.Anchor>
        <Badge.Anchor>
          <div className="w-10 h-10 rounded-full bg-[var(--default)] flex items-center justify-center text-sm font-bold">A</div>
          <Badge color="success" size="sm" placement="bottom-right">●</Badge>
        </Badge.Anchor>
      </Row>
    </SectionBlock>
  )
}

// ── 6. Form controls ──────────────────────────────────────────────────────────

function FormSection() {
  const [check, setCheck] = useState(['brush'])
  const [radio, setRadio] = useState('public')

  return (
    <SectionBlock id="form" title="Form controls" description="Input, TextArea, Checkbox, and Radio — as used in the wizard and filter bar.">
      <div className="grid sm:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Input</p>
          <Input placeholder="Search canvases…" />
          <Input type="email" placeholder="your@email.com" />
          <Input placeholder="Disabled" disabled />
          <TextArea rows={3} placeholder="Style guidance — strong directional lighting, no neon." />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Checkbox group</p>
            <CheckboxGroup value={check} onChange={(v) => setCheck(v as string[])}>
              <div className="flex flex-wrap gap-3">
                {['brush','pencil','marker','eraser'].map((t) => (
                  <Checkbox key={t} value={t}>
                    <Checkbox.Control />
                    <Checkbox.Content className="capitalize">{t}</Checkbox.Content>
                  </Checkbox>
                ))}
              </div>
            </CheckboxGroup>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Radio group</p>
            <RadioGroup value={radio} onChange={(v) => setRadio(v)}>
              <div className="flex flex-col gap-2">
                {[
                  { value: 'public', label: 'Public', hint: 'Anyone can find and join.' },
                  { value: 'private', label: 'Private link', hint: 'Hidden from discovery.' },
                ].map((opt) => (
                  <Radio
                    key={opt.value}
                    value={opt.value}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-tertiary)] cursor-pointer data-[selected=true]:bg-[var(--surface)] data-[selected=true]:ring-1 data-[selected=true]:ring-[var(--accent)]"
                  >
                    <Radio.Control />
                    <Radio.Content>
                      <div className="text-sm font-bold text-[var(--foreground)]">{opt.label}</div>
                      <div className="text-[11px] text-[var(--muted)]">{opt.hint}</div>
                    </Radio.Content>
                  </Radio>
                ))}
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>
    </SectionBlock>
  )
}

// ── 7. Surface ────────────────────────────────────────────────────────────────

function SurfaceSection() {
  return (
    <SectionBlock id="surface" title="Surface" description="HeroUI Surface — the three tinted levels used for layering content.">
      <div className="grid sm:grid-cols-3 gap-4">
        {(['default','secondary','tertiary'] as const).map((v) => (
          <Surface key={v} variant={v} className="rounded-[var(--radius)] p-5">
            <Eyebrow className="mb-2">variant="{v}"</Eyebrow>
            <p className="text-sm text-[var(--muted)]">Used for cards, panels, and section backgrounds.</p>
          </Surface>
        ))}
      </div>
    </SectionBlock>
  )
}

// ── 8. Feedback ───────────────────────────────────────────────────────────────

function FeedbackSection() {
  return (
    <SectionBlock id="feedback" title="Feedback" description="Alert statuses and Spinner sizes.">
      <div className="flex flex-col gap-4">
        {(['success','warning','danger'] as const).map((status) => (
          <Alert key={status} status={status}>
            <Alert.Content>
              <Alert.Title className="capitalize">{status}</Alert.Title>
              <Alert.Description>This is a {status} alert message with a description.</Alert.Description>
            </Alert.Content>
          </Alert>
        ))}

        <Separator />

        <Row label="Spinner sizes">
          {(['sm','md','lg'] as const).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <Spinner size={s} />
              <span className="text-xs text-[var(--muted)]">{s}</span>
            </div>
          ))}
        </Row>
      </div>
    </SectionBlock>
  )
}

// ── 9. Navigation ─────────────────────────────────────────────────────────────

function NavigationSection() {
  const [tab, setTab] = useState('contributed')
  return (
    <SectionBlock id="navigation" title="Navigation" description="Breadcrumbs and Tabs.">
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Breadcrumbs</p>
          <Breadcrumbs>
            <Breadcrumbs.Item href="/">Discover</Breadcrumbs.Item>
            <Breadcrumbs.Item href="/canvas/canvas-world-mosaic">World Mosaic</Breadcrumbs.Item>
            <Breadcrumbs.Item href="#">Design System</Breadcrumbs.Item>
          </Breadcrumbs>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Tabs</p>
          <Tabs
            selectedKey={tab}
            onSelectionChange={(k) => setTab(String(k))}
            aria-label="Example tabs"
          >
            {['Contributed','Saved','Completed'].map((t) => (
              <Tab key={t.toLowerCase()}>{t}</Tab>
            ))}
          </Tabs>
          <div className="mt-4 p-4 rounded-[var(--radius)] bg-[var(--surface-secondary)] text-sm text-[var(--muted)]">
            Content for tab: <strong className="text-[var(--foreground)]">{String(tab)}</strong>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Separator</p>
          <Separator />
          <div className="mt-4 flex items-center gap-4 h-8">
            <span className="text-sm text-[var(--muted)]">Section A</span>
            <Separator orientation="vertical" className="h-full" />
            <span className="text-sm text-[var(--muted)]">Section B</span>
            <Separator orientation="vertical" className="h-full" />
            <span className="text-sm text-[var(--muted)]">Section C</span>
          </div>
        </div>
      </div>
    </SectionBlock>
  )
}

// ── 10. Modal ─────────────────────────────────────────────────────────────────

function ModalSection() {
  const [open, setOpen] = useState(false)
  return (
    <SectionBlock id="modal" title="Modal" description="HeroUI Modal — blur backdrop, centered container, header/body/footer compound.">
      <Button variant="secondary" onPress={() => setOpen(true)}>Open demo modal</Button>

      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container size="md" placement="center">
            <Modal.Dialog>
              <Modal.Header className="mb-2">
                <Eyebrow variant="dot">Demo</Eyebrow>
                <h2 className="mt-1.5 text-xl font-extrabold tracking-tight">Modal title</h2>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  This is the modal body. It supports any content — forms, rich text, alerts, or action confirmations.
                </p>
              </Modal.Body>
              <Modal.Footer className="mt-6 flex items-center justify-between gap-3">
                <Button variant="ghost" onPress={() => setOpen(false)}>Cancel</Button>
                <Button variant="primary" onPress={() => setOpen(false)}>Confirm →</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </SectionBlock>
  )
}

// ── 11. Overlays ──────────────────────────────────────────────────────────────

function OverlaysSection() {
  const [popOpen, setPopOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <SectionBlock id="overlays" title="Overlays" description="Tooltip and Popover — both built on react-aria primitives.">
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Tooltip</p>
          <Row>
            {(['top','bottom','left','right'] as const).map((placement) => (
              <Tooltip key={placement}>
                <Tooltip.Trigger>
                  <Button variant="secondary" size="sm">{placement}</Button>
                </Tooltip.Trigger>
                <Tooltip.Content placement={placement}>Tooltip on {placement}</Tooltip.Content>
              </Tooltip>
            ))}
          </Row>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Popover</p>
          <Popover isOpen={popOpen} onOpenChange={setPopOpen}>
            <button
              ref={triggerRef}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] text-sm font-bold transition-colors"
            >
              Open popover ↓
            </button>
            <Popover.Content
              placement="bottom left"
              className="w-72 p-0 overflow-hidden rounded-[var(--radius)] bg-[var(--overlay)] shadow-[var(--shadow-overlay)] outline-none"
            >
              <Popover.Dialog className="outline-none">
                <div className="p-4">
                  <Eyebrow variant="dot" className="mb-2">Popover</Eyebrow>
                  <p className="text-sm text-[var(--muted)] leading-snug">
                    Interactive overlay. You can include forms, lists, or custom content here.
                  </p>
                  <Button size="sm" variant="primary" className="mt-3" onPress={() => setPopOpen(false)}>
                    Got it
                  </Button>
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </div>
      </div>
    </SectionBlock>
  )
}

// ── 12. Scroll shadow ─────────────────────────────────────────────────────────

function ScrollShadowSection() {
  return (
    <SectionBlock id="scroll-shadow" title="Scroll shadow" description="HeroUI ScrollShadow — used in the notification panel for long lists.">
      <ScrollShadow className="max-h-40">
        <div className="flex flex-col gap-2 py-1">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="px-3 py-2 rounded-lg bg-[var(--surface-secondary)] text-sm text-[var(--muted)]">
              Notification item {i + 1} — Canvas finished, your tile is part of the reveal.
            </div>
          ))}
        </div>
      </ScrollShadow>
    </SectionBlock>
  )
}

// ── 13. App components ────────────────────────────────────────────────────────

function AppComponentsSection() {
  return (
    <SectionBlock id="app-components" title="App components" description="Drawie-specific components built on top of the HeroUI primitives.">
      <div className="flex flex-col gap-8">

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">StatusBadge — all canvas statuses</p>
          <Row>
            <StatusBadge status="open" />
            <StatusBadge status="almost-complete" />
            <StatusBadge status="completed" />
            <StatusBadge status="locked" />
          </Row>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">CategoryChip — tone variants</p>
          <Row>
            <CategoryChip label="Landscape" />
            <CategoryChip label="Painterly" />
            <CategoryChip label="Abstract" selected />
            <CategoryChip label="Illustration" tone="surface" />
            <CategoryChip label="Watercolor" tone="surface" selected />
          </Row>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">ProgressBar — fill states</p>
          <div className="flex flex-col gap-3 max-w-md">
            <ProgressBar completed={0}  total={100} />
            <ProgressBar completed={25} total={100} />
            <ProgressBar completed={60} total={100} />
            <ProgressBar completed={85} total={100} />
            <ProgressBar completed={100} total={100} />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Table — plan comparison pattern</p>
          <Surface variant="secondary" className="rounded-[var(--radius)] overflow-hidden">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Component table example">
                  <Table.Header>
                    <Table.Column isRowHeader>Component</Table.Column>
                    <Table.Column>Source</Table.Column>
                    <Table.Column>Used in</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {[
                      ['Button',     'HeroUI',  'Everywhere'],
                      ['Chip',       'HeroUI',  'Cards, badges, filters'],
                      ['Modal',      'HeroUI',  'Export, leave dialog'],
                      ['StatusBadge','Drawie',  'Canvas cards + detail'],
                      ['VoteCard',   'Drawie',  'Canvas detail (completed)'],
                      ['ProgressBar','Drawie',  'Canvas cards + detail'],
                    ].map(([comp, src, used]) => (
                      <Table.Row key={comp}>
                        <Table.Cell className="font-medium text-[var(--foreground)]">{comp}</Table.Cell>
                        <Table.Cell>
                          <Chip
                            color={src === 'HeroUI' ? 'accent' : 'default'}
                            variant={src === 'HeroUI' ? 'primary' : 'soft'}
                            size="sm"
                          >
                            {src}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="text-sm text-[var(--muted)]">{used}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Surface>
        </div>

      </div>
    </SectionBlock>
  )
}
