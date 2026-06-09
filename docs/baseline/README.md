# Phase 0 — Parity baseline

This folder is the **parity reference for the whole migration** (per
`drawie2-native-core-plan.md` Phase 0, step 5). Every later phase must keep tool output
matching this baseline:

- **Phase 2** — the new `StrokeEngine` + `Canvas2DBackend` must reproduce baseline output on web.
- **Phase 4** — `SkiaBackend` (CanvasKit) on web must match baseline within tolerance.
- **Phase 6** — native Skia must match web Skia within tolerance (golden-image CI).

## What "baseline" means here (and an important caveat)

A baseline = **deterministic inputs** + **rendered output of those inputs**.

- **Deterministic inputs** are pinned in [`stroke-corpus.json`](./stroke-corpus.json): for each
  tool/variant, the exact pointer path, pressure profile, and tool settings. These are the
  literal inputs to replay when capturing references and when writing golden tests later.
- **Rendered output** = the artboard PNG produced by replaying each corpus case through the
  *current* (pre-migration) Canvas-2D engine. These go in [`captures/`](./captures/).

⚠️ **Caveat — the current engine is not fully deterministic.** Per the audit (`CURRENT_STATE.md`
§8.5), `pencil`, `spray`, `drybrush`, `inkbrush`, and the procedural `texture`s call
**unseeded `Math.random()`**. So those tools produce a *different* mark every run — their
captures are **perceptual references** (shape, density, coverage, alpha feel), not
pixel-exact targets. Bit-/tolerance-exact golden comparison only becomes meaningful **after
Phase 2 threads the seeded PRNG** through those sites. Plan accordingly:
- Deterministic tools (`brush` w/o texture, `pen`, `marker`, `watercolor`, `eraser`, `waterdrop`
  geometry, `smudge` geometry): captures are reproducible targets.
- Stochastic tools: captures are perceptual; lock them to a seed in Phase 2, then re-baseline.

## Capture status

| Artifact | Status |
|---|---|
| Deterministic input corpus (`stroke-corpus.json`) | ✅ authored in Phase 0 |
| Deployment snapshot (`DEPLOYMENT_SNAPSHOT.md`) | ✅ recorded |
| Git/zip/folder backups | ✅ created (see DEPLOYMENT_SNAPSHOT) |
| Rendered visual captures (`captures/*.png`) | ⛔ **pending a run** — requires the dev server + replaying the corpus (see below). Not produced by the autonomous Phase 0 backup pass. |

The rendered captures are the one Phase 0 item that needs the app running. Two ways to produce them:

### Option A — automated (recommended; becomes the Phase 6 harness seed)
A small headless-browser script (e.g. Playwright) that loads `/draw`, and for each corpus case
dispatches `PointerEvent`s with the corpus `pressure` values, then reads back the composited
artboard (`CanvasHandle.getCompositeCanvas().toDataURL()` is already exposed) and writes
`captures/<caseId>.png`. This is the same replay mechanism the golden-image CI (Phase 6) needs,
so building it here is reusable — but it adds a dev dependency and is therefore deferred to a
deliberate step rather than slipped into the backup pass.

### Option B — manual
```bash
cd apps/web   # (pre-Phase-1: repo root)
npm run dev
# open http://localhost:5173/draw
```
For each case in `stroke-corpus.json`: select the tool, apply the listed setting overrides,
draw the described path at the described pressure (use a stylus for pressure-bearing cases;
mouse falls back to speed-simulated pressure — note that in the filename), then screenshot the
artboard and save as `captures/<caseId>.png`.

## Behavioral baseline (must still work identically after every phase)

Beyond per-tool marks, record that these behaviors are unchanged vs. this commit:

- **Undo / redo** — per-layer; up to 10 deep (currently `ImageData` snapshots → becomes model-level in Phase 3).
- **Layers** — add / remove / merge-down / toggle visibility; **max 3** (`MAX_LAYERS`).
- **Zoom / pan** — Fit, +/−, Ctrl/Cmd+wheel zoom toward cursor; fit-on-first-measure.
- **Draft save + restore** — `Save` persists layers as WebP data URLs to localStorage and restores on reopen.
- **Submit** — composites visible layers → **PNG** → uploads to Supabase Storage (`CanvasDrawScreen`). The PNG contract must survive Phase 3's model migration.
- **Tool/palette restriction** — a canvas with `allowedTools` / `colorPalette` restricts the toolbar + color picker.
- **Shape assist** (off by default) — when enabled, end-of-stroke snapping to line/circle/etc. via `shapes.ts`.

## Files

- `stroke-corpus.json` — deterministic input corpus (tools × paths × pressure × settings).
- `DEPLOYMENT_SNAPSHOT.md` — live URLs, refs, backup locations (no secrets).
- `captures/` — rendered reference PNGs (to be populated; see status above).
