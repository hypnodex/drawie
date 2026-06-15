import { useState } from 'react'
import { Navigate, Link as RouterLink } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Surface } from '@/components/ui/Surface'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { ButtonLink } from '../components/ui/ButtonLink'
import { useAuth } from '../state/AuthContext'
import { CanvasGrid } from '../components/canvas/CanvasGrid'
import { Heading } from '../components/ui/Heading'
import { listCanvases } from '@drawie/data'
import { useAsync } from '../hooks/useAsync'
import type { Canvas } from '@drawie/data'

type TabId = 'contributed' | 'saved' | 'completed'

const TAB_META: { id: TabId; label: string; emptyTitle: string; emptyBody: string }[] = [
  { id: 'contributed', label: 'Contributed',
    emptyTitle: 'No contributions yet.',
    emptyBody: 'Pick any canvas on the discover page and draw your first tile.' },
  { id: 'saved', label: 'Saved',
    emptyTitle: 'Nothing saved yet.',
    emptyBody: 'Star a canvas from its detail page to keep it here.' },
  { id: 'completed', label: 'Completed',
    emptyTitle: 'No completed canvases yet.',
    emptyBody: 'Canvases you contributed to that have finished will appear here.' },
]

export default function MyCanvasesScreen() {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabId>('contributed')
  const { data: all } = useAsync(() => listCanvases({}), [], [] as Canvas[])

  if (!user) return <Navigate to="/login" replace />

  const contributed = all.filter((c) => user.contributedCanvasIds.includes(c.id))
  const buckets = {
    contributed,
    saved: all.filter((c) => user.savedCanvasIds.includes(c.id)),
    completed: contributed.filter((c) => c.status === 'completed'),
  }

  const visible = buckets[tab]
  const meta = TAB_META.find((t) => t.id === tab)!

  return (
    <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-10 sm:py-14">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><RouterLink to="/">Discover</RouterLink></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><RouterLink to="/dashboard">Dashboard</RouterLink></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>My canvases</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mt-6 mb-6">
        <Heading level={1} size="lg">My canvases</Heading>
      </header>

      <Tabs
        value={tab}
        onValueChange={(k) => setTab(k as TabId)}
        aria-label="My canvases"
      >
        <TabsList className="bg-[var(--surface-secondary)] rounded-full p-1 inline-flex h-auto">
          {TAB_META.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="px-4 py-1.5 rounded-full font-bold text-xs cursor-pointer data-[state=active]:bg-[var(--accent)] data-[state=active]:text-[var(--accent-foreground)]"
            >
              <span className="flex items-center gap-2">
                {t.label}
                <span className="font-mono text-[10px] tabular-nums opacity-75">({buckets[t.id].length})</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-8">
        {visible.length > 0 ? (
          <CanvasGrid canvases={visible} />
        ) : (
          <Surface variant="secondary" className="rounded-[var(--radius)] p-12 text-center">
            <Heading level={3} size="sm">{meta.emptyTitle}</Heading>
            <p className="mt-3 text-sm text-[var(--muted)] max-w-md mx-auto leading-relaxed">{meta.emptyBody}</p>
            <ButtonLink to="/" variant="primary" size="md" className="mt-6">
              Browse canvases →
            </ButtonLink>
          </Surface>
        )}
      </div>
    </div>
  )
}
