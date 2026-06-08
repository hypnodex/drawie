// Edge Function: composite-mosaic
//
// Stitches a canvas's completed tile artwork into a single mosaic PNG, uploads
// it to the public `mosaics` bucket, sets canvases.artwork_url, and broadcasts a
// reveal event on the canvas's realtime channel. Runs with the service-role key
// (bypasses RLS) so it can read every tile's private artwork and write mosaics.
//
// Invoke with { canvasId } once a canvas reaches status='completed' (the client
// calls this after the final complete_tile, or a DB webhook can trigger it).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const TILE_PX = 256 // each tile rendered at this resolution in the mosaic

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  let canvasId: string
  try { canvasId = (await req.json()).canvasId } catch { return json({ error: 'bad request' }, 400) }
  if (!canvasId) return json({ error: 'canvasId required' }, 400)

  const { data: canvas, error: cErr } = await admin
    .from('canvases').select('id, grid_rows, grid_cols, background').eq('id', canvasId).single()
  if (cErr || !canvas) return json({ error: 'canvas not found' }, 404)

  const { data: tiles } = await admin
    .from('tiles').select('row, col, artwork_path').eq('canvas_id', canvasId)

  const bg = parseColor(canvas.background)
  const W = canvas.grid_cols * TILE_PX
  const H = canvas.grid_rows * TILE_PX
  const mosaic = new Image(W, H).fill(bg)

  for (const t of tiles ?? []) {
    if (!t.artwork_path) continue
    const { data: blob } = await admin.storage.from('tiles').download(t.artwork_path)
    if (!blob) continue
    try {
      const tileImg = await Image.decode(new Uint8Array(await blob.arrayBuffer()))
      tileImg.resize(TILE_PX, TILE_PX)
      mosaic.composite(tileImg, t.col * TILE_PX, t.row * TILE_PX)
    } catch { /* skip undecodable tile */ }
  }

  const png = await mosaic.encode()
  const path = `${canvasId}.png`
  const { error: upErr } = await admin.storage.from('mosaics')
    .upload(path, png, { contentType: 'image/png', upsert: true })
  if (upErr) return json({ error: `upload failed: ${upErr.message}` }, 500)

  const { data: pub } = admin.storage.from('mosaics').getPublicUrl(path)
  await admin.from('canvases').update({ artwork_url: pub.publicUrl }).eq('id', canvasId)

  // Broadcast the reveal to anyone subscribed to this canvas.
  const channel = admin.channel(`canvas:${canvasId}`)
  await channel.send({ type: 'broadcast', event: 'mosaic-revealed', payload: { canvasId, artworkUrl: pub.publicUrl } })

  return json({ ok: true, artworkUrl: pub.publicUrl }, 200)
})

function parseColor(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return 0xffffffff
  const n = parseInt(m[1], 16)
  return (n << 8) | 0xff // RGBA
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
