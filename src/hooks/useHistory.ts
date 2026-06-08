import { useCallback, useRef, useState } from 'react'

interface LayerStack {
  past: ImageData[]
  future: ImageData[]
}

/**
 * Per-layer image-snapshot history. Each layer id has its own undo/redo stack.
 */
export function useHistory(maxEntries = 30) {
  const stacks = useRef(new Map<string, LayerStack>())
  const [version, setVersion] = useState(0)

  const ensure = (id: string): LayerStack => {
    let s = stacks.current.get(id)
    if (!s) {
      s = { past: [], future: [] }
      stacks.current.set(id, s)
    }
    return s
  }

  const push = useCallback((layerId: string, snap: ImageData) => {
    const s = ensure(layerId)
    s.past.push(snap)
    if (s.past.length > maxEntries) s.past.shift()
    s.future = []
    setVersion((v) => v + 1)
  }, [maxEntries])

  const undo = useCallback((layerId: string, current: ImageData): ImageData | null => {
    const s = ensure(layerId)
    if (s.past.length === 0) return null
    const prev = s.past.pop()!
    s.future.push(current)
    setVersion((v) => v + 1)
    return prev
  }, [])

  const redo = useCallback((layerId: string, current: ImageData): ImageData | null => {
    const s = ensure(layerId)
    if (s.future.length === 0) return null
    const next = s.future.pop()!
    s.past.push(current)
    setVersion((v) => v + 1)
    return next
  }, [])

  const dropLayer = useCallback((layerId: string) => {
    stacks.current.delete(layerId)
    setVersion((v) => v + 1)
  }, [])

  const canUndo = (layerId: string) => (stacks.current.get(layerId)?.past.length ?? 0) > 0
  const canRedo = (layerId: string) => (stacks.current.get(layerId)?.future.length ?? 0) > 0

  return { push, undo, redo, dropLayer, canUndo, canRedo, version }
}
