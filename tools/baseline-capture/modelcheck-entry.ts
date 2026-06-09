/**
 * Phase 3 model round-trip harness. For each corpus case it renders the MAIN
 * stroke two ways onto identical setups:
 *   A) drive the StrokeEngine directly (begin/extend/tick/end), capturing the
 *      samples + tick timestamps into a ModelStroke as Canvas.tsx does;
 *   B) replayStroke() that captured ModelStroke.
 * A and B must be pixel-identical — that proves the retained model captures and
 * replays a stroke faithfully (incl. watercolor dwell ticks), so model-level
 * undo/redo and vector drafts reproduce exactly what was drawn.
 */
import {
  StrokeEngine, replayStroke, type InputPoint, type ModelStroke, type StrokeSample,
  type ToolId, type ToolSettings, type AssistSettings,
} from '@drawie/core'
import { Canvas2DBackend } from '@drawie/renderer'
import { DEFAULT_SETTINGS, type Corpus } from './replay'
import corpusJson from '../../docs/baseline/stroke-corpus.json'

const corpus = corpusJson as unknown as Corpus
const SIZE = corpus.canvas.internalSize
const SEED = 0x9e3779b9
const DEFAULT_ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5,
  shapeAssist: false, shapeStrength: 0.6,
  perfectShape: true, holdToSnap: false, holdDelay: 500,
}

function pointAt(path: any, f: number) {
  if (path.type === 'line' || path.type === 'dwell') return { x: path.from[0] + (path.to[0]-path.from[0])*f, y: path.from[1] + (path.to[1]-path.from[1])*f }
  return { x: path.xFrom + (path.xTo-path.xFrom)*f, y: path.yMid + path.amplitude*Math.sin(2*Math.PI*path.cycles*f) }
}
function pressureAt(p: any, f: number) {
  if (p.type === 'none') return { pressure: 0, hasPressure: false }
  if (p.type === 'const') return { pressure: p.value, hasPressure: true }
  return { pressure: p.from + (p.to-p.from)*f, hasPressure: true }
}

/** Drive a stroke directly onto `ctx` AND capture it into a ModelStroke. */
function driveAndCapture(ctx: CanvasRenderingContext2D, spec: any): ModelStroke {
  const settings: ToolSettings = { ...DEFAULT_SETTINGS[spec.tool as ToolId], ...(spec.settings ?? {}) }
  const path = corpus.paths[spec.path]; const profile = corpus.pressureProfiles[spec.pressure]
  const dt = corpus.generator.sampleDtMs
  const eng = new StrokeEngine(new Canvas2DBackend(ctx), spec.tool, settings, DEFAULT_ASSIST, SEED)
  const samples: StrokeSample[] = []
  const ticks: number[] = []
  let t = 0
  const push = (x: number, y: number, pressure: number, hasPressure: boolean) =>
    samples.push({ x, y, pressure, hasPressure, t })
  if ((path as any).type === 'dwell') {
    const pp = path as any
    for (let i = 0; i < pp.moveSamples; i++) {
      const f = pp.moveSamples===1?1:i/(pp.moveSamples-1); const {x,y}=pointAt(path,f); const {pressure,hasPressure}=pressureAt(profile,f)
      const ip: InputPoint = {x,y,pressure,hasPressure,t}; i===0?eng.begin(ip):eng.extend(ip); push(x,y,pressure,hasPressure); t+=dt
    }
    for (let j = 0; j < pp.holdSamples; j++) { eng.tick(t); ticks.push(t); t+=dt }
    eng.end()
  } else {
    const n = (path as any).samples
    for (let i = 0; i < n; i++) {
      const f = n===1?0:i/(n-1); const {x,y}=pointAt(path,f); const {pressure,hasPressure}=pressureAt(profile,f)
      const ip: InputPoint = {x,y,pressure,hasPressure,t}; i===0?eng.begin(ip):eng.extend(ip); push(x,y,pressure,hasPressure); t+=dt
    }
    eng.end()
  }
  return { toolId: spec.tool, settings, assist: DEFAULT_ASSIST, seed: SEED, samples, ticks: spec.tool === 'watercolor' ? ticks : undefined }
}

function drawSetupsDirect(ctx: CanvasRenderingContext2D, c: any) {
  for (const name of c.setup ?? []) {
    const s = corpus.setups[name]
    driveAndCapture(ctx, s)
    if (s.then) driveAndCapture(ctx, s.then)
  }
}

function prep(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1
  ctx.fillStyle = corpus.canvas.background || '#ffffff'; ctx.fillRect(0,0,SIZE,SIZE)
}
function mk2d() { const c = document.createElement('canvas'); c.width=SIZE; c.height=SIZE; return c.getContext('2d', { willReadFrequently: true })! }
const ctxA = mk2d(); const ctxB = mk2d()

declare global {
  interface Window {
    __caseIds: string[]
    __modelcheck: (id: string) => { id: string; meanAbs: number; maxAbs: number; samples: number; ticks: number }
    __ready: boolean
  }
}

window.__caseIds = corpus.cases.map((c) => c.id)
window.__modelcheck = (id: string) => {
  const c = corpus.cases.find((x) => x.id === id)
  if (!c) throw new Error(`no case ${id}`)
  // Identical setups on both.
  prep(ctxA); drawSetupsDirect(ctxA, c)
  prep(ctxB); drawSetupsDirect(ctxB, c)
  // A: direct drive (capture). B: replay the captured model.
  const model = driveAndCapture(ctxA, c)
  replayStroke(new Canvas2DBackend(ctxB), model)
  const a = ctxA.getImageData(0,0,SIZE,SIZE).data
  const b = ctxB.getImageData(0,0,SIZE,SIZE).data
  let sum=0, max=0; const n=a.length
  for (let i=0;i<n;i++){ const d=Math.abs(a[i]-b[i]); sum+=d; if(d>max)max=d }
  return { id, meanAbs: sum/n, maxAbs: max, samples: model.samples.length, ticks: model.ticks?.length ?? 0 }
}
window.__ready = true
