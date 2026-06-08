import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribe to realtime updates of a single canvas row — fires `onChange` when
 * its counters / status / artwork_url change (e.g. progress ticks up, or the
 * mosaic is composited and revealed on completion). `onChange` is read through
 * a ref so the subscription isn't recreated each render.
 */
export function useRealtimeCanvas(canvasId: string | undefined, onChange: () => void): void {
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    if (!canvasId) return
    const channel = supabase
      .channel(`canvas:${canvasId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'canvases', filter: `id=eq.${canvasId}` },
        () => cb.current(),
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [canvasId])
}
