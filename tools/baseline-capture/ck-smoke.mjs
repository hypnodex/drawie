import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '../..')
const PORT = 5186
const PAGE_URL = `http://localhost:${PORT}/tools/baseline-capture/ck-smoke.html`

async function waitForServer(url, tries = 150) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return } catch {} await new Promise((r) => setTimeout(r, 200)) }
  throw new Error('vite down')
}
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: ['ignore', 'ignore', 'inherit'] })
let browser
try {
  await waitForServer(PAGE_URL)
  browser = await chromium.launch()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()))
  await page.goto(PAGE_URL, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__ready === true, { timeout: 45000 })
  const r = await page.evaluate(() => window.__ckResult)
  console.log('CanvasKit smoke result:', JSON.stringify(r))
  console.log(r?.ok ? '✅ CanvasKit loads + renders + reads back headlessly' : '❌ CanvasKit smoke FAILED')
  process.exitCode = r?.ok ? 0 : 1
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}
