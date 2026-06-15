// Dev helper: give one tile's 8 neighbors REAL artwork (local Supabase) so the editor's neighbor
// slivers show true context under the live layer — the seed marks tiles "completed" but uploads no
// art. Hand-encodes distinct PNGs (no deps), uploads to the private `tiles` bucket, and sets each
// neighbor's artwork_path + status. Usage: node tools/seed-neighbor-art.mjs [canvasId] [row] [col]
import zlib from 'node:zlib'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
// Local service/secret key — pass via env so no key is committed: `SUPABASE_SECRET=$(...) node ...`.
// Get it from `npx supabase status` (the "Secret"/service_role key).
const SECRET = process.env.SUPABASE_SECRET || ''
const ALEX = '00000000-0000-0000-0000-000000000002'
if (!SECRET) {
  console.error('Set SUPABASE_SECRET (the local "Secret"/service_role key from `npx supabase status`).')
  process.exit(1)
}

const canvasId = process.argv[2] || 'canvas-cardboard-robot'
const cr = Number(process.argv[3] ?? 2)
const cc = Number(process.argv[4] ?? 2)

// ── minimal RGBA PNG encoder ──
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)) } return (~c) >>> 0 }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}
function pngRGBA(w, h, fill) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  let o = 0
  for (let y = 0; y < h; y++) { raw[o++] = 0; for (let x = 0; x < w; x++) { const p = fill(x, y); raw[o++] = p[0]; raw[o++] = p[1]; raw[o++] = p[2]; raw[o++] = 255 } }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))) }
  return [f(0), f(8), f(4)]
}
// A distinct, drawn-looking tile per neighbor: diagonal gradient + a few blobs, seeded by hue.
function makeArt(hue) {
  const S = 256
  const blobs = Array.from({ length: 5 }, (_, i) => ({ x: ((i * 53 + hue) % S), y: ((i * 97 + hue * 2) % S), r: 26 + (i * 13 + hue) % 34, c: hsl((hue + 40 + i * 30) % 360, 0.7, 0.55) }))
  return pngRGBA(S, S, (x, y) => {
    const t = (x + y) / (2 * S)
    let col = hsl(hue, 0.55, 0.35 + 0.4 * t)
    for (const b of blobs) { const dx = x - b.x, dy = y - b.y; if (dx * dx + dy * dy < b.r * b.r) col = b.c }
    return col
  })
}

const NEIGHBORS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
const sb = createClient(URL, SECRET, { auth: { persistSession: false } })

let done = 0
for (let i = 0; i < NEIGHBORS.length; i++) {
  const [dr, dc] = NEIGHBORS[i]
  const r = cr + dr, c = cc + dc
  const tileId = `${canvasId}:t-${r}-${c}`
  const path = `${canvasId}/${tileId}.png`
  const png = makeArt((i * 45) % 360)
  const up = await sb.storage.from('tiles').upload(path, png, { upsert: true, contentType: 'image/png' })
  if (up.error) { console.error(`upload ${tileId}: ${up.error.message}`); continue }
  const upd = await sb.from('tiles').update({ artwork_path: path, status: 'completed', assigned_user_id: ALEX, completed_at: new Date().toISOString() }).eq('id', tileId)
  if (upd.error) { console.error(`update ${tileId}: ${upd.error.message}`); continue }
  console.log(`✓ ${tileId} → ${path}`)
  done++
}
console.log(`\nseeded ${done}/8 neighbors of ${canvasId}:t-${cr}-${cc}`)
console.log(`open: http://localhost:5173/canvas/${canvasId}/draw/${canvasId}:t-${cr}-${cc}`)
