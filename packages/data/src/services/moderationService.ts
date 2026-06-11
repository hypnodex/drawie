import type { NSFWJS } from 'nsfwjs'
import { supabase, dataDebug } from '../supabase'

/**
 * Content moderation service.
 *
 * A single reusable entry point — `moderateContent()` — that screens both the
 * TEXT attached to a canvas (title / description / style rules / any future
 * on-canvas text) and the VISUAL content of the rendered artboard, returning a
 * structured verdict. It is consumed by every place a canvas can be persisted
 * or published (drawing artboard Save / Submit, and the create-canvas Publish),
 * so the rules live in exactly one place.
 *
 * Async by design: a production deployment would call a hosted moderation model
 * (e.g. a vision SafeSearch endpoint + a text-classification API). The async
 * shape means callers naturally get loading states, and swapping the mock
 * internals for real network calls later requires no change at the call sites.
 *
 * Collaborative canvases: moderation runs per action on the submitting client
 * before the contribution is recorded, so each user's tile is screened
 * independently — a shared mosaic can never accumulate un-screened content, and
 * one user's blocked submission never affects anyone else's work.
 */

export type ModerationCategory =
  | 'sexual'      // explicit / sexual imagery or words
  | 'hate'        // hateful, abusive or discriminatory content (incl. slurs)
  | 'harassment'  // insulting / harassing / threatening text
  | 'profanity'   // profanity / vulgar words
  | 'symbols'     // offensive / extremist symbols

export type ModerationSource = 'text' | 'image'

export interface ModerationFinding {
  category: ModerationCategory
  source: ModerationSource
  /** Redacted, log-safe detail (never echoed back to the end user). */
  detail: string
}

export interface ModerationResult {
  allowed: boolean
  findings: ModerationFinding[]
  /** User-facing message. Empty string when allowed. */
  message: string
}

export interface ModerationInput {
  /** Free-text fields to scan (title, description, on-canvas text, …). */
  texts?: Array<string | null | undefined>
  /** Rendered artboard to scan visually (web — encoded to a data URL here). */
  image?: HTMLCanvasElement | null
  /** Pre-encoded image data URL to scan visually (native — no DOM canvas; the
   *  caller composites + downscales + encodes JPEG itself). Takes precedence over
   *  `image`. There's no on-device fallback for this path, so it fail-opens if the
   *  edge function is unavailable. */
  imageDataUrl?: string
}

/** The single canonical message shown whenever content is blocked. */
export const GUIDELINES_MESSAGE =
  'This canvas contains content that violates our community guidelines. ' +
  'Please edit the canvas before saving or publishing.'

// ── Word / phrase lists ────────────────────────────────────────────────────
//
// Representative, intentionally NOT exhaustive. A production system should back
// this with a maintained list or a hosted text-classification service. Matching
// is whole-token (with leetspeak normalisation) to avoid the "Scunthorpe
// problem" — i.e. innocent words that merely contain a flagged substring.

const WORD_LISTS: Record<ModerationCategory, string[]> = {
  profanity: [
    'fuck', 'fucking', 'fucked', 'fucker', 'motherfucker', 'shit', 'bullshit',
    'bitch', 'bastard', 'asshole', 'jackass', 'dick', 'dickhead', 'prick',
    'piss', 'crap', 'douchebag', 'wanker', 'bollocks', 'twat',
    // common obfuscations / OCR mis-reads
    'fvck', 'fuk', 'fck', 'phuck', 'fuckyou', 'fucku', 'shyt', 'biatch',
  ],
  sexual: [
    'porn', 'pornographic', 'nude', 'nudes', 'naked', 'nudity', 'sexual',
    'sexually', 'blowjob', 'handjob', 'dildo', 'boobs', 'tits', 'titty',
    'penis', 'vagina', 'genitals', 'masturbate', 'masturbation', 'orgasm',
    'anal', 'fetish', 'nsfw', 'xxx', 'hentai', 'erotic', 'rape', 'rapist',
    'slut', 'whore', 'cock', 'cocks', 'pussy', 'cum', 'boner', 'dickpic',
  ],
  hate: [
    'nigger', 'nigga', 'faggot', 'retard', 'retarded', 'spic', 'chink',
    'kike', 'tranny', 'coon', 'gook', 'wetback', 'beaner',
  ],
  harassment: [
    'kys', 'worthless', 'pathetic',
  ],
  symbols: [
    'swastika', 'nazi', 'kkk',
  ],
}

