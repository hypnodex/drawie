// Edge Function: moderate
//
// Server-side proxy for the OpenAI vision-LLM moderation call. Moves the API
// key out of the client bundle (it lives in the OPENAI_API_KEY Edge secret).
// Mirrors moderateWithOpenAI() in src/services/moderationService.ts: it reads
// any text drawn in the image AND judges the imagery, returning a structured
// verdict the client maps to findings. The client keeps its deterministic word
// lists + on-device nsfwjs/OCR as a fallback when this is unavailable.

const OPENAI_MODEL = 'gpt-4o-mini'

const SYSTEM_PROMPT =
  'You are a strict content-moderation system for a collaborative drawing app. ' +
  "You receive an image of a user's drawing, and optionally text fields. " +
  'Carefully READ any text visible in the image (it may be hand-drawn or messy) ' +
  'and also judge the drawn imagery itself. Flag content that violates community ' +
  'guidelines, including: explicit or sexual imagery (genitalia, sexual acts, nudity); ' +
  'offensive or vulgar drawings; hateful, abusive or discriminatory content; ' +
  'offensive or extremist symbols (e.g. swastikas); profanity or vulgar words ' +
  '(e.g. "fuck", "shit", "pussy", "dick"); insulting, harassing or threatening text. ' +
  'Respond with ONLY a JSON object: ' +
  '{"flagged": boolean, "categories": string[], "reason": string}. ' +
  'Use categories from ["sexual","hate","harassment","profanity","symbols","violence"]. ' +
  'If nothing violates the guidelines, return {"flagged": false, "categories": [], "reason": ""}.'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Body {
  texts?: string[]
  /** data URL (jpeg/png) of the composited artboard, ≤1024px recommended. */
  imageDataUrl?: string
}

interface Verdict {
  flagged: boolean
  categories: string[]
  reason: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const key = Deno.env.get('OPENAI_API_KEY')?.trim()
  if (!key) {
    // No key configured → tell the client to fall back to its local pipeline.
    return json({ flagged: false, categories: [], reason: '', unavailable: true }, 200)
  }

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'bad request' }, 400) }

  const content: Array<Record<string, unknown>> = []
  const textBlob = (body.texts ?? []).filter((t) => t && t.trim()).join('\n').trim()
  if (textBlob) content.push({ type: 'text', text: `Text fields to review:\n${textBlob}` })
  if (body.imageDataUrl) {
    content.push({ type: 'image_url', image_url: { url: body.imageDataUrl, detail: 'high' } })
  }
  if (content.length === 0) return json({ flagged: false, categories: [], reason: '' }, 200)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return json({ error: `openai ${res.status}`, detail, unavailable: true }, 502)
    }
    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content
    if (!raw) return json({ error: 'empty', unavailable: true }, 502)
    const parsed = JSON.parse(raw) as Verdict
    return json({
      flagged: !!parsed.flagged,
      categories: parsed.categories ?? [],
      reason: parsed.reason ?? '',
    }, 200)
  } catch (err) {
    return json({ error: String(err), unavailable: true }, 502)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
