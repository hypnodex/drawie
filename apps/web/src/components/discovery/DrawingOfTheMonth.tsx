import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Surface } from '@/components/ui/Surface'
import { useAuth } from '../../state/AuthContext'
import { Eyebrow } from '../ui/Eyebrow'
import { Heading } from '../ui/Heading'
import { ContributorAvatars } from '../canvas/ContributorAvatars'
import { Avatar } from '../ui/Avatar'
import { getProfile } from '@drawie/data'
import { useAsync } from '../../hooks/useAsync'
import type { Canvas, User } from '@drawie/data'
import {
  getDrawingOfTheMonth,
  getVoteCount,
  getTotalVoters,
  getUserVote,
  castVote,
  retractVote,
  VOTE_MONTH_LABEL,
} from '@drawie/data'

export function DrawingOfTheMonth() {
  const { user, isAuthed } = useAuth()
  const nav = useNavigate()

  const { data: canvas } = useAsync(() => getDrawingOfTheMonth(), [], null as Canvas | null)
  const { data: founder } = useAsync(
    () => (canvas ? getProfile(canvas.founderId) : Promise.resolve(null)),
    [canvas?.founderId], null as User | null,
  )
  const [voteCount, setVoteCount] = useState(0)
  const [totalVoters, setTotal]   = useState(0)
  const [userVote, setUserVote]   = useState<string | null>(null)
  const [voting, setVoting]       = useState(false)

  useEffect(() => {
    if (!canvas) return
    let active = true
    ;(async () => {
      const [vc, tv, uv] = await Promise.all([
        getVoteCount(canvas.id), getTotalVoters(),
        isAuthed ? getUserVote() : Promise.resolve(null),
      ])
      if (active) { setVoteCount(vc); setTotal(tv); setUserVote(uv) }
    })()
    return () => { active = false }
  }, [canvas?.id, isAuthed])

  if (!canvas) return null

  const votedThis  = userVote === canvas.id
  const votedOther = !!userVote && userVote !== canvas.id
  const voteShare  = totalVoters > 0 ? Math.round((voteCount / totalVoters) * 100) : 0

  const handleVote = async () => {
    if (!user || voting) return
    setVoting(true)
    try {
      if (votedThis) { await retractVote(); setUserVote(null) }
      else { await castVote(canvas.id); setUserVote(canvas.id) }
      setVoteCount(await getVoteCount(canvas.id))
      setTotal(await getTotalVoters())
    } finally {
      setVoting(false)
    }
  }

  return (
    <section className="max-w-[1440px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
      {/* section header */}
      <header className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Eyebrow variant="dot">Drawing of the Month</Eyebrow>
          <Eyebrow>{VOTE_MONTH_LABEL} /</Eyebrow>
        </div>
        <span className="font-mono text-[11px] text-[var(--muted)]">
          {totalVoters} voters · {voteCount} votes for this artwork
        </span>
      </header>

      {/* main layout */}
      <div className="grid lg:grid-cols-5 gap-5 items-start">

        {/* ── Artwork ── */}
        <div className="lg:col-span-3 relative rounded-[var(--radius)] overflow-hidden bg-[var(--surface-secondary)] group">
          <div className="relative w-full aspect-[4/3]">
            {canvas.artworkUrl ? (
              <img
                src={canvas.artworkUrl}
                alt={canvas.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0" style={{ background: canvas.previewGradient }} />
            )}

            {/* bottom scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

            {/* winner badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] shadow-lg">
                <TrophyIcon />
                <span className="text-xs font-extrabold uppercase tracking-wider">Winner</span>
              </div>
            </div>

            {/* grid + tile count (bottom-right) */}
            <div className="absolute bottom-4 right-4 px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm">
              <span className="text-white font-mono text-[11px] font-bold tabular-nums">
                {canvas.gridRows} × {canvas.gridCols} · {canvas.totalTiles} tiles
              </span>
            </div>

            {/* contributor count (bottom-left) */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <ContributorAvatars canvas={canvas} size={24} max={5} />
              <span className="text-white text-xs font-bold drop-shadow">
                {canvas.activeContributors} artists
              </span>
            </div>
          </div>
        </div>

        {/* ── Info panel ── */}
        <Surface variant="secondary" className="lg:col-span-2 rounded-[var(--radius)] p-6 sm:p-7 flex flex-col gap-5">

          {/* title + description */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Badge>{canvas.category}</Badge>
              <Badge variant="secondary">{canvas.style}</Badge>
            </div>
            <Heading level={2} size="md">{canvas.title}</Heading>
            <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed line-clamp-3">
              {canvas.description}
            </p>
          </div>

          {/* founder */}
          {founder && (
            <div className="flex items-center gap-3 py-4 border-y border-[var(--separator)]">
              <Avatar user={founder} size={36} />
              <div>
                <Eyebrow className="mb-0.5">Founded by</Eyebrow>
                <RouterLink
                  to={`/profile/${founder.id}`}
                  className="text-sm font-extrabold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                >
                  {founder.name}
                </RouterLink>
              </div>
            </div>
          )}

          {/* vote tally */}
          <div>
            <Eyebrow className="mb-3">Community votes</Eyebrow>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold text-[var(--foreground)] tabular-nums leading-none">
                {voteCount}
              </span>
              <span className="text-sm text-[var(--muted)]">votes</span>
            </div>

            {/* share bar */}
            <div className="mt-3 h-2 rounded-full bg-[var(--default)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${voteShare}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              <span className="font-bold text-[var(--foreground)]">{voteShare}%</span>
              {' '}of {totalVoters} total votes in {VOTE_MONTH_LABEL}
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-2">
            {isAuthed ? (
              <>
                <Button
                  variant={votedThis ? 'secondary' : 'default'}
                  size="lg"
                  onClick={handleVote}
                  disabled={voting}
                  className={['w-full', votedThis ? 'ring-1 ring-[var(--accent)]' : ''].join(' ')}
                >
                  {voting
                    ? 'Saving…'
                    : votedThis
                    ? '✓ You voted for this'
                    : votedOther
                    ? 'Change vote to this'
                    : '★ Vote for this artwork'}
                </Button>

                {votedThis && (
                  <button
                    type="button"
                    onClick={handleVote}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] text-center transition-colors"
                  >
                    Remove vote
                  </button>
                )}

                {votedOther && (
                  <p className="text-xs text-center text-[var(--muted)]">
                    You voted for a different artwork this month.
                  </p>
                )}
              </>
            ) : (
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => nav('/login')}
              >
                Sign in to vote →
              </Button>
            )}

            <RouterLink
              to={`/canvas/${canvas.id}`}
              className="flex items-center justify-center gap-1.5 text-sm font-bold text-[var(--accent)] hover:opacity-75 transition-opacity py-1"
            >
              View full artwork
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </RouterLink>
          </div>

          {/* style guidance */}
          <div className="border-t border-[var(--separator)] pt-4">
            <Eyebrow className="mb-2">Style rules</Eyebrow>
            <p className="text-xs italic text-[var(--muted)] leading-snug">
              "{canvas.styleGuidance}"
            </p>
          </div>
        </Surface>
      </div>
    </section>
  )
}

function TrophyIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
      <rect x="6" y="2" width="12" height="13" rx="2" />
    </svg>
  )
}