/** Multi-word phrases — matched against the alphanumeric-collapsed text. */
const PHRASE_LISTS: Array<{ phrase: string; category: ModerationCategory }> = [
  { phrase: 'killyourself',   category: 'harassment' },
  { phrase: 'killurself',     category: 'harassment' },
  { phrase: 'neckyourself',   category: 'harassment' },
  { phrase: 'godie',          category: 'harassment' },
  { phrase: 'heilhitler',     category: 'symbols' },
  { phrase: 'siegheil',       category: 'symbols' },
  { phrase: 'kukluxklan',     category: 'symbols' },
  { phrase: 'whitepower',     category: 'hate' },
  { phrase: 'whitesupremacy', category: 'hate' },
  { phrase: '1488',           category: 'symbols' },
]

const WORD_INDEX: Map<string, ModerationCategory> = new Map()
for (const [category, words] of Object.entries(WORD_LISTS) as [ModerationCategory, string[]][]) {
  for (const w of words) WORD_INDEX.set(w, category)
}

// Terms safe to match as SUBSTRINGS (no common innocent word contains them).
// Needed because OCR output is noisy and often concatenates/garbles tokens, so
// whole-token matching alone misses things like "ifuckk" or "penis!!".
const SUBSTRING_TERMS: Array<{ term: string; category: ModerationCategory }> = [
  { term: 'fuck', category: 'profanity' },
  { term: 'fvck', category: 'profanity' },
  { term: 'motherfuck', category: 'profanity' },
  { term: 'penis', category: 'sexual' },
  { term: 'vagina', category: 'sexual' },
  { term: 'blowjob', category: 'sexual' },
  { term: 'handjob', category: 'sexual' },
  { term: 'dildo', category: 'sexual' },
  { term: 'dickpic', category: 'sexual' },
  { term: 'swastika', category: 'symbols' },
]

/** Common leetspeak → letter substitutions. */
function deleet(token: string): string {
  return token
    .replace(/@/g, 'a').replace(/\$/g, 's').replace(/!/g, 'i')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
}

function redact(s: string): string {
  if (s.length <= 2) return `${s[0]}*`
  return `${s[0]}${'*'.repeat(s.length - 1)}`
}

/** Scan a single string. Exported so it can be unit-reused / future text tools. */
export function moderateText(input: string | null | undefined): ModerationFinding[] {
  if (!input) return []
  const findings: ModerationFinding[] = []
  const seen = new Set<string>()
  const lower = input.toLowerCase()

  // Whole-token matching (raw + leet-normalised).
  for (const raw of lower.split(/[^a-z0-9@$!]+/)) {
    if (!raw) continue
    const candidates = new Set([
      raw.replace(/[^a-z0-9]/g, ''),
      deleet(raw).replace(/[^a-z0-9]/g, ''),
    ])
    for (const c of candidates) {
      const category = c && WORD_INDEX.get(c)
      if (category && !seen.has(category + c)) {
        seen.add(category + c)
        findings.push({ category, source: 'text', detail: redact(c) })
      }
    }
  }

  // Phrase + safe-substring matching against the alphanumeric-collapsed text
  // (handles spacing, punctuation, symbol-numbers like "1488", and OCR noise).
  // Also run the leet-normalised collapsed form so e.g. "fvck"→"fvck" and
  // "f0ck"→"fock" variants are reachable.
  const collapsed = lower.replace(/[^a-z0-9]/g, '')
  const collapsedLeet = deleet(lower).replace(/[^a-z0-9]/g, '')
  const hay = (s: string) => collapsed.includes(s) || collapsedLeet.includes(s)

  for (const { phrase, category } of PHRASE_LISTS) {
    if (hay(phrase) && !seen.has(category + phrase)) {
      seen.add(category + phrase)
      findings.push({ category, source: 'text', detail: redact(phrase) })
    }
  }
  for (const { term, category } of SUBSTRING_TERMS) {
    if (hay(term) && !seen.has(category + term)) {
      seen.add(category + term)
      findings.push({ category, source: 'text', detail: redact(term) })
    }
  }

  return findings
}

