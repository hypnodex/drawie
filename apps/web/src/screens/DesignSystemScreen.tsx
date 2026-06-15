import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/Spinner'
import { Surface } from '@/components/ui/Surface'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
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
  { id: 'chips',          title: 'Badge variants' },
  { id: 'badge',          title: 'Anchored badge' },
  { id: 'form',           title: 'Form controls' },
  { id: 'surface',        title: 'Surface' },
  { id: 'feedback',       title: 'Feedback' },
  { id: 'navigation',     title: 'Navigation' },
  { id: 'modal',          title: 'Dialog' },
  { id: 'overlays',       title: 'Overlays' },
  { id: 'scroll-shadow',  title: 'Scroll area' },
  { id: 'app-components', title: 'App components' },
]

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DesignSystemScreen() {
  return (
    <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-10 sm:py-14">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><RouterLink to="/">Discover</RouterLink></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Design System</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mt-6 mb-12">
        <Heading level={1} size="xl">Design System</Heading>
        <p className="mt-3 text-base text-[var(--muted)] max-w-2xl leading-relaxed">
          Typography, color tokens, and every shadcn and app-specific component
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
    <SectionBlock id="buttons" title="Buttons" description="shadcn Button — all variants and sizes.">
      <div className="flex flex-col gap-6">
        <Row label="Variants">
          {(['default','secondary','outline','ghost','destructive','link'] as const).map((v) => (
            <Button key={v} variant={v}>{v}</Button>
          ))}
        </Row>
        <Row label="Sizes (default)">
          {(['sm','default','lg'] as const).map((s) => (
            <Button key={s} size={s}>{s}</Button>
          ))}
        </Row>
        <Row label="States">
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>Disabled</Button>
          <Button size="icon" aria-label="icon">★</Button>
          <Button variant="secondary" className="w-full max-w-[200px]">Full width</Button>
        </Row>
      </div>
    </SectionBlock>
  )
}

// ── 4. Badge variants ──────────────────────────────────────────────────────────

function ChipSection() {
  return (
    <SectionBlock id="chips" title="Badge variants" description="shadcn Badge — the variants used across the app (replaces HeroUI Chip).">
      <Row label="Variants">
        {(['default','secondary','destructive','outline'] as const).map((v) => (
          <Badge key={v} variant={v}>{v}</Badge>
        ))}
      </Row>
    </SectionBlock>
  )
}

// ── 5. Anchored badge ───────────────────────────────────────────────────────────

function BadgeSection() {
  const anchored = 'absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none pointer-events-none'
  return (
    <SectionBlock id="badge" title="Anchored badge" description="Badge absolutely positioned over a trigger — used on the notification bell.">
      <Row>
        <div className="relative inline-flex">
          <Button size="icon" variant="secondary" aria-label="notifications">🔔</Button>
          <Badge className={anchored}>3</Badge>
        </div>
        <div className="relative inline-flex">
          <Button size="icon" variant="secondary" aria-label="messages">✉</Button>
          <Badge variant="destructive" className={anchored}>12</Badge>
        </div>
        <div className="relative inline-flex">
          <div className="w-10 h-10 rounded-full bg-[var(--default)] flex items-center justify-center text-sm font-bold">A</div>
          <Badge className="absolute -bottom-0.5 -right-0.5 h-3.5 min-w-3.5 justify-center rounded-full px-1 text-[9px] leading-none pointer-events-none border-[var(--success)] bg-[var(--success)] text-[var(--success-foreground)]">●</Badge>
        </div>
      </Row>
    </SectionBlock>
  )
}

// ── 6. Form controls ──────────────────────────────────────────────────────────

const CHECK_TOOLS = ['brush', 'pencil', 'marker', 'eraser']

