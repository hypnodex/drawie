import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Breadcrumbs, Button, Chip, Popover, Spinner, Surface,
} from '@heroui/react'
import { getCanvas } from '../services/canvasService'
import { getTilesForCanvas, claimTile } from '../services/tileService'
import { getProfile, getProfilesByIds } from '../services/profileService'
import { useAsync } from '../hooks/useAsync'
import { useRealtimeTiles } from '../hooks/useRealtimeTiles'
import { useRealtimeCanvas } from '../hooks/useRealtimeCanvas'
import { MosaicPreview } from '../components/canvas/MosaicPreview'
import { ProgressBar } from '../components/canvas/ProgressBar'
import { StatusBadge } from '../components/canvas/StatusBadge'
import { CategoryChip } from '../components/canvas/CategoryChip'
import { ContributorAvatars } from '../components/canvas/ContributorAvatars'
import { PalettePreview } from '../components/canvas/PalettePreview'
import { UserAvatar } from '../components/ui/UserAvatar'
import { Eyebrow } from '../components/ui/Eyebrow'
import { Heading } from '../components/ui/Heading'
import { ExportDialog } from '../components/editor/ExportDialog'
import { VoteCard } from '../components/canvas/VoteCard'
import { useAuth } from '../state/AuthContext'
import { Avatar } from '../components/ui/Avatar'
import { timeAgo } from '../services/notificationService'
import type { Canvas, Tile, User } from '../types/domain'
import { ENFORCE_ONE_TILE_PER_USER } from '../types/domain'