// ── Visual screen: nsfwjs (TensorFlow.js) ──────────────────────────────────
//
// Real ML model. nsfwjs classifies an image into Drawing / Hentai / Neutral /
// Porn / Sexy. Drawn nudity surfaces as "Hentai", photographic nudity as
// "Porn" — so both the line-drawing and photo cases the heuristic missed are
// caught here. The model weights ship inside the nsfwjs package (no CDN), and
// tfjs + nsfwjs are dynamically imported so they never weigh down the main
// bundle — they load on first use (or via `prewarmModeration()`).

// Strict thresholds. A single Porn/Hentai signal, OR the two combined, blocks.
// Drawn genitalia tends to land in "Hentai", photographic nudity in "Porn".
// "Sexy" (suggestive but clothed) uses a slightly higher bar.
const NSFW_SINGLE_THRESHOLD = 0.30   // porn OR hentai alone
const NSFW_EXPLICIT_THRESHOLD = 0.40 // porn + hentai combined
const NSFW_SEXY_THRESHOLD = 0.65

let nsfwModelPromise: Promise<NSFWJS> | null = null

async function getNsfwModel(): Promise<NSFWJS> {
  if (!nsfwModelPromise) {
    nsfwModelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs')
      await tf.ready()
      const nsfwjs = await import('nsfwjs')
      // InceptionV3: nsfwjs's heaviest + most accurate model. Weights ship in
      // the package (loaded as on-demand chunks, ~larger first-load), so no CDN.
      return nsfwjs.load('InceptionV3')
    })()
    // Allow a retry on a later call if the first load fails.
    nsfwModelPromise.catch(() => { nsfwModelPromise = null })
  }
  return nsfwModelPromise
}

async function classifyImageNSFW(canvas: HTMLCanvasElement): Promise<ModerationFinding[]> {
  const model = await getNsfwModel()
  const preds = await model.classify(canvas)
  const p: Record<string, number> = {}
  for (const { className, probability } of preds) p[className.toLowerCase()] = probability

  const porn = p.porn ?? 0
  const hentai = p.hentai ?? 0
  const sexy = p.sexy ?? 0
  const explicit = porn + hentai

  if (dataDebug) console.debug('[moderation] nsfw scores:', p)

  if (
    porn >= NSFW_SINGLE_THRESHOLD ||
    hentai >= NSFW_SINGLE_THRESHOLD ||
    explicit >= NSFW_EXPLICIT_THRESHOLD ||
    sexy >= NSFW_SEXY_THRESHOLD
  ) {
    return [{
      category: 'sexual',
      source: 'image',
      detail: `nsfw porn=${porn.toFixed(2)} hentai=${hentai.toFixed(2)} sexy=${sexy.toFixed(2)}`,
    }]
  }
  return []
}

// ── Visual screen: OCR for words drawn on the canvas ───────────────────────
//
// Text *drawn* on the artboard is pixels, not characters, so the word lists
// above can't see it. Tesseract.js extracts any legible text from the rendered
// canvas and runs it back through `moderateText`. Best-effort: OCR of freehand
// drawing is imperfect, and any failure resolves to "no text found" rather than
// blocking the user.

type OcrWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>
let ocrWorkerPromise: Promise<OcrWorker> | null = null

