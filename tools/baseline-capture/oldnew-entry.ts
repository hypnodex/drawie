/**
 * Direct OLD-engine vs NEW-engine parity harness — bypasses the Phase 0 baseline
 * PNGs entirely. Renders each corpus case with BOTH the pre-migration engine
 * (_old/engine.ts, restored from git, drawing straight to ctx) and the refactored
 * engine (@drawie/core → Canvas2DBackend), then diffs the two live. This isolates
 * "did my refactor change behaviour?" from "is the stored baseline PNG any good?".
 */
import { StrokeEngine as NewEngine, type InputPoint, type ToolId, type ToolSettings, type AssistSettings } from '@drawie/core'
import { Canvas2DBackend } from '@drawie/renderer'
import { StrokeEngine as OldEngine } from './_old/engine'
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

type EngineLike = { begin(p: InputPoint): void; extend(p: InputPoint): void; tick(n: number): void; end(): void }
type MakeEngine = (ctx: CanvasRenderingContext2D, tool: ToolId, s: ToolSettings, a: AssistSettings) => EngineLike

const makeOld: MakeEngine = (ctx, tool, s, a) => new OldEngine(ctx, tool, s, a)
const makeNew: MakeEngine = (ctx, tool, s, a) => new NewEngine(new Canvas2DBackend(ctx), tool, s, a, SEED)

// ── corpus expansion (mirrors replay.ts) ──
function pointAt(path: any, f: number) {
  if (path.type === 'line' || path.type === 'dwell') return { x: path.from[0] + (path.to[0]-path.from[0])*f, y: path.from[1] + (path.to[1]-path.from[1])*f }
  return { x: path.xFrom + (path.xTo-path.xFrom)*f, y: path.yMid + path.amplitude*Math.sin(2*Math.PI*path.cycles*f) }
}
function pressureAt(p: any, f: number) {
  if (p.type === 'none') return { pressure: 0, hasPressure: false }
  if (p.type === 'const') return { pressure: p.value, hasPressure: true }
  return { pressure: p.from + (p.to-p.from)*f, hasPressure: true }
}
function drawOneStroke(ctx: CanvasRenderingContext2D, mk: MakeEngine, spec: any) {
  const settings: ToolSettings = { ...DEFAULT_SETTINGS[spec.tool as ToolId], ...(spec.settings ?? {}) }
  const path = corpus.paths[spec.path]; const profile = corpus.pressureProfiles[spec.pressure]
  const dt = corpus.generator.sampleDtMs
  const eng = mk(ctx, spec.tool, settings, DEFAULT_ASSIST)
  let t = 0
  if ((path as any).type === 'dwell') {
    const pp = path as any
    for (let i = 0; i < pp.moveSamples; i++) { const f = pp.moveSamples===1?1:i/(pp.moveSamples-1); const {x,y}=pointAt(path,f); const {pressure,hasPressure}=pressureAt(profile,f); const ip={x,y,pressure,hasPressure,t}; i===0?eng.begin(ip):eng.extend(ip); t+=dt }
    for (let j = 0; j < pp.holdSamples; j++) { eng.tick(t); t+=dt }
    eng.end(); return
  }
  const n = (path as any).samples
  for (let i = 0; i < n; i++) { const f = n===1?0:i/(n-1); const {x,y}=pointAt(path,f); const {pressure,hasPressure}=pressureAt(profile,f); const ip={x,y,pressure,hasPressure,t}; i===0?eng.begin(ip):eng.extend(ip); t+=dt }
  eng.end()
}
function drawCaseWith(ctx: CanvasRenderingContext2D, mk: MakeEngine, c: any) {
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1
  ctx.fillStyle = corpus.canvas.background || '#ffffff'; ctx.fillRect(0,0,SIZE,SIZE)
  for (const name of c.setup ?? []) { const s = corpus.setups[name]; drawOneStroke(ctx, mk, s); if ((s as any).then) drawOneStroke(ctx, mk, (s as any).then) }
  const repeat = c.repeat ?? 1
  for (let r = 0; r < repeat; r++) drawOneStroke(ctx, mk, c)
  if (c.then) drawOneStroke(ctx, mk, c.then)
  ctx.restore()
}

function mk2d() { const c = document.createElement('canvas'); c.width=SIZE; c.height=SIZE; return c.getContext('2d', { willReadFrequently: true })! }
const ctxOld = mk2d(); const ctxNew = mk2d()

declare global {
  interface Window {
    __caseIds: string[]
    __oldnew: (id: string) => { id: string; meanAbs: number; maxAbs: number; pctDiff: number }
    __ready: boolean
  }
}

window.__caseIds = corpus.cases.map((c) => c.id)
window.__oldnew = (id: string) => {
  const c = corpus.cases.find((x) => x.id === id)
  if (!c) throw new Error(`no case ${id}`)
  drawCaseWith(ctxOld, makeOld, c)
  drawCaseWith(ctxNew, makeNew, c)
  const a = ctxOld.getImageData(0,0,SIZE,SIZE).data
  const b = ctxNew.getImageData(0,0,SIZE,SIZE).data
  let sum=0, max=0, diff=0; const n=a.length/4
  for (let i=0;i<a.length;i+=4){ let w=0; for(let k=0;k<4;k++){const d=Math.abs(a[i+k]-b[i+k]); sum+=d; if(d>w)w=d} if(w>max)max=w; if(w>16)diff++ }
  return { id, meanAbs: sum/(n*4), maxAbs: max, pctDiff: diff/n*100 }
}
window.__ready = true
