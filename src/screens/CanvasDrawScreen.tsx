import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Spinner } from '@heroui/react'
import DrawingScreen from './DrawingScreen'
import { getCanvas } from '../services/canvasService'
import { getTilesForCanvas, claimTile, completeTileAndMaybeReveal, uploadTileArtwork } from '../services/tileService'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../state/AuthContext'
import type { Canvas, Tile } from '../types/domain'

/**
 * Router wrapper around DrawingScreen for `/canvas/:id/draw/:tileId`. Hydrates
 * the canvas + tiles from Supabase, ensures the tile is claimed by the current
 * user (idempotent), and on submit uploads the composited artwork to storage +
 * marks the tile complete.
 */
export default function CanvasDrawScreen() {
  const { id = '', tileId = '' } = useParams()
  const nav = useNavigate()
  const { user, recordTileSubmission } = useAuth()

  const { data: canvas, loading: canvasLoading } = useAsync(() => getCanvas(id), [id], null as Canvas | null)
  const { data: tiles, loading: tilesLoading, reload } = useAsync(
    () => (canvas ? getTilesForCanvas(canvas.id) : Promise.resolve([])),
    [canvas?.id], [] as Tile[],
  )
  const tile = tiles.find((t) => t.id === tileId)

  // Claim the tile on open if it's still empty (e.g. opened directly by URL).
  useEffect(() => {
    if (canvas && tile && tile.status === 'empty') {
      claimTile(canvas.id, tile.id).then(() => reload()).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas?.id, tile?.id, tile?.status])

  if (!user) return <Navigate to="/login" replace />
  if (canvasLoading || tilesLoading) {
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
      tiles={tiles}
      sessionKey={sessionKey}
      onSubmit={async (image) => {
        let path: string | undefined
        if (image) {
          try { path = await uploadTileArtwork(canvas.id, tile.id, image) } catch { /* keep going */ }
        }
        try { await completeTileAndMaybeReveal(canvas.id, tile.id, path) } catch { /* already complete / not mine */ }
        recordTileSubmission(canvas.id)
        nav(`/canvas/${canvas.id}`, { replace: true })
      }}
      onLeave={() => nav(`/canvas/${canvas.id}`)}
    />
  )
}
