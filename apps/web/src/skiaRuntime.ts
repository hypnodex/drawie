// Skia render path — opt-in, lazily loaded. Default users render via Canvas2D and
// never download CanvasKit. Enable with `?skia=1` (or localStorage drawie.skia=1);
// `?skia=0` force-disables. The 7 MB CanvasKit WASM + its JS load only when enabled:
// the JS is a dynamic import() (its own chunk) and the .wasm is referenced as a URL
// (so it's emitted as an asset but fetched only when CanvasKitInit runs).
import type { CanvasKit } from 'canvaskit-wasm'
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url'

export function isSkiaEnabled(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('skia')
    if (q === '1') return true
    if (q === '0') return false
    return localStorage.getItem('drawie.skia') === '1'
  } catch {
    return false
  }
}

let ckPromise: Promise<CanvasKit> | null = null
export function loadCanvasKit(): Promise<CanvasKit> {
  if (!ckPromise) {
    ckPromise = import('canvaskit-wasm').then(({ default: CanvasKitInit }) =>
      CanvasKitInit({ locateFile: () => wasmUrl }),
    )
  }
  return ckPromise
}