export default function CanvasDetailScreen() {
  const { id = '' } = useParams()
  const { user, isAuthed, toggleSave } = useAuth()
  const nav = useNavigate()
  const [exportOpen, setExportOpen] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  const { data: canvas, loading: canvasLoading, reload: reloadCanvas } = useAsync(() => getCanvas(id), [id], null as Canvas | null)
  const { data: tiles, reload: reloadTiles } = useAsync(
    () => (canvas ? getTilesForCanvas(canvas.id) : Promise.resolve([])),
    [canvas?.id], [] as Tile[],
  )
  // Live updates while viewing: progress ticks up as tiles change, and the
  // mosaic reveals (artwork_url set) the moment the canvas completes.
  useRealtimeTiles(canvas?.id, reloadTiles)
  useRealtimeCanvas(canvas?.id, reloadCanvas)
  const { data: founder } = useAsync(
    () => (canvas ? getProfile(canvas.founderId) : Promise.resolve(null)),
    [canvas?.founderId], null as User | null,
  )
  const contributorIds = useMemo(
    () => Array.from(new Set(tiles.filter((t) => t.assignedUserId).map((t) => t.assignedUserId!))),
    [tiles],
  )
  const { data: profileMap } = useAsync(
    () => getProfilesByIds(contributorIds),
    [contributorIds.join(',')], new Map<string, User>(),
  )

  // Claim a tile (specific or random), then go draw it. Surfaces a clear
  // message instead of failing silently (e.g. the canvas filled up).
  const goDraw = useCallback(async (tileId?: string) => {
    if (!canvas) return
    if (!isAuthed) { nav('/login'); return }
    setJoining(true); setJoinError('')
    try {
      const tile = await claimTile(canvas.id, tileId)
      nav(`/canvas/${canvas.id}/draw/${tile.id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setJoinError(
        msg.includes('TILE_UNAVAILABLE')
          ? 'This canvas is full — every tile has been claimed. Check back when the mosaic is finished.'
          : 'Could not join this canvas. Please try again.',
      )
      setJoining(false)
    }
  }, [canvas, isAuthed, nav])

  if (canvasLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Spinner size="lg" /></div>
  }
  if (!canvas) return <Navigate to="/" replace />
  // Private (link-only) canvases are not browsable here — they're reached via
  // their guest/host links only.
  if (canvas.visibility === 'private-link') return <Navigate to="/" replace />
  // While the one-tile-per-user rule is paused, never treat the user as
  // "already contributed" — so empty tiles stay claimable and Join stays open.
  const userContributed = ENFORCE_ONE_TILE_PER_USER
    ? (user?.contributedCanvasIds.includes(canvas.id) ?? false)
    : false
  const userSaved = user?.savedCanvasIds.includes(canvas.id) ?? false
  const isCompleted = canvas.status === 'completed'
  // A canvas can be un-completed yet have every tile claimed (all in-progress).
  // In that case there's nothing to join — show that instead of a dead button.
  const hasFreeTiles = tiles.some((t) => t.status === 'empty')

  return (
    <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-8 sm:py-12">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Discover</Breadcrumbs.Item>
        <Breadcrumbs.Item href={`/canvas/${canvas.id}`}>{canvas.title}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="mt-6 grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <Surface variant="secondary" className="relative overflow-hidden rounded-[var(--radius)]">
            <MosaicPreview canvas={canvas} showGrid={!isCompleted} />

            {/* grid toggle */}
            <button
              type="button"
              onClick={() => setShowGrid((v) => !v)}
              aria-pressed={showGrid}
              aria-label={showGrid ? 'Hide tile grid' : 'Show tile grid'}
              title={showGrid ? 'Hide tile grid' : 'Show tile grid'}
              className={[
                'absolute top-3 right-3 z-10 w-9 h-9 rounded-xl flex items-center justify-center transition shadow-sm',
                showGrid
                  ? 'bg-[var(--foreground)] text-[var(--background)]'
                  : 'bg-[var(--background)]/80 text-[var(--foreground)] hover:bg-[var(--background)] backdrop-blur-sm',
              ].join(' ')}
            >
              <GridIcon />
            </button>

            {/* tile overlay — portaled popovers escape overflow:hidden */}
            {showGrid && (
              <div
                className="absolute inset-0 grid pointer-events-auto"
                style={{
                  gridTemplateColumns: `repeat(${canvas.gridCols}, 1fr)`,
                  gridTemplateRows: `repeat(${canvas.gridRows}, 1fr)`,
                }}
              >
                {tiles.map((tile) => (
                  <TileOverlayCell
                    key={tile.id}
                    tile={tile}
                    user={tile.assignedUserId ? profileMap.get(tile.assignedUserId) ?? null : null}
                  />
                ))}
              </div>
            )}
          </Surface>

          {!isCompleted && (
            <Surface variant="secondary" className="mt-5 rounded-[var(--radius)] p-5 sm:p-6">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${canvas.gridCols}, 1fr)` }}
              >
                {tiles.map((t) => {
                  const variant = t.status === 'completed' ? 'mosaic-tile--done'
                    : t.status === 'in-progress' ? 'mosaic-tile--active'
                    : 'mosaic-tile--empty'
                  const className = `mosaic-tile ${variant}`
                  const claimable = t.status === 'empty' && !userContributed
                  if (claimable) {
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={joining}
                        onClick={() => goDraw(t.id)}
                        className={className}
                        title={`Tile ${t.row + 1}-${t.col + 1} · empty — tap to claim`}
                      />
                    )
                  }
                  return (
                    <div
                      key={t.id}
                      className={className}
                      title={`Tile ${t.row + 1}-${t.col + 1} · ${t.status}`}
                    />
                  )
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 text-[11px] flex-wrap">
                <div className="flex items-center gap-4 text-[var(--muted)] font-medium">
                  <LegendSwatch hex="oklch(73.29% 0.1948 138.19)" label="Completed" />
                  <LegendSwatch hex="oklch(76.97% 0.2124 147.88)" label="In progress" pulse />
                  <LegendSwatch hex="oklch(94.00% 0.0026 147.88)" label="Empty" />
                </div>
                <span className="font-bold text-[var(--foreground)]">
                  {userContributed
                    ? 'Your tile is locked in · one per artist'
                    : 'Tap an empty tile to claim →'}
                </span>
              </div>
            </Surface>
          )}
        </div>

        <aside className="lg:col-span-2 flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <StatusBadge status={canvas.status} />
              {canvas.isTrending && !isCompleted && (
                <Chip color="accent" variant="primary" size="sm">
                  Trending
                </Chip>
              )}
            </div>
            <Heading level={1} size="lg">{canvas.title}</Heading>
            <p className="mt-4 text-base text-[var(--muted)] leading-relaxed">{canvas.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryChip label={canvas.category} />
            <CategoryChip label={canvas.style} />
            <CategoryChip label={canvas.topic} />
          </div>

          <Surface variant="secondary" className="rounded-[var(--radius)] p-5">
            <ProgressBar completed={canvas.completedTiles} total={canvas.totalTiles} size="md" />
            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ContributorAvatars canvas={canvas} size={26} />
                <span className="text-[var(--muted)] font-medium">{canvas.activeContributors} active</span>
              </div>
              <span className="font-mono text-[var(--muted)] tabular-nums">
                {canvas.gridRows} × {canvas.gridCols}
              </span>
            </div>
          </Surface>

          <Surface variant="secondary" className="rounded-[var(--radius)] p-5">
            <Eyebrow variant="dot">Style rules</Eyebrow>
            <p className="mt-3 text-base italic text-[var(--foreground)] leading-relaxed">
              “{canvas.styleGuidance}”
            </p>
            {canvas.colorPalette && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <Eyebrow>Palette</Eyebrow>
                <PalettePreview colors={canvas.colorPalette} size={18} />
              </div>
            )}
            {canvas.allowedTools.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <Eyebrow>Allowed tools</Eyebrow>
                <span className="text-[11px] font-mono text-[var(--foreground)]">
                  {canvas.allowedTools.join(', ')}
                </span>
              </div>
            )}
          </Surface>

          {founder && (
            <Surface variant="secondary" className="rounded-[var(--radius)] p-5 flex items-center gap-3">
              <UserAvatar user={founder} size={44} />
              <div className="flex-1">
                <Eyebrow>Founded by</Eyebrow>
                <div className="text-base font-extrabold text-[var(--foreground)] mt-0.5">{founder.name}</div>
              </div>
              <span className="font-mono text-[11px] text-[var(--muted)]">
                {canvas.discussionCount} ⌗
              </span>
            </Surface>
          )}

          {isCompleted && <VoteCard canvasId={canvas.id} />}

          <div className="flex flex-col gap-2.5">
            {!isCompleted ? (
              userContributed ? (
                <Alert status="success">
                  <Alert.Content>
                    <Alert.Title className="font-mono text-[10px] font-bold">
                      Your tile is in
                    </Alert.Title>
                    <Alert.Description className="text-sm leading-snug">
                      One artist, one tile. Come back when the mosaic is finished to see the reveal.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : hasFreeTiles ? (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  isDisabled={joining}
                  onPress={() => goDraw()}
                >
                  {joining ? 'Joining…' : <>Join canvas <span aria-hidden>→</span></>}
                </Button>
              ) : (
                <Alert status="default">
                  <Alert.Content>
                    <Alert.Title className="font-mono text-[10px] font-bold">All tiles claimed</Alert.Title>
                    <Alert.Description className="text-sm leading-snug">
                      Every artboard on this canvas is taken. Check back when the mosaic is finished to see the reveal.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )
            ) : (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={() => setExportOpen(true)}
              >
                Export artwork <span aria-hidden>→</span>
              </Button>
            )}
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => isAuthed ? toggleSave(canvas.id) : nav('/login')}
            >
              {userSaved ? '★ Saved' : '☆ Save canvas'}
            </Button>
            {joinError && (
              <Alert status="warning">
                <Alert.Content>
                  <Alert.Description className="text-sm leading-snug">{joinError}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </div>
        </aside>
      </div>

      <ExportDialog
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        canvas={canvas}
      />
    </div>
  )
}

// ── Tile grid overlay ─────────────────────────────────────────────────────────

function TileOverlayCell({ tile, user }: { tile: Tile; user: User | null }) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const { open, setOpen, onEnter, onLeave } = useHoverIntent(100, 80)
  const hasInfo = tile.status !== 'empty' && !!user

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={hasInfo ? onEnter : undefined}
        onMouseLeave={hasInfo ? onLeave : undefined}
        className={[
          'border border-white/10 transition-colors',
          hasInfo ? 'hover:bg-white/20 hover:border-white/30 cursor-default' : '',
        ].join(' ')}
      />
      {hasInfo && (
        <Popover.Content
          triggerRef={triggerRef}
          isOpen={open}
          onOpenChange={setOpen}
          isNonModal
          placement="top"
          offset={8}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          className="w-56 max-w-none p-0 overflow-hidden rounded-[var(--radius)] bg-[var(--overlay)] shadow-[var(--shadow-overlay)] outline-none"
        >
          <TileCard tile={tile} user={user} />
        </Popover.Content>
      )}
    </>
  )
}

