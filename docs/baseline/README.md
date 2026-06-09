# Phase 0 — Parity baseline

This folder is the **parity reference for the whole migration** (per
`drawie2-native-core-plan.md` Phase 0, step 5). Every later phase must keep tool output
matching this baseline:

- **Phase 2** — the new `StrokeEngine` + `Canvas2DBackend` must reproduce baseline output on web.
- **Phase 4** — `SkiaBackend` (CanvasKit) on web must match baseline within tolerance.
- **Phase 6** — native Skia must match web Skia within tolerance (golden-image CI).

## What "baseline" means here

A baseline = **deterministic inputs** + **rendered output of those inputs**.

- **Deterministic inputs** are pinned in [`stroke-corpus.json`](./stroke-corpus.json): for each
  tool/variant, the exact pointer path, pressure profile, and tool settings. These are the
  literal inputs to replay when capturing references and when writing golden tests later.
- **Rendered output** = the artboard PNG produced by replaying each corpus case through the
  engine. These go in [`captures/`](./captures/).

✅ **As of Phase 2 the captures are fully deterministic.** The seeded PRNG (`mulberry32`) is now
threaded through every stochastic site (`pencil`, `spray`, `drybrush`, `inkbrush`, and the
procedural `texture`s), and the harness pins a fixed seed, so replaying the corpus produces the
**same pixels every run** — captures are reproducible, pixel-comparable targets for all tools.
(Before Phase 2 those tools called unseeded `Math.random()`; the original Phase 0 capture pass
also left ~10 cases blank. Both are fixed — see *Phase 2 re-capture* below.)

## Capture status

| Artifact | Status |
|---|---|
| Deterministic input corpus (`stroke-corpus.json`) | ✅ authored in Phase 0 |
| Deployment snapshot (`DEPLOYMENT_SNAPSHOT.md`) | ✅ recorded |
| Git/zip/folder backups | ✅ created (see DEPLOYMENT_SNAPSHOT) |
| Rendered visual captures (`captures/*.png`) | ✅ **23/23 captured** (deterministic; re-captured in Phase 2) |

## Parity harness (`tools/baseline-capture/`)

All headless via Playwright + a Vite dev server; replay logic lives in `replay.ts`.

| Script | Purpose |
|---|---|
| `run.mjs` | Capture/refresh `captures/*.png` by replaying the corpus through the current engine. |
| `compare.mjs` | **Regression guard.** Replay the corpus and diff each case vs its stored capture. Deterministic tools asserted to a tight pixel tolerance; stochastic tools to ink-coverage proximity. Writes `PARITY.json`. |
| `oldnew.mjs` | **Faithfulness proof.** Renders every case with BOTH the pre-migration engine (`_old/engine.ts`, restored from git) and the refactored engine, and diffs them directly — independent of the stored PNGs. |
| `modelcheck.mjs` | **Phase 3 model round-trip.** Renders each main stroke by driving the engine directly vs. by capturing it into a retained `ModelStroke` and `replayStroke`-ing it; asserts they're identical (incl. watercolor dwell ticks). 23/23 at meanAbs 0.0000. |
| `smoke-draw.mjs` | **Phase 3 interactive smoke test.** Drives a real pointer stroke on the live `/draw` editor, then undo + redo, asserting layer ink moves correctly (draw → commit → re-render → undo/redo). |
| `ck-smoke.mjs` | **Phase 4 de-risk.** Loads CanvasKit (WASM) headlessly, draws + reads back a pixel. (Confirmed `readPixels` is on `Canvas`, not `Surface`, in 0.41.1.) |
| `skia-golden.mjs` | **Phase 4 Skia golden.** Renders the corpus through the StrokeEngine→SkiaBackend (CanvasKit) and diffs vs baseline. Writes `PARITY-SKIA.json`. |
| `smoke-draw-skia.mjs` | **Phase 4 Skia app smoke.** Drives `/draw?skia=1` (waits for CanvasKit), draw → undo → redo — proves the live editor renders through Skia. |
| `diag.mjs` | Root-cause helper: reports the diff bbox / worst pixel / magnitude histogram for a case. |

```bash
node tools/baseline-capture/oldnew.mjs    # prove the refactor didn't change tool output
node tools/baseline-capture/compare.mjs   # guard against drift vs the captured reference
node tools/baseline-capture/run.mjs       # (re)capture references
```

## Phase 2 parity result + re-capture

The `ctx → RendererBackend` decoupling was verified two ways:

