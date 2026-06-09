// Phase 3 model round-trip: direct-drive vs replayStroke(captured model). Must be 0.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '../..')
const PORT = 5184
const PAGE_URL = `http://localhost:${PORT}/tools/baseline-capture/modelcheck.html`

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
  const ids = await page.evaluate(() => window.__caseIds)
  console.log('\n' + 'case'.padEnd(32) + 'meanAbs'.padStart(9) + 'maxAbs'.padStart(8) + 'samples'.padStart(9) + 'ticks'.padStart(7))
  console.log('─'.repeat(65))
  let worst = 0, fails = 0
  for (const id of ids) {
    const m = await page.evaluate((cid) => window.__modelcheck(cid), id)
    if (m.meanAbs > worst) worst = m.meanAbs
    if (m.meanAbs > 0.01) fails++
    console.log(id.padEnd(32) + m.meanAbs.toFixed(4).padStart(9) + String(m.maxAbs).padStart(8) + String(m.samples).padStart(9) + String(m.ticks).padStart(7))
  }
  console.log('─'.repeat(65))
  console.log(`worst meanAbs: ${worst.toFixed(5)} / 255 · ${ids.length - fails}/${ids.length} round-trip clean`)
  process.exitCode = fails ? 1 : 0
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}
