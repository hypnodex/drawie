import { Navigate } from 'react-router-dom'
import { Breadcrumbs, Separator, Surface } from '@heroui/react'
import { ButtonLink } from '../components/ui/ButtonLink'
import { useAuth } from '../state/AuthContext'
import { Avatar } from '../components/ui/Avatar'
import { CanvasCard } from '../components/canvas/CanvasCard'
import { ProgressCard } from '../components/dashboard/ProgressCard'
import { PremiumUpsellCard } from '../components/dashboard/PremiumUpsellCard'
import { Heading } from '../components/ui/Heading'
import { listCanvases } from '../services/canvasService'
import { useAsync } from '../hooks/useAsync'
import type { Canvas } from '../types/domain'

export default function DashboardScreen() {
  const { user, entitlement } = useAuth()
  const { data: allCanvases } = useAsync(() => listCanvases({}), [], [] as Canvas[])

  if (!user || !entitlement) return <Navigate to="/login" replace />

  const contributed = allCanvases.filter((c) => user.contributedCanvasIds.includes(c.id))
  const saved = allCanvases.filter((c) => user.savedCanvasIds.includes(c.id))
  const active = contributed.filter((c) => c.status !== 'completed')
  const completed = contributed.filter((c) => c.status === 'completed')

  return (
    <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-10 sm:py-14 flex flex-col gap-12">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Discover</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/dashboard">Dashboard</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={64} ringClassName="ring-2 ring-[var(--background)]" />
          <Heading level={1} size="lg">{user.name}</Heading>
        </div>
        <ButtonLink to="/dashboard/canvases" variant="secondary" size="md" className="text-sm">
          All my canvases →
        </ButtonLink>
      </header>

      <ProgressCard user={user} entitlement={entitlement} />

      <Separator />

      <Section
        eyebrow="In progress"
        title="Keep going"
        description="Active canvases you've already drawn a tile in — there's more to add."
        empty={active.length === 0}
        emptyTitle="Nothing in progress."
        emptyBody="When you contribute a tile to a canvas, it shows up here so you can come back."
        emptyCta={{ to: '/', label: 'Find a canvas' }}
      >
        {active.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {active.slice(0, 3).map((c) => <CanvasCard key={c.id} canvas={c} />)}
          </div>
        )}
      </Section>

      <Section
        eyebrow="Bookmarked"
        title="Saved for later"
        description="Canvases you've starred."
        empty={saved.length === 0}
        emptyTitle="No saved canvases."
        emptyBody="Tap the star on any canvas to save it for later."
        emptyCta={{ to: '/', label: 'Browse canvases' }}
      >
        {saved.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {saved.slice(0, 3).map((c) => <CanvasCard key={c.id} canvas={c} />)}
          </div>
        )}
      </Section>

      {completed.length > 0 && (
        <Section
          eyebrow="Hall of fame"
          title="Canvases you helped finish"
          description="Mosaics that crossed the finish line with your tile in them."
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((c) => <CanvasCard key={c.id} canvas={c} />)}
          </div>
        </Section>
      )}

      {!entitlement.isPremium && <PremiumUpsellCard />}
    </div>
  )
}

function Section({
  eyebrow, title, description, children,
  empty, emptyTitle, emptyBody, emptyCta,
}: {
  eyebrow: string
  title: string
  description?: string
  children?: React.ReactNode
  empty?: boolean
  emptyTitle?: string
  emptyBody?: string
  emptyCta?: { to: string; label: string }
}) {
  return (
    <section>
      <header className="mb-6">
        <Heading level={2} size="md">{title}</Heading>
        {description && (
          <p className="mt-3 text-sm text-[var(--muted)] max-w-2xl leading-relaxed">{description}</p>
        )}
      </header>
      {empty ? (
        <Surface variant="secondary" className="rounded-[var(--radius)] p-10 text-center">
          {emptyTitle && <Heading level={3} size="sm">{emptyTitle}</Heading>}
          {emptyBody && <p className="mt-3 text-sm text-[var(--muted)] max-w-md mx-auto leading-relaxed">{emptyBody}</p>}
          {emptyCta && (
            <ButtonLink to={emptyCta.to} variant="primary" size="md" className="mt-5 text-sm">
              {emptyCta.label} →
            </ButtonLink>
          )}
        </Surface>
      ) : children}
    </section>
  )
}
