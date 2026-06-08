import type { Canvas, Tile, TileStatus } from '../types/domain'
import { MOCK_USERS } from './users'

/**
 * Deterministic per-canvas tile generator. Same canvas → same tile layout
 * across reloads, but different canvases get different patterns.
 */

function seedRand(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function generateTilesFor(canvas: Canvas): Tile[] {
  const total = canvas.gridRows * canvas.gridCols
  const rand = seedRand(hash(canvas.id))
  // Pick `completedTiles` random indices to mark completed; a few more for
  // in-progress; the rest empty.
  const indices = Array.from({ length: total }, (_, i) => i)
  // Fisher–Yates shuffle with seeded rand
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const completed = new Set(indices.slice(0, canvas.completedTiles))
  // Up to ~half of activeContributors are mid-stroke right now
  const inProgressCount = Math.min(
    canvas.activeContributors,
    total - canvas.completedTiles,
  )
  const inProgress = new Set(indices.slice(
    canvas.completedTiles,
    canvas.completedTiles + inProgressCount,
  ))

  const createdMs = new Date(canvas.createdAt || '2025-01-01').getTime()
  const dayMs = 86_400_000

  const tiles: Tile[] = []
  for (let r = 0; r < canvas.gridRows; r++) {
    for (let c = 0; c < canvas.gridCols; c++) {
      const i = r * canvas.gridCols + c
      let status: TileStatus = 'empty'
      if (completed.has(i)) status = 'completed'
      else if (inProgress.has(i)) status = 'in-progress'

      const userIdx = Math.floor(rand() * MOCK_USERS.length)
      const u = MOCK_USERS[userIdx]
      // Deterministic date: 1–25 days after canvas creation
      const daysOffset = Math.floor(rand() * 25) + 1
      const tileDate = new Date(createdMs + daysOffset * dayMs).toISOString()

      const id = `${canvas.id}:t-${r}-${c}`
      tiles.push({
        id,
        canvasId: canvas.id,
        row: r,
        col: c,
        status,
        assignedUserId:  status !== 'empty'     ? u.id     : undefined,
        contributorName: status !== 'empty'     ? u.name   : undefined,
        startedAt:       status !== 'empty'     ? tileDate : undefined,
        completedAt:     status === 'completed' ? tileDate : undefined,
      })
    }
  }
  return tiles
}
