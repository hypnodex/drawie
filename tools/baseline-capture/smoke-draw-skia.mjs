/**
 * Phase 4 interactive smoke test of the live /draw editor in SKIA mode (?skia=1).
 * Waits for CanvasKit to load (polls by attempting a stroke until ink appears),
 * then draw → undo → redo, asserting layer ink moves correctly. Proves the engine
 * renders through SkiaBackend (CanvasKit software surface) end-to-end in the app.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WEB = resolve(__dirname, '../../apps/web')
const PORT = 5188
const PAGE_URL = `http://localhost:${PORT}/draw?skia=1`

async function waitForServer(url, tries = 150) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return } catch {} await new Promise((r) => setTimeout(r, 200)) }
  throw new Error('vite down')
}
const countInk = () => {
  const c = document.querySelector('canvas')
  if (!c) return -1
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++
  return n
}

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: WEB, stdio: ['ignore', 'ignore', 'inherit'] })
let browser, ok = true
const fail = (m) => { ok = false; console.log('  ❌ ' + m) }
const pass = (m) => console.log('  ✅ ' + m)
try {
  await waitForServer(PAGE_URL)
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on('pageerror', (e) => console.error('[page error]', e.message))
  await page.goto(PAGE_URL, { waitUntil: 'load' })
  await page.waitForSelector('canvas', { timeout: 30000 })

  const rect = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
  const y = rect.y + rect.h * 0.5
  const x0 = rect.x + rect.w * 0.2, x1 = rect.x + rect.w * 0.8
  const stroke = async () => {
    await page.mouse.move(x0, y); await page.mouse.down()
    for (let i = 1; i <= 20; i++) { await page.mouse.move(x0 + (x1 - x0) * (i / 20), y); await page.waitForTimeout(8) }
    await page.mouse.up(); await page.waitForTimeout(120)
  }

  // Poll for CanvasKit readiness: a stroke only paints once ckRef is set.
  let ready = false
  for (let i = 0; i < 40 && !ready; i++) {
    await stroke()
    const ink = await page.evaluate(countInk)
    if (ink > 500) ready = true
    else { await page.click('[aria-label="Undo"]').catch(() => {}); await page.waitForTimeout(250) }
  }
  ready ? pass('CanvasKit loaded; drawing paints in Skia mode') : fail('Skia mode never painted (CanvasKit load?)')
  if (!ready) throw new Error('not ready')

  // Clear to a known state, then draw → undo → redo.
  await page.click('[aria-label="Undo"]').catch(() => {})
  await page.waitForTimeout(150)
  const inkStart = await page.evaluate(countInk)
  await stroke()
  const inkDrawn = await page.evaluate(countInk)
  inkDrawn > inkStart + 500 ? pass(`skia draw: ink ${inkStart} → ${inkDrawn}`) : fail(`skia draw no ink (${inkStart} → ${inkDrawn})`)
  await page.click('[aria-label="Undo"]'); await page.waitForTimeout(150)
  const inkUndo = await page.evaluate(countInk)
  inkUndo <= inkStart + 50 ? pass(`skia undo: ink ${inkDrawn} → ${inkUndo}`) : fail(`skia undo did not clear (${inkDrawn} → ${inkUndo})`)
  await page.click('[aria-label="Redo"]'); await page.waitForTimeout(150)
  const inkRedo = await page.evaluate(countInk)
  Math.abs(inkRedo - inkDrawn) < inkDrawn * 0.05 ? pass(`skia redo: ink → ${inkRedo} (restored)`) : fail(`skia redo mismatch (${inkDrawn} vs ${inkRedo})`)

  console.log('\n' + (ok ? '✅ /draw?skia=1 smoke test passed' : '❌ Skia smoke test FAILED'))
  process.exitCode = ok ? 0 : 1
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}
