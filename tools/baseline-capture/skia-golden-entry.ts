/**
 * Phase 4 Skia golden harness. Renders every corpus case through the shared
 * StrokeEngine driving the SkiaBackend (CanvasKit/WASM), then diffs the result
 * against the deterministic Phase-0/2 baseline PNG. Same engine + seeds as the
 * Canvas2D path, so differences are purely Skia-vs-Canvas2D rasterisation
 * (antialiasing, gradient/blend math) — the tolerance the plan expects.
 */
import CanvasKitInit from 'canvaskit-wasm'
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url'
import {
  StrokeEngine, type InputPoint, type ToolId, type ToolSettings, type AssistSettings,
} from '@drawie/core'
import { SkiaBackend } from '@drawie/renderer'
import { DEFAULT_SETTINGS, type Corpus } from './replay'
import corpusJson from '../../docs/baseline/stroke-corpus.json'

const corpus = corpusJson as unknown as Corpus
const SIZE = corpus.canvas.internalSize
const SEED = 0x9e3779b9
const ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5, shapeAssist: false, shapeStrength: 0.6,
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
function driveStroke(backend: SkiaBackend, spec: any) {
  const settings: ToolSettings = { ...DEFAULT_SETTINGS[spec.tool as ToolId], ...(spec.settings ?? {}) }
  const path = corpus.paths[spec.path]; const profile = corpus.pressureProfiles[spec.pressure]
  const dt = corpus.generator.sampleDtMs
  const eng = new StrokeEngine(backend, spec.tool, settings, ASSIST, SEED)
  let t = 0
  if ((path as any).type === 'dwell') {
    const pp = path as any
    for (let i = 0; i < pp.moveSamples; i++) { const f = pp.moveSamples===1?1:i/(pp.moveSamples-1); const {x,y}=pointAt(path,f); const {pressure,hasPressure}=pressureAt(profile,f); const ip: InputPoint={x,y,pressure,hasPressure,t}; i===0?eng.begin(ip):eng.extend(ip); t+=dt }
    for (let j = 0; j < pp.holdSamples; j++) { eng.tick(t); t+=dt }
    eng.end(); return
  }
  const n = (path as any).samples
  for (let i = 0; i < n; i++) { const f = n===1?0:i/(n-1); const {x,y}=pointAt(path,f); const {pressure,hasPressure}=pressureAt(profile,f); const ip: InputPoint={x,y,pressure,hasPressure,t}; i===0?eng.begin(ip):eng.extend(ip); t+=dt }
  eng.end()
}

function flattenWhite(d: Uint8Array | Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray((d.length/4)*3)
  for (let i=0,o=0;i<d.length;i+=4,o+=3){ const a=d[i+3]/255; out[o]=d[i]*a+255*(1-a); out[o+1]=d[i+1]*a+255*(1-a); out[o+2]=d[i+2]*a+255*(1-a) }
  return out
}
function ink(rgb: Uint8ClampedArray) { let n=0; for(let i=0;i<rgb.length;i+=3){ if(Math.max(255-rgb[i],255-rgb[i+1],255-rgb[i+2])>24)n++ } return n/(rgb.length/3) }
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('decode '+url)); im.src = url })
}

declare global {
  interface Window {
    __caseIds: string[]
    __skiaGolden: (id: string) => Promise<{ id: string; meanAbs: number; maxAbs: number; pctDiff: number; inkRatio: number }>
    __ready: boolean
    __initErr?: string
  }
}

const cmp = document.createElement('canvas'); cmp.width = SIZE; cmp.height = SIZE
const cctx = cmp.getContext('2d', { willReadFrequently: true })!

;(async () => {
  try {
    const ck = await CanvasKitInit({ locateFile: () => wasmUrl })
    const surface = ck.MakeSurface(SIZE, SIZE)!
    const backend = new SkiaBackend(ck, surface)
    const skc = surface.getCanvas()

    window.__caseIds = corpus.cases.map((c) => c.id)
    window.__skiaGolden = async (id: string) => {
      const c = corpus.cases.find((x) => x.id === id)!
      // white bg + setups + main(repeat) + then
      skc.clear(ck.WHITE)
      for (const name of c.setup ?? []) { const s = corpus.setups[name]; driveStroke(backend, s); if ((s as any).then) driveStroke(backend, (s as any).then) }
      const repeat = (c as any).repeat ?? 1
      for (let r = 0; r < repeat; r++) driveStroke(backend, c)
      if ((c as any).then) driveStroke(backend, (c as any).then)
      surface.flush()
      const aRaw = skc.readPixels(0, 0, { width: SIZE, height: SIZE, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB }) as Uint8Array
      const a = flattenWhite(aRaw)
      // baseline
      const img = await loadImage(`/docs/baseline/captures/${id}.png`)
      cctx.clearRect(0,0,SIZE,SIZE); cctx.drawImage(img,0,0,SIZE,SIZE)
      const b = flattenWhite(cctx.getImageData(0,0,SIZE,SIZE).data)
      let sum=0,max=0,diff=0; const n=a.length/3
      for (let i=0;i<a.length;i+=3){ const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2])); sum+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); if(d>max)max=d; if(d>16)diff++ }
      const inkA=ink(a), inkB=ink(b)
      return { id, meanAbs: sum/(n*3), maxAbs: max, pctDiff: diff/n*100, inkRatio: inkB>1e-9?inkA/inkB:(inkA<1e-9?1:Infinity) }
    }
    window.__ready = true
  } catch (e: any) {
    window.__initErr = String(e?.message ?? e)
    window.__ready = true
  }
})()