function FormSection() {
  const [check, setCheck] = useState<string[]>(['brush'])
  const [radio, setRadio] = useState('public')

  return (
    <SectionBlock id="form" title="Form controls" description="Input, Textarea, Checkbox, and Radio — as used in the wizard and filter bar.">
      <div className="grid sm:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Input</p>
          <Input placeholder="Search canvases…" />
          <Input type="email" placeholder="your@email.com" />
          <Input placeholder="Disabled" disabled />
          <Textarea rows={3} placeholder="Style guidance — strong directional lighting, no neon." />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Checkbox group</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {CHECK_TOOLS.map((t) => {
                const checked = check.includes(t)
                return (
                  <label key={t} className="inline-flex items-center gap-2 cursor-pointer text-sm text-[var(--foreground)] capitalize">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) =>
                        setCheck(c === true ? [...check, t] : check.filter((x) => x !== t))
                      }
                    />
                    {t}
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Radio group</p>
            <RadioGroup value={radio} onValueChange={(v) => setRadio(v)}>
              <div className="flex flex-col gap-2">
                {[
                  { value: 'public', label: 'Public', hint: 'Anyone can find and join.' },
                  { value: 'private', label: 'Private link', hint: 'Hidden from discovery.' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-tertiary)] cursor-pointer has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-[var(--accent)]"
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-[var(--foreground)]">{opt.label}</div>
                      <div className="text-[11px] text-[var(--muted)]">{opt.hint}</div>
                    </div>
                  </label>
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
    <SectionBlock id="surface" title="Surface" description="Surface — the three tinted levels used for layering content.">
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
          <Alert key={status} variant={status === 'danger' ? 'destructive' : status}>
            <AlertTitle className="capitalize">{status}</AlertTitle>
            <AlertDescription>This is a {status} alert message with a description.</AlertDescription>
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
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink asChild><RouterLink to="/">Discover</RouterLink></BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink asChild><RouterLink to="/canvas/canvas-world-mosaic">World Mosaic</RouterLink></BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Design System</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Tabs</p>
          <Tabs value={tab} onValueChange={setTab} aria-label="Example tabs">
            <TabsList>
              {['Contributed','Saved','Completed'].map((t) => (
                <TabsTrigger key={t.toLowerCase()} value={t.toLowerCase()}>{t}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="mt-4 p-4 rounded-[var(--radius)] bg-[var(--surface-secondary)] text-sm text-[var(--muted)]">
            Content for tab: <strong className="text-[var(--foreground)]">{tab}</strong>
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

// ── 10. Dialog ────────────────────────────────────────────────────────────────

function ModalSection() {
  const [open, setOpen] = useState(false)
  return (
    <SectionBlock id="modal" title="Dialog" description="shadcn Dialog — overlay, centered content, header/body/footer compound.">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary">Open demo dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader className="mb-2">
            <Eyebrow variant="dot">Demo</Eyebrow>
            <DialogTitle className="mt-1.5 text-xl font-extrabold tracking-tight">Dialog title</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            This is the dialog body. It supports any content — forms, rich text, alerts, or action confirmations.
          </p>
          <DialogFooter className="mt-4 flex-row items-center justify-between gap-3 sm:justify-between">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Confirm →</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionBlock>
  )
}

// ── 11. Overlays ──────────────────────────────────────────────────────────────

function OverlaysSection() {
  const [popOpen, setPopOpen] = useState(false)

  return (
    <SectionBlock id="overlays" title="Overlays" description="Tooltip and Popover — both built on Radix primitives.">
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Tooltip</p>
          <Row>
            {(['top','bottom','left','right'] as const).map((side) => (
              <Tooltip key={side}>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="sm">{side}</Button>
                </TooltipTrigger>
                <TooltipContent side={side}>Tooltip on {side}</TooltipContent>
              </Tooltip>
            ))}
          </Row>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-3">Popover</p>
          <Popover open={popOpen} onOpenChange={setPopOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] text-sm font-bold transition-colors"
              >
                Open popover ↓
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-72 p-0 border-0 overflow-hidden rounded-[var(--radius)] bg-[var(--overlay)] shadow-[var(--shadow-overlay)] outline-none"
            >
              <div className="p-4">
                <Eyebrow variant="dot" className="mb-2">Popover</Eyebrow>
                <p className="text-sm text-[var(--muted)] leading-snug">
                  Interactive overlay. You can include forms, lists, or custom content here.
                </p>
                <Button size="sm" className="mt-3" onClick={() => setPopOpen(false)}>
                  Got it
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </SectionBlock>
  )
}

// ── 12. Scroll area ───────────────────────────────────────────────────────────

function ScrollShadowSection() {
  return (
    <SectionBlock id="scroll-shadow" title="Scroll area" description="shadcn ScrollArea — used in the notification panel for long lists.">
      <ScrollArea className="h-40">
        <div className="flex flex-col gap-2 py-1">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="px-3 py-2 rounded-lg bg-[var(--surface-secondary)] text-sm text-[var(--muted)]">
              Notification item {i + 1} — Canvas finished, your tile is part of the reveal.
            </div>
          ))}
        </div>
      </ScrollArea>
    </SectionBlock>
  )
}

// ── 13. App components ────────────────────────────────────────────────────────

function AppComponentsSection() {
  return (
    <SectionBlock id="app-components" title="App components" description="Drawie-specific components built on top of the shadcn primitives.">
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
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Used in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['Button',     'shadcn',  'Everywhere'],
                  ['Badge',      'shadcn',  'Cards, badges, filters'],
                  ['Dialog',     'shadcn',  'Export, leave dialog'],
                  ['StatusBadge','Drawie',  'Canvas cards + detail'],
                  ['VoteCard',   'Drawie',  'Canvas detail (completed)'],
                  ['ProgressBar','Drawie',  'Canvas cards + detail'],
                ].map(([comp, src, used]) => (
                  <TableRow key={comp}>
                    <TableCell className="font-medium text-[var(--foreground)]">{comp}</TableCell>
                    <TableCell>
                      <Badge variant={src === 'shadcn' ? 'default' : 'secondary'}>{src}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--muted)]">{used}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Surface>
        </div>

      </div>
    </SectionBlock>
  )
}
