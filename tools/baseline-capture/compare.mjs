/**
 * Phase 2 parity runner.
 *
 * Starts a Vite dev server, loads the parity harness page in headless Chromium,
 * renders every corpus case through the NEW StrokeEngine → Canvas2DBackend, and
 * diffs each against its Phase 0 baseline PNG (docs/baseline/captures/<id>.png).
 *
 * Two parity classes:
 *   - deterministic tools (pen/brush/marker/watercolor/eraser/smudge/waterdrop) draw
 *     no rng → asserted to a TIGHT pixel tolerance (proves the refactor is faithful).
 *   - stochastic tools (pencil/spray/drybrush/inkbrush + textured brush) draw from the
 *     seeded rng → can't pixel-match the baseline's unseeded Math.random, so they're
 *     asserted on ink-coverage proximity instead.
 *
 * Usage:  node tools/baseline-capture/compare.mjs
 * Writes: docs/baseline/PARITY.json
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '../..')
const CAPTURES = resolve(REPO, 'docs/baseline/captures')
const PORT = 5179
const PAGE_URL = `http://localhost:${PORT}/tools/baseline-capture/compare.html`

// Tools whose marks are stochastic (rng-driven) → verified by coverage, not pixels.
const STOCHASTIC_TOOLS = new Set(['pencil', 'spray', 'drybrush', 'inkbrush'])

// Tolerances.
const DET = { meanAbs: 1.0, pctDiff: 0.5 }          // deterministic: tight pixel match
const STO = { inkLo: 0.65, inkHi: 1.5 }             // stochastic: coverage within range

async function waitForServer(url, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Vite did not come up at ${url}`)
}

const corpus = JSON.parse(await readFile(resolve(REPO, 'docs/baseline/stroke-corpus.json'), 'utf8'))
const toolOf = Object.fromEntries(corpus.cases.map((c) => [c.id, c.tool]))
const isStochastic = (id) => STOCHASTIC_TOOLS.has(toolOf[id]) || id.includes('texture')

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: REPO,
  stdio: ['ignore', 'inherit', 'inherit'],
})

let browser
try {
  await waitForServer(PAGE_URL)
  browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()))

  await page.goto(PAGE_URL, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__ready === true, { timeout: 30000 })
  const ids = await page.evaluate(() => window.__caseIds)

  const rows = []
  for (const id of ids) {
    const m = await page.evaluate((cid) => window.__compare(cid), id)
    const stochastic = isStochastic(id)
    const pass = stochastic
      ? (m.inkRatio >= STO.inkLo && m.inkRatio <= STO.inkHi)
      : (m.meanAbs <= DET.meanAbs && m.pctDiff <= DET.pctDiff)
    rows.push({ ...m, tool: toolOf[id], stochastic, pass })
  }

  // ── report ──
  const pad = (s, n) => String(s).padEnd(n)
  const num = (v, n, d = 3) => String(v.toFixed(d)).padStart(n)
  console.log('\n' + pad('case', 32) + pad('class', 7) + pad('meanAbs', 9) + pad('maxAbs', 8) + pad('%diff', 8) + pad('inkRatio', 10) + 'verdict')
  console.log('─'.repeat(90))
  for (const r of rows) {
    console.log(
      pad(r.id, 32) +
      pad(r.stochastic ? 'stoch' : 'det', 7) +
      num(r.meanAbs, 8) + ' ' +
      String(r.maxAbs).padStart(6) + '  ' +
      num(r.pctDiff, 6) + '  ' +
      num(r.inkRatio === Infinity ? 0 : r.inkRatio, 8) + '  ' +
      (r.pass ? '✅ pass' : '❌ FAIL'),
    )
  }

  const fails = rows.filter((r) => !r.pass)
  const det = rows.filter((r) => !r.stochastic)
  const detMean = det.reduce((s, r) => s + r.meanAbs, 0) / det.length
  console.log('─'.repeat(90))
  console.log(`deterministic tools: ${det.length} cases, avg meanAbs = ${detMean.toFixed(4)} / 255`)
  console.log(`${rows.length - fails.length}/${rows.length} cases pass`)
  if (fails.length) console.log('FAILED: ' + fails.map((f) => f.id).join(', '))

  await writeFile(
    resolve(REPO, 'docs/baseline/PARITY.json'),
    JSON.stringify({ tolerances: { DET, STO }, cases: rows }, null, 2) + '\n',
  )
  console.log('\n→ wrote docs/baseline/PARITY.json')
  process.exitCode = fails.length ? 1 : 0
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}
