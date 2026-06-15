/**
 * Two-client live-broadcast harness — exercises the REAL broadcaster + receiver over the local
 * Supabase WebSocket (two separate clients = two "windows"), to verify the full start→end→undo→redo→
 * clear flow end to end. Reports the sequence of receiver handler calls so we can see exactly which
 * events reach the neighbor and whether `committed` populates (so undo/redo re-render).
 */
import { initSupabase, createStrokeBroadcaster, createNeighborReceiver, type TileKey } from '@drawie/data'
import { DEFAULT_SETTINGS, DEFAULT_ASSIST } from '@drawie/core'

// Local-stack defaults (the harness is served from the repo root, so apps/web/.env.local isn't read).
const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'http://127.0.0.1:54321'
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function run() {
  const log: string[] = []

  // Client A — the drawer (publishes to its own tile 2,2).
  initSupabase({ url, anonKey })
  const self: TileKey = { canvasId: 'rt-test', row: 2, col: 2 }
  const bc = createStrokeBroadcaster(self, 'A', { appendMs: 20 })

  // Client B — a neighbor editing tile 2,3 (so 2,2 is its left neighbor, cell 3). Fresh client.
  initSupabase({ url, anonKey })
  createNeighborReceiver({ canvasId: 'rt-test', row: 2, col: 3 }, 5, 5, {
    onStart: (s) => log.push(`onStart cell=${s.cell}`),
    onAppend: (s) => log.push(`onAppend n=${s.samples.length}`),
    onEnd: (s) => log.push(`onEnd cell=${s.cell}`),
    onRerender: (cell, strokes) => log.push(`onRerender cell=${cell} strokes=${strokes.length}`),
  })

  await sleep(1200) // let both channels SUBSCRIBE

  const settings = DEFAULT_SETTINGS.brush
  // HIGH VOLUME: many strokes with many appends each (mimics dense scribbling) to see if a flood
  // causes later single-message events (undo/clear) to be dropped at delivery.
  const STROKES = Number(new URLSearchParams(location.search).get('strokes') || 40)
  let recvBefore = 0
  for (let s = 0; s < STROKES; s++) {
    bc.begin({ strokeId: `s${s}`, toolId: 'brush', settings, assist: DEFAULT_ASSIST, seed: 1000 + s }, { x: 100, y: 100, pressure: 0.7, hasPressure: true, t: 0 })
    for (let i = 0; i < 12; i++) { bc.append([{ x: 100 + i * 12, y: 100 + i * 9, pressure: 0.7, hasPressure: true, t: i * 10 }]); await sleep(5) }
    bc.end()
    await sleep(8)
  }
  await sleep(600)
  recvBefore = log.filter((l) => l.startsWith('onEnd')).length
  log.push(`--- after ${STROKES} strokes (onEnd received: ${recvBefore}) ---`)

  bc.undo(); await sleep(500)
  log.push(`--- after undo (onRerender seen: ${log.some((l) => l.startsWith('onRerender'))}) ---`)
  bc.clearStrokes(); await sleep(500)
  log.push('--- after clear ---')

  return log
}

declare global {
  interface Window { __run: () => Promise<string[]>; __ready: boolean }
}
window.__run = run
window.__ready = true
