// Phase 4 Skia golden: render corpus via SkiaBackend (CanvasKit), diff vs baseline.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dirname, '../..')
const PORT = 5187
const PAGE_URL = `http://localhost:${PORT}/tools/baseline-capture/skia-golden.html`
const STOCHASTIC = new Set(['pencil', 'spray', 'drybrush', 'inkbrush'])

async function waitForServer(url, tries = 150) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return } catch {} await new Promise((r) => setTimeout(r, 200)) }
  throw new Error('vite down')
}
const corpus = JSON.parse(await readFile(resolve(REPO, 'docs/baseline/stroke-corpus.json'), 'utf8'))
const toolOf = Object.fromEntries(corpus.cases.map((c) => [c.id, c.tool]))
const isStoch = (id) => STOCHASTIC.has(toolOf[id]) || id.includes('texture')

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: ['ignore', 'ignore', 'inherit'] })
let browser
try {
  await waitForServer(PAGE_URL)
  browser = await chromium.launch()
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()))
  await page.goto(PAGE_URL, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__ready === true, { timeout: 60000 })
  const initErr = await page.evaluate(() => window.__initErr)
  if (initErr) { console.error('CanvasKit init failed:', initErr); process.exitCode = 1 }
  else {
    const ids = await page.evaluate(() => window.__caseIds)
    const rows = []
    for (const id of ids) {
      const m = await page.evaluate((cid) => window.__skiaGolden(cid), id)
      rows.push({ ...m, tool: toolOf[id], stochastic: isStoch(id) })
    }
    const pad = (s,n)=>String(s).padEnd(n)
    console.log('\n'+pad('case',32)+pad('class',7)+'meanAbs'.padStart(8)+'maxAbs'.padStart(8)+'%diff'.padStart(8)+'inkRatio'.padStart(10))
    console.log('─'.repeat(73))
    let detWorst=0, detSum=0, detN=0
    for (const r of rows) {
      if (!r.stochastic) { detWorst=Math.max(detWorst,r.meanAbs); detSum+=r.meanAbs; detN++ }
      console.log(pad(r.id,32)+pad(r.stochastic?'stoch':'det',7)+r.meanAbs.toFixed(3).padStart(8)+String(r.maxAbs).padStart(8)+r.pctDiff.toFixed(3).padStart(8)+(r.inkRatio===Infinity?'inf':r.inkRatio.toFixed(3)).padStart(10))
    }
    console.log('─'.repeat(73))
    console.log(`deterministic tools: avg meanAbs ${(detSum/detN).toFixed(3)}/255, worst ${detWorst.toFixed(3)}/255`)
    await writeFile(resolve(REPO, 'docs/baseline/PARITY-SKIA.json'), JSON.stringify({ cases: rows }, null, 2) + '\n')
    console.log('→ wrote docs/baseline/PARITY-SKIA.json')
  }
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}
