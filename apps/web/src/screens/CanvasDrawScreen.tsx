import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Spinner } from '../components/ui/Spinner'
import DrawingScreen from './DrawingScreen'
import { getCanvas } from '@drawie/data'
import { getTilesForCanvas, claimTile, completeTileAndMaybeReveal, uploadTileArtwork, releaseTile } from '@drawie/data'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../state/AuthContext'
import type { Canvas, Tile } from '@drawie/data'

/**
 * Router wrapper around DrawingScreen for `/canvas/:id/draw/:tileId`. Loads the
 * canvas + its tiles together (a single fetch — chaining two useAsync calls
 * caused a redirect-back "blink" before tiles arrived), ensures the tile is
 * claimed by the current user, and on submit uploads the composited artwork to
 * storage + marks the tile complete.
 */
export default function CanvasDrawScreen() {
  const { id = '', tileId = '' } = useParams()
  const nav = useNavigate()
  const { user, recordTileSubmission } = useAuth()

  const { data, loading, reload } = useAsync(
    async () => {
      const canvas = await getCanvas(id)
      const tiles = canvas ? await getTilesForCanvas(canvas.id) : []
      return { canvas, tiles }
    },
    [id],
    { canvas: null as Canvas | null, tiles: [] as Tile[] },
  )
  const canvas = data.canvas
  const tile = data.tiles.find((t) => t.id === tileId)

  // Claim the tile on open if it's still empty (e.g. opened directly by URL).
  useEffect(() => {
    if (canvas && tile && tile.status === 'empty') {
      claimTile(canvas.id, tile.id).then(() => reload()).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas?.id, tile?.id, tile?.status])

  if (!user) return <Navigate to="/login" replace />
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--background)]"><Spinner size="lg" /></div>
  }
  if (!canvas || !tile) return <Navigate to={`/canvas/${id}`} replace />
  // Don't let someone draw on a tile assigned to another artist.
  if (tile.assignedUserId && tile.assignedUserId !== user.id) {
    return <Navigate to={`/canvas/${canvas.id}`} replace />
  }

  const sessionKey = `drawie.session.${canvas.id}.${tile.id}.v1`

  return (
    <DrawingScreen
      canvas={canvas}
      tile={tile}
      tiles={data.tiles}
      sessionKey={sessionKey}
      userId={user.id}
      onSubmit={async (image) => {
        let path: string | undefined
        if (image) {
          try { path = await uploadTileArtwork(canvas.id, tile.id, image) } catch { /* keep going */ }
        }
        try { await completeTileAndMaybeReveal(canvas.id, tile.id, path) } catch { /* already complete / not mine */ }
        recordTileSubmission(canvas.id)
        nav(`/canvas/${canvas.id}`, { replace: true })
      }}
      onLeave={async (action) => {
        // Discarding releases the claimed tile back to empty (grey) so it isn't left stuck
        // in-progress and others can claim it. Saving keeps the draft (tile stays in-progress).
        if (action === 'discard') {
          try { await releaseTile(tile.id) } catch { /* best-effort — leaving regardless */ }
        }
        nav(`/canvas/${canvas.id}`)
      }}
    />
  )
}
