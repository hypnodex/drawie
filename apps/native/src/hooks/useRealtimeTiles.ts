import { useEffect, useRef } from 'react'
import { supabase } from '@drawie/data'

/**
 * Subscribe to realtime tile changes for a canvas. Any insert/update/delete on a tile in this
 * canvas fires `onChange` — so the grid flips status (empty → in-progress → completed) live as
 * other artists claim and submit, without a manual refresh. RLS applies to the stream, so
 * private-canvas events reach members only. `onChange` is read through a ref so the subscription
 * isn't torn down on every render.
 *
 * Ported verbatim from apps/web — supabase realtime is a WebSocket, which RN supports; no DOM.
 */
export function useRealtimeTiles(canvasId: string | undefined, onChange: () => void): void {
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    if (!canvasId) return
    const channel = supabase
      .channel(`tiles:${canvasId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tiles', filter: `canvas_id=eq.${canvasId}` },
        () => cb.current(),
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [canvasId])
}