async function getOcrWorker(): Promise<OcrWorker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const tesseract = await import('tesseract.js')
      const worker = await tesseract.createWorker('eng')
      // SPARSE_TEXT: find as much text as possible regardless of layout —
      // best for scattered, hand-lettered words on a drawing.
      await worker.setParameters({ tessedit_pageseg_mode: tesseract.PSM.SPARSE_TEXT })
      return worker
    })()
    ocrWorkerPromise.catch(() => { ocrWorkerPromise = null })
  }
  return ocrWorkerPromise
}

/**
 * High-contrast binarisation. Hand-drawn strokes are often a muted colour on
 * white, which Tesseract reads poorly — converting every non-white stroke to
 * solid black on white dramatically improves recognition of drawn lettering.
 */
function binarizeForOcr(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const maxDim = 1600
  const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height))
  const w = Math.max(1, Math.round(canvas.width * scale))
  const h = Math.max(1, Math.round(canvas.height * scale))
  const oc = document.createElement('canvas')
  oc.width = w; oc.height = h
  const ctx = oc.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(canvas, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const v = lum < 205 && d[i + 3] > 10 ? 0 : 255
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return oc
}

async function ocrImageText(canvas: HTMLCanvasElement): Promise<string> {
  try {
    const worker = await getOcrWorker()
    const { data } = await worker.recognize(binarizeForOcr(canvas))
    const text = data.text ?? ''
    if (dataDebug) console.debug('[moderation] OCR text:', JSON.stringify(text))
    return text
  } catch (err) {
    console.warn('[moderation] OCR unavailable:', err)
    return ''
  }
}

// ── Cloud moderation: `moderate` Edge Function (vision LLM, server-side) ────
//
// The vision-LLM call now runs in a Supabase Edge Function so the OpenAI key
// lives server-side (OPENAI_API_KEY secret) and is never bundled into the
// browser. The function both READS text drawn on the canvas AND judges the
// imagery, returning {flagged, categories, reason}. We always attempt it; if
// the server has no key configured, or the call errors, it signals
// `unavailable` and we fall back to the on-device nsfwjs + OCR pipeline.

export const usingCloudModeration = true

/** Map a returned category string to our internal category. */
function mapOpenAICategory(cat: string): ModerationCategory {
  const c = cat.toLowerCase()
  if (c.startsWith('sexual')) return 'sexual'
  if (c.startsWith('hate')) return 'hate'
  if (c.startsWith('harass')) return 'harassment'
  if (c.startsWith('profan')) return 'profanity'
  if (c.startsWith('symbol')) return 'symbols'
  return 'harassment' // violence / other umbrella — still blocks
}

/** Composite the artboard onto white, downscale, and encode as a data URL. */
function canvasToDataUrl(canvas: HTMLCanvasElement, max = 1024): string {
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height))
  const w = Math.max(1, Math.round(canvas.width * scale))
  const h = Math.max(1, Math.round(canvas.height * scale))
  const oc = document.createElement('canvas')
  oc.width = w; oc.height = h
  const ctx = oc.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(canvas, 0, 0, w, h)
  return oc.toDataURL('image/jpeg', 0.92)
}

/**
 * Screen text + image via the `moderate` Edge Function (server-side vision LLM).
 * Throws on transport error or when the function reports it's unavailable (no
 * server key configured) so the caller falls back to the local pipeline.
 */