function TileCard({ tile, user }: { tile: Tile; user: User }) {
  const nav = useNavigate()
  const date = tile.completedAt ?? tile.startedAt
  return (
    <div>
      <div className="p-3 flex items-center gap-3">
        <Avatar user={user} size={38} />
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-sm text-[var(--foreground)] truncate">{user.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={[
                'w-1.5 h-1.5 rounded-full shrink-0',
                tile.status === 'completed'
                  ? 'bg-[var(--success)]'
                  : 'bg-[var(--accent)] animate-pulse',
              ].join(' ')}
              aria-hidden
            />
            <span className="text-xs text-[var(--muted)]">
              {tile.status === 'completed' ? 'Completed' : 'In progress'}
            </span>
          </div>
          {date && (
            <div className="text-xs text-[var(--muted)] mt-0.5">
              {tile.status === 'completed' ? 'Completed' : 'Started'} {timeAgo(date)}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-[var(--separator)] px-3 py-2 flex items-center justify-between bg-[var(--surface-secondary)]">
        <span className="font-mono text-[10px] text-[var(--muted)] tabular-nums">
          row {tile.row + 1} · col {tile.col + 1}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); nav(`/profile/${user.id}`) }}
          className="text-[11px] font-bold text-[var(--accent)] inline-flex items-center gap-1 cursor-pointer"
        >
          View profile
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function GridIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function useHoverIntent(openDelay = 120, closeDelay = 0) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const onEnter = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), openDelay)
  }, [openDelay])
  const onLeave = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), closeDelay)
  }, [closeDelay])
  return { open, setOpen, onEnter, onLeave }
}

// ── Legend ────────────────────────────────────────────────────────────────────

function LegendSwatch({ hex, label, pulse }: { hex: string; label: string; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={['w-3 h-3 rounded-sm', pulse ? 'animate-pulse' : ''].join(' ')}
        style={{ background: hex }}
      />
      {label}
    </span>
  )
}
