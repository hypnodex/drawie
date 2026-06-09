import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '../..')
const PORT = 5181
const PAGE_URL = `http://localhost:${PORT}/tools/baseline-capture/compare.html`
const CASES = process.argv.slice(2)
if (!CASES.length) CASES.push('eraser-soft-over-fill', 'waterdrop-ink-over-fill', 'brush-buildup-overstroke')

async function waitForServer(url, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Vite did not come up at ${url}`)
}

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: ['ignore', 'ignore', 'inherit'] })
let browser
try {
  await waitForServer(PAGE_URL)
  browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  await page.goto(PAGE_URL, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__ready === true, { timeout: 30000 })
  for (const id of CASES) {
    const d = await page.evaluate((cid) => window.__diag(cid), id)
    console.log(`\n=== ${id} ===`)
    console.log('  diff bbox [minX,minY,maxX,maxY]:', d.bbox)
    console.log('  worst diff:', d.worst, 'at', d.worstXY, 'new', d.worstA, 'base', d.worstB)
    console.log('  buckets [0-16,16-32,32-64,64-128,128-255]:', d.buckets)
  }
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}