async function moderateWithEdge(input: ModerationInput): Promise<ModerationFinding[]> {
  const texts = (input.texts ?? []).filter((t): t is string => !!t && !!t.trim())
  // Native passes a pre-encoded data URL (no DOM canvas); web encodes its HTMLCanvasElement here.
  const imageDataUrl = input.imageDataUrl ?? (input.image ? canvasToDataUrl(input.image) : undefined)
  if (texts.length === 0 && !imageDataUrl) return []

  const { data, error } = await supabase.functions.invoke('moderate', {
    body: { texts, imageDataUrl },
  })
  if (error) throw error
  const verdict = data as { flagged?: boolean; categories?: string[]; reason?: string; unavailable?: boolean } | null
  if (!verdict || verdict.unavailable) throw new Error('moderation unavailable')

  if (dataDebug) console.debug('[moderation] edge verdict:', verdict)
  if (!verdict.flagged) return []

  const source: ModerationSource = input.image || input.imageDataUrl ? 'image' : 'text'
  const cats = verdict.categories?.length ? verdict.categories : ['harassment']
  return cats.map((c) => ({
    category: mapOpenAICategory(c),
    source,
    detail: `moderate:${c}${verdict.reason ? ` (${verdict.reason})` : ''}`,
  }))
}

/**
 * On-device visual screen: OCR drawn text → word lists, plus the nsfwjs
 * classifier. Used when no OpenAI key is set, and as the fallback if a cloud
 * call fails. Never throws.
 */
async function localImageScreen(canvas: HTMLCanvasElement): Promise<ModerationFinding[]> {
  const [ocr, nsfw] = await Promise.allSettled([
    ocrImageText(canvas).then((txt) => (txt.trim() ? moderateText(txt) : [])),
    classifyImageNSFW(canvas),
  ])
  const out: ModerationFinding[] = []
  if (ocr.status === 'fulfilled') out.push(...ocr.value)
  if (nsfw.status === 'fulfilled') out.push(...nsfw.value)
  else console.warn('[moderation] NSFW model unavailable:', nsfw.reason)
  return out
}

/**
 * Kick off the OCR worker in the background (fire-and-forget) so the first
 * fallback moderation call isn't slowed by cold-start. The heavy nsfwjs model
 * is loaded lazily only if the Edge moderation is unavailable, so it isn't
 * prewarmed here. Safe to call repeatedly; loads are memoised.
 */
export function prewarmModeration(): void {
  void getOcrWorker().catch(() => {})
}

/**
 * Run the full moderation pipeline. Always resolves: a block is a normal
 * `allowed: false` result. Rejects only on an unexpected internal error so
 * callers can surface a retry state.
 *
 * Local word lists ALWAYS run over provided text (deterministic profanity
 * catch). For the visual side:
 *   • Cloud on  → one OpenAI vision-LLM call reads drawn text AND judges the
 *     imagery. If it fails (e.g. quota), it falls back to OCR + nsfwjs.
 *   • Cloud off → OCR (→ word lists) + on-device nsfwjs.
 */
export async function moderateContent(input: ModerationInput): Promise<ModerationResult> {
  const findings: ModerationFinding[] = []

  for (const t of input.texts ?? []) findings.push(...moderateText(t))

  const tasks: Promise<ModerationFinding[]>[] = []

  if (input.image || input.imageDataUrl) {
    // Single multimodal Edge call: reads drawn words + judges imagery + screens
    // the text fields. On any failure (or no server key) web falls back to the
    // on-device OCR + nsfwjs pipeline; native (imageDataUrl, no DOM canvas) has no
    // such fallback, so it fail-opens — the hosted project has the OpenAI key set.
    tasks.push(
      moderateWithEdge(input).catch((err) => {
        console.warn('[moderation] edge moderation unavailable — using on-device fallback.', err)
        return input.image ? localImageScreen(input.image) : []
      }),
    )
  } else if ((input.texts ?? []).some((t) => t && t.trim())) {
    // Text-only: let the Edge LLM also screen for hate / harassment / threats.
    tasks.push(moderateWithEdge(input).catch((err) => {
      console.warn('[moderation] edge text screen unavailable:', err)
      return []
    }))
  }

  for (const batch of await Promise.all(tasks)) findings.push(...batch)

  // De-duplicate identical findings.
  const deduped = findings.filter((f, i) =>
    findings.findIndex((g) => g.category === f.category && g.detail === f.detail) === i)

  const allowed = deduped.length === 0
  return { allowed, findings: deduped, message: allowed ? '' : GUIDELINES_MESSAGE }
}
