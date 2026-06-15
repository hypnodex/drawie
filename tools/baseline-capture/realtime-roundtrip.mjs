// Realtime live-neighbor round-trip: the RECEIVER path (events → assembler → live engine) must equal
// the canonical replayStroke of the original generated stroke. Proves the wire format is lossless and
// the live-replay reproduces the stroke. Mirrors modelcheck.mjs (Vite + Playwright in-browser).
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '../..')
const PORT = 5186
const PAGE_URL = `http://localhost:${PORT}/tools/baseline-capture/realtime-roundtrip.html`

async function waitForServer(url, tries = 120) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return } catch {} await new Promise((r) => setTimeout(r, 200)) }
  throw new Error('vite down')
}

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: ['ignore', 'ignore', 'inherit'] })
let browser
try {
  await waitForServer(PAGE_URL)
  browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()))
  await page.goto(PAGE_URL, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__ready === true, { timeout: 30000 })
  const seeds = await page.evaluate(() => window.__seeds)
  console.log('\n' + 'seed'.padEnd(8) + 'tool'.padEnd(11) + 'samples'.padStart(9) + 'meanAbs'.padStart(10) + 'maxAbs'.padStart(8))
  console.log('─'.repeat(46))
  let worst = 0, fails = 0
  for (const seed of seeds) {
    const m = await page.evaluate((s) => window.__roundtrip(s), seed)
    if (m.meanAbs > worst) worst = m.meanAbs
    const sampleMismatch = m.origSamples !== m.assembledSamples
    if (m.meanAbs > 0.001 || sampleMismatch) fails++
    const samples = sampleMismatch ? `${m.assembledSamples}/${m.origSamples}✗` : String(m.origSamples)
    console.log(String(seed).padEnd(8) + m.tool.padEnd(11) + samples.padStart(9) + m.meanAbs.toFixed(5).padStart(10) + String(m.maxAbs).padStart(8))
  }
  console.log('─'.repeat(46))
  console.log(`worst meanAbs: ${worst.toFixed(6)} / 255 · ${seeds.length - fails}/${seeds.length} round-trip clean`)
  process.exitCode = fails ? 1 : 0
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}
