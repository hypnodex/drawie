// Minimal CanvasKit headless smoke: load WASM, MakeSurface, draw a red circle on a
// white bg, read back the centre pixel. Proves CanvasKit runs in headless Chromium
// (CPU surface, no WebGL) before building the full SkiaBackend on top of it.
import CanvasKitInit from 'canvaskit-wasm'
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url'

declare global {
  interface Window {
    __ckResult?: { ok: boolean; center: number[]; err?: string }
    __ready: boolean
  }
}

;(async () => {
  try {
    const ck = await CanvasKitInit({ locateFile: () => wasmUrl })
    const surface = ck.MakeSurface(64, 64)!
    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    const paint = new ck.Paint()
    paint.setAntiAlias(true)
    paint.setColor(ck.Color4f(1, 0, 0, 1))
    canvas.drawCircle(32, 32, 20, paint)
    surface.flush()
    const info = {
      width: 1, height: 1,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    }
    const has = (o: any, k: string) => typeof o?.[k] === 'function'
    const probe = {
      surface_readPixels: has(surface, 'readPixels'),
      canvas_readPixels: has(canvas, 'readPixels'),
      surface_makeImageSnapshot: has(surface, 'makeImageSnapshot'),
    }
    let px: Uint8Array | null = null
    if (has(canvas, 'readPixels')) px = (canvas as any).readPixels(32, 32, info) as Uint8Array
    else if (has(surface, 'readPixels')) px = (surface as any).readPixels(32, 32, info) as Uint8Array
    else {
      const img: any = surface.makeImageSnapshot()
      px = img.readPixels(0, 0, info) ? img.readPixels(32, 32, info) : null
    }
    const arr = px ? Array.from(px) : []
    window.__ckResult = { ok: !!px && arr[0] > 200 && arr[1] < 60 && arr[2] < 60, center: arr, err: JSON.stringify(probe) }
    paint.delete(); surface.delete()
  } catch (e: any) {
    window.__ckResult = { ok: false, center: [], err: String(e?.message ?? e) }
  }
  window.__ready = true
})()