1. **`oldnew.mjs` (old engine vs new engine, direct):** all **deterministic** tools — `pen`,
   `brush`, `marker`, `watercolor`, **`eraser`, `smudge`, `waterdrop`** — are **bit-identical**
   (meanAbs 0.0000, maxAbs 0). The only differences are the **stochastic** tools, ≤0.91/255 mean,
   which is the intended `Math.random()` → seeded-`mulberry32` change. The refactor is faithful.
2. **`compare.mjs` (engine vs captured reference):** 23/23 pass at meanAbs 0.000 — the engine is
   deterministic and reproduces the captures exactly.

**Re-capture:** the original Phase 0 `captures/` were unreliable as a reference — ~10 were
identical blank PNGs (a broken capture pass) and the stochastic ones were non-reproducible
(`Math.random()`). Having proven equivalence via `oldnew.mjs`, the captures were regenerated with
the now-deterministic engine (fixed seed), so `captures/` is a clean, reproducible reference for
Phase 4 (Skia) and Phase 6 (golden-image CI). `MANIFEST.json` records the engine commit.

## Behavioral baseline (must still work identically after every phase)

Beyond per-tool marks, record that these behaviors are unchanged vs. this commit:

- **Undo / redo** — per-layer; up to 10 deep (currently `ImageData` snapshots → becomes model-level in Phase 3).
- **Layers** — add / remove / merge-down / toggle visibility; **max 3** (`MAX_LAYERS`).
- **Zoom / pan** — Fit, +/−, Ctrl/Cmd+wheel zoom toward cursor; fit-on-first-measure.
- **Draft save + restore** — `Save` persists layers as WebP data URLs to localStorage and restores on reopen.
- **Submit** — composites visible layers → **PNG** → uploads to Supabase Storage (`CanvasDrawScreen`). The PNG contract must survive Phase 3's model migration.
- **Tool/palette restriction** — a canvas with `allowedTools` / `colorPalette` restricts the toolbar + color picker.
- **Shape assist** (off by default) — when enabled, end-of-stroke snapping to line/circle/etc. via `shapes.ts`.

## Phase 4 Skia parity result

`SkiaBackend` (CanvasKit/WASM) implements the same `RendererBackend` as `Canvas2DBackend`;
`skia-golden.mjs` renders the corpus through it and diffs vs the (Canvas2D) baseline. Same
engine + seeds, so any difference is purely Skia-vs-Canvas2D rasterisation:

- **Deterministic tools: avg meanAbs 0.24/255 (0.09%), worst 1.5/255 (smudge soft-mask edge).**
- **waterdrop: 0.03/255 — essentially identical** (its per-pixel displacement/blur is portable
  TS on a `PixelRegion`, so only the soft dest-in mask edge differs).
- pen/brush/marker/watercolor/spray/pencil all ≤ ~0.25/255.
- Largest gaps are eraser/smudge (~1.2–1.5, ≤4% of pixels at >16) — soft destination-out/in
  mask antialiasing. Within tolerance; tunable later. **No SkSL was needed** — the readback path
  keeps the effects faithful. SkSL re-expression of waterdrop/smudge remains a perf optimisation.

Done in Phase 4: `SkiaBackend` + headless golden proof that all 11 tools render via Skia within
tolerance, **and** `apps/web` wired to render via Skia behind a flag — **`/draw?skia=1`** (or
`localStorage drawie.skia=1`). CanvasKit loads lazily (code-split JS chunk + the 7 MB wasm fetched
only when enabled — default users stay on Canvas2D and download neither). Each layer binds a Skia
software surface (`MakeSWCanvasSurface`) that flushes to its `<canvas>`. Verified end-to-end by
`smoke-draw-skia.mjs` (draw → undo → redo through Skia). Remaining: make Skia the default (a go/no-go
once perf is profiled), optional SkSL re-expression (perf), eraser/smudge edge tuning, and legacy
raster-draft backgrounds in Skia mode.

## Files

- `stroke-corpus.json` — deterministic input corpus (tools × paths × pressure × settings).
- `DEPLOYMENT_SNAPSHOT.md` — live URLs, refs, backup locations (no secrets).
- `captures/` — rendered reference PNGs (23/23, deterministic) + `MANIFEST.json`.
- `PARITY.json` — latest `compare.mjs` (Canvas2D) metrics · `PARITY-SKIA.json` — `skia-golden.mjs` (Skia) metrics.
