/**
 * Phase 3 interactive smoke test of the live /draw editor (standalone, no Supabase).
 * Drives a real pointer stroke, then undo + redo, asserting the active layer's ink
 * count moves the right way — i.e. drawing → model commit → re-render, and model
 * undo/redo, all work end-to-end in the real app (not just the headless engine).
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WEB = resolve(__dirname, '../../apps/web')
const PORT = 5185
const PAGE_URL = `http://localhost:${PORT}/draw`

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
  await page.waitForTimeout(800) // let layout/zoom settle

  const rect = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    const r = c.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  const y = rect.y + rect.h * 0.5
  const x0 = rect.x + rect.w * 0.2
  const x1 = rect.x + rect.w * 0.8

  const inkStart = await page.evaluate(countInk)

  // Draw a horizontal stroke across the artboard.
  await page.mouse.move(x0, y)
  await page.mouse.down()
  for (let i = 1; i <= 24; i++) { await page.mouse.move(x0 + (x1 - x0) * (i / 24), y); await page.waitForTimeout(8) }
  await page.mouse.up()
  await page.waitForTimeout(150)
  const inkDrawn = await page.evaluate(countInk)
  inkDrawn > inkStart + 500 ? pass(`draw: ink ${inkStart} → ${inkDrawn}`) : fail(`draw produced no ink (${inkStart} → ${inkDrawn})`)

  // Undo enablement + effect.
  const undoEnabled = await page.evaluate(() => !document.querySelector('[aria-label="Undo"]')?.disabled)
  undoEnabled ? pass('undo button enabled after draw') : fail('undo button still disabled after draw')
  await page.click('[aria-label="Undo"]')
  await page.waitForTimeout(150)
  const inkUndo = await page.evaluate(countInk)
  inkUndo <= inkStart + 50 ? pass(`undo: ink ${inkDrawn} → ${inkUndo} (cleared)`) : fail(`undo did not clear ink (${inkDrawn} → ${inkUndo})`)

  // Redo restores it.
  await page.click('[aria-label="Redo"]')
  await page.waitForTimeout(150)
  const inkRedo = await page.evaluate(countInk)
  Math.abs(inkRedo - inkDrawn) < inkDrawn * 0.02 ? pass(`redo: ink → ${inkRedo} (restored)`) : fail(`redo mismatch (${inkDrawn} vs ${inkRedo})`)

  console.log('\n' + (ok ? '✅ /draw smoke test passed' : '❌ /draw smoke test FAILED'))
  process.exitCode = ok ? 0 : 1
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}
