/**
 * Headless baseline capture runner.
 *
 * Starts a Vite dev server, loads the capture harness page in headless Chromium
 * (Playwright), replays every corpus case through the *current* Canvas-2D engine,
 * and writes docs/baseline/captures/<caseId>.png. This is the automated Phase 0
 * capture (README Option A) and the seed for the Phase 6 golden-image CI.
 *
 * Usage:  node tools/baseline-capture/run.mjs
 * Deps:   playwright (+ `npx playwright install chromium`)
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '../..')
const OUT = resolve(REPO, 'docs/baseline/captures')
const PORT = 5178
const PAGE_URL = `http://localhost:${PORT}/tools/baseline-capture/capture.html`

async function waitForServer(url, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Vite did not come up at ${url}`)
}

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
  await mkdir(OUT, { recursive: true })

  const manifest = []
  for (const id of ids) {
    const dataUrl = await page.evaluate((cid) => window.__capture(cid), id)
    const b64 = dataUrl.split(',')[1]
    const buf = Buffer.from(b64, 'base64')
    await writeFile(resolve(OUT, `${id}.png`), buf)
    manifest.push({ id, bytes: buf.length })
    console.log(`captured ${id} (${buf.length} bytes)`)
  }

  // Record the source commit so a capture set is traceable to an engine revision.
  let commit = 'unknown'
  try {
    commit = (await readFile(resolve(REPO, '.git/refs/heads/main'), 'utf8')).trim()
  } catch {
    // detached / non-main — leave as unknown
  }
  await writeFile(
    resolve(OUT, 'MANIFEST.json'),
    JSON.stringify({ engineCommit: commit, count: manifest.length, cases: manifest }, null, 2) + '\n',
  )
  console.log(`\n✅ wrote ${manifest.length} captures + MANIFEST.json to docs/baseline/captures/`)
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}
