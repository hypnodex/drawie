// Edge Function: send-mosaic-email
//
// Sends a guest a confirmation email after they submit their tile, with a link
// back to the live mosaic. Uses Resend (https://resend.com) — set the secrets:
//   supabase secrets set RESEND_API_KEY=...   (required to actually send)
//   supabase secrets set MAIL_FROM="Drawie <noreply@yourdomain>"  (optional)
// Without RESEND_API_KEY it no-ops gracefully (returns { sent:false }), so the
// rest of the submit flow is never blocked.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Body {
  email?: string
  name?: string
  canvasTitle?: string
  link?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'bad request' }, 400) }
  const { email, name, canvasTitle, link } = body
  if (!email || !link) return json({ error: 'email and link required' }, 400)

  const key = Deno.env.get('RESEND_API_KEY')?.trim()
  if (!key) return json({ sent: false, unavailable: true }, 200)

  const from = Deno.env.get('MAIL_FROM')?.trim() || 'Drawie <onboarding@resend.dev>'
  const title = canvasTitle || 'a shared canvas'
  const who = name || 'there'

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0a0b0e">
      <h1 style="font-size:20px">Your tile is in the mosaic 🎨</h1>
      <p>Hi ${escapeHtml(who)}, thanks for contributing to <b>${escapeHtml(title)}</b>.</p>
      <p>Watch the mosaic fill in and see the full reveal once every artist has finished:</p>
      <p><a href="${escapeAttr(link)}"
            style="display:inline-block;background:#7c8cff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700">
        View the mosaic →</a></p>
      <p style="color:#6b7280;font-size:12px">Or paste this link: ${escapeHtml(link)}</p>
    </div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Your tile is in — ${title}`,
        html,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return json({ sent: false, error: `resend ${res.status}`, detail }, 502)
    }
    return json({ sent: true }, 200)
  } catch (err) {
    return json({ sent: false, error: String(err) }, 502)
  }
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}
function json(b: unknown, status: number): Response {
  return new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
