// Drives the two-client broadcast harness (Vite + Playwright). Prints the receiver's handler-call log
// so we can see whether end/undo/redo/clear reach the neighbor and trigger re-renders.
import { chromium, webkit, firefox } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ENGINES = { chromium, webkit, firefox }
const engineName = process.argv[2] || 'chromium'
const engine = ENGINES[engineName] || chromium

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '../..')
const PORT = 5187
const PAGE_URL = `http://localhost:${PORT}/tools/baseline-capture/realtime-broadcast.html`

async function waitForServer(url, tries = 120) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return } catch {} await new Promise((r) => setTimeout(r, 200)) }
  throw new Error('vite down')
}

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: ['ignore', 'ignore', 'inherit'] })
let browser
try {
  await waitForServer(PAGE_URL)
  console.log(`engine: ${engineName}`)
  browser = await engine.launch()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text()))
  await page.goto(PAGE_URL, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__ready === true, { timeout: 30000 })
  const log = await page.evaluate(() => window.__run())
  console.log('\n=== receiver handler call log ===')
  for (const line of log) console.log('  ' + line)
  console.log('\nEXPECT: onStart, onAppend, onEnd after stroke; onRerender(strokes=0) after undo;')
  console.log('        onRerender(strokes=1) after redo; onRerender(strokes=0) after clear.')
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}
