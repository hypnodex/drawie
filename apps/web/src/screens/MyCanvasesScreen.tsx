import { useState, type Key } from 'react'
import { Navigate } from 'react-router-dom'
import { Breadcrumbs, Surface, Tabs } from '@heroui/react'
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
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Discover</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/dashboard">Dashboard</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/dashboard/canvases">My canvases</Breadcrumbs.Item>
      </Breadcrumbs>

      <header className="mt-6 mb-6">
        <Heading level={1} size="lg">My canvases</Heading>
      </header>

      <Tabs
        selectedKey={tab}
        onSelectionChange={(k: Key) => setTab(k as TabId)}
        aria-label="My canvases"
      >
        <Tabs.List className="bg-[var(--surface-secondary)] rounded-full p-1 inline-flex">
          {TAB_META.map((t) => (
            <Tabs.Tab
              key={t.id}
              id={t.id}
              className="px-4 py-1.5 rounded-full font-bold text-xs cursor-pointer data-[selected=true]:bg-[var(--accent)] data-[selected=true]:text-[var(--accent-foreground)]"
            >
              <span className="flex items-center gap-2">
                {t.label}
                <span className="font-mono text-[10px] tabular-nums opacity-75">({buckets[t.id].length})</span>
              </span>
            </Tabs.Tab>
          ))}
        </Tabs.List>
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
