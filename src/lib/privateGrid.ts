/**
 * Grid layout for private canvases.
 *
 * Given a participant count N (drawers; the host is not counted), pick a grid
 * (cols × rows) whose overall shape is ~4:3 or ~16:9 and whose cell count is as
 * close as possible to N without going under. Surplus cells (cells − N, usually
 * 0 or 1) become the host's artboard(s) — e.g. an odd N yields one surplus cell
 * which the host takes.
 */

export interface GridLayout {
  cols: number
  rows: number
  cells: number
  ratio: '4:3' | '16:9'
  /** cells − participants; the host's claimable artboard count (≥ 0). */
  hostExtra: number
}

const RATIOS: { id: '4:3' | '16:9'; w: number; h: number }[] = [
  { id: '4:3', w: 4, h: 3 },
  { id: '16:9', w: 16, h: 9 },
]

/** Candidate (cols, rows) for a ratio that holds at least `n` cells. */
function candidateFor(n: number, w: number, h: number): { cols: number; rows: number } {
  // Aim for cols/rows ≈ w/h with cols*rows ≈ n  →  rows ≈ sqrt(n * h / w).
  const rows = Math.max(1, Math.round(Math.sqrt((n * h) / w)))
  const cols = Math.max(1, Math.ceil(n / rows))
  return { cols, rows }
}

export function gridForParticipants(participants: number): GridLayout {
  const n = Math.max(1, Math.floor(participants))

  let best: GridLayout | null = null
  let bestErr = Infinity
  for (const r of RATIOS) {
    const { cols, rows } = candidateFor(n, r.w, r.h)
    const cells = cols * rows
    const surplus = cells - n
    const ratioErr = Math.abs(cols / rows - r.w / r.h)
    // Rank by least wasted cells, then closest ratio.
    if (!best || surplus < best.hostExtra || (surplus === best.hostExtra && ratioErr < bestErr)) {
      best = { cols, rows, cells, ratio: r.id, hostExtra: surplus }
      bestErr = ratioErr
    }
  }
  return best!
}

/**
 * Index of the cell closest to the geometric centre of a cols×rows grid.
 * Row-major index = row * cols + col. Ties break toward the lower row/col.
 */
export function centerCellIndex(cols: number, rows: number): number {
  const cx = (cols - 1) / 2
  const cy = (rows - 1) / 2
  let bestIdx = 0
  let bestDist = Infinity
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const d = (col - cx) ** 2 + (row - cy) ** 2
      if (d < bestDist) {
        bestDist = d
        bestIdx = row * cols + col
      }
    }
  }
  return bestIdx
}
