import { Navigate, useParams } from 'react-router-dom'
import { Breadcrumbs, Chip, Spinner, Surface } from '@heroui/react'
import { getProfile } from '@drawie/data'
import { listCanvases } from '@drawie/data'
import { useAsync } from '../hooks/useAsync'
import { Avatar } from '../components/ui/Avatar'
import { Heading } from '../components/ui/Heading'
import { CanvasGrid } from '../components/canvas/CanvasGrid'
import type { Canvas, User } from '@drawie/data'

/** Public profile for a user — their stats and the canvases they've drawn in. */
export default function UserProfileScreen() {
  const { userId = '' } = useParams()
  const { data: user, loading } = useAsync(() => getProfile(userId), [userId], null as User | null)
  const { data: allCanvases } = useAsync(() => listCanvases({}), [], [] as Canvas[])

  const contributedIds = user?.contributedCanvasIds ?? []
  const contributed = allCanvases.filter((c) => contributedIds.includes(c.id))

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Spinner size="lg" /></div>
  }
  if (!user) return <Navigate to="/" replace />

  const finished = contributed.filter((c) => c.status === 'completed')

  return (
    <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-10 sm:py-14">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Discover</Breadcrumbs.Item>
        <Breadcrumbs.Item href={`/profile/${user.id}`}>{user.name}</Breadcrumbs.Item>
      </Breadcrumbs>

      <Surface
        variant="secondary"
        className="mt-6 rounded-[var(--radius)] p-8 sm:p-10 flex flex-col sm:flex-row items-start gap-6"
      >
        <Avatar user={user} size={120} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Heading level={1} size="lg">{user.name}</Heading>
            {user.isPremium && (
              <Chip color="accent" variant="primary" size="md">Pro</Chip>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">@{user.id}</p>

          <div className="mt-6 grid grid-cols-3 gap-4 sm:max-w-md">
            <Stat n={user.completedTilesCount} label="tiles drawn" />
            <Stat n={contributed.length} label={contributed.length === 1 ? 'canvas' : 'canvases'} />
            <Stat n={finished.length} label="finished" />
          </div>
        </div>
      </Surface>

      <section className="mt-12">
        <Heading level={2} size="md">Contributions</Heading>
        <p className="mt-2 text-sm text-[var(--muted)] max-w-2xl leading-relaxed">
          Every mosaic {user.name} has drawn a tile in — open / almost done / completed.
        </p>
        <div className="mt-6">
          <CanvasGrid
            canvases={contributed}
            emptyLabel={`${user.name} hasn't contributed to any canvas yet.`}
          />
        </div>
      </section>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-3xl font-extrabold text-[var(--foreground)] tabular-nums">{n}</span>
      <span className="text-xs text-[var(--muted)] mt-1">{label}</span>
    </div>
  )
}
