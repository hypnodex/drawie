/**
 * Browser entry for the baseline capture harness. Vite serves this; the Playwright
 * runner (run.mjs) loads the page and calls window.__capture(id) per corpus case.
 *
 * Kept UI-free on purpose — it just hosts the engine against a 2000² canvas.
 */
import { drawCase, type Corpus } from './replay'
import corpusJson from '../../docs/baseline/stroke-corpus.json'

const corpus = corpusJson as unknown as Corpus
const SIZE = corpus.canvas.internalSize

const canvas = document.createElement('canvas')
canvas.width = SIZE
canvas.height = SIZE
// willReadFrequently mirrors Canvas.tsx — the engine reads pixels back per stamp.
const ctx = canvas.getContext('2d', { willReadFrequently: true })!

// A scaled-down preview so a human opening the page directly can eyeball it.
canvas.style.width = '480px'
canvas.style.height = '480px'
canvas.style.border = '1px solid #ccc'
document.body.style.margin = '12px'
document.body.appendChild(canvas)

declare global {
  interface Window {
    __caseIds: string[]
    __capture: (id: string) => string
    __ready: boolean
  }
}

window.__caseIds = corpus.cases.map((c) => c.id)
window.__capture = (id: string): string => {
  const c = corpus.cases.find((x) => x.id === id)
  if (!c) throw new Error(`no corpus case "${id}"`)
  drawCase(ctx, corpus, c)
  return canvas.toDataURL('image/png')
}
window.__ready = true
