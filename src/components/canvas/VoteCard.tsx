import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Chip, Surface } from '@heroui/react'
import { useAuth } from '../../state/AuthContext'
import { Eyebrow } from '../ui/Eyebrow'
import {
  getDrawingOfTheMonth,
  getVoteCount,
  getTotalVoters,
  getUserVote,
  castVote,
  retractVote,
  VOTE_MONTH_LABEL,
} from '../../services/votingService'

interface Props {
  canvasId: string
}

export function VoteCard({ canvasId }: Props) {
  const { user, isAuthed } = useAuth()
  const nav = useNavigate()

  const [voteCount, setVoteCount] = useState(0)
  const [totalVoters, setTotal]   = useState(0)
  const [userVote, setUserVote]   = useState<string | null>(null)
  const [voting, setVoting]       = useState(false)
  const [isWinner, setIsWinner]   = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const [vc, tv, uv, dotm] = await Promise.all([
        getVoteCount(canvasId), getTotalVoters(),
        isAuthed ? getUserVote() : Promise.resolve(null),
        getDrawingOfTheMonth(),
      ])
      if (active) { setVoteCount(vc); setTotal(tv); setUserVote(uv); setIsWinner(dotm?.id === canvasId) }
    })()
    return () => { active = false }
  }, [canvasId, isAuthed])

  const votedThis  = userVote === canvasId
  const votedOther = !!userVote && userVote !== canvasId
  const voteShare  = totalVoters > 0 ? Math.round((voteCount / totalVoters) * 100) : 0

  const handleVote = async () => {
    if (!user || voting) return
    setVoting(true)
    try {
      if (votedThis) { await retractVote(); setUserVote(null) }
      else { await castVote(canvasId); setUserVote(canvasId) }
      setVoteCount(await getVoteCount(canvasId))
      setTotal(await getTotalVoters())
    } finally {
      setVoting(false)
    }
  }

  return (
    <Surface variant="secondary" className="rounded-[var(--radius)] p-5 flex flex-col gap-4">

      {/* header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Eyebrow variant="dot">{VOTE_MONTH_LABEL} vote</Eyebrow>
        {isWinner && (
          <Chip color="accent" variant="primary" size="sm" className="font-bold">
            <span className="mr-1" aria-hidden>🏆</span>Drawing of the Month
          </Chip>
        )}
      </div>

      {/* tally */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tabular-nums leading-none text-[var(--foreground)]">
            {voteCount}
          </span>
          <span className="text-sm text-[var(--muted)]">votes</span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-[var(--default)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${Math.max(voteShare, voteCount > 0 ? 4 : 0)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          <span className="font-semibold text-[var(--foreground)]">{voteShare}%</span>
          {' '}of {totalVoters} votes cast this month
        </p>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-1.5">
        {isAuthed ? (
          <>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onPress={handleVote}
              isDisabled={voting}
              className={votedThis ? 'ring-1 ring-[var(--accent)]' : ''}
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
              <p className="text-[11px] text-center text-[var(--muted)]">
                You voted for a different artwork this month.
              </p>
            )}
          </>
        ) : (
          <Button variant="secondary" size="md" fullWidth onPress={() => nav('/login')}>
            Sign in to vote →
          </Button>
        )}
      </div>

    </Surface>
  )
}
