# Drawie2 — Current State Audit

> Read-only audit of the drawing subsystem as it exists today, written to ground a
> future "shared Skia renderer (web + iPad)" migration in reality. Every claim below is
> traced to a real file/line. Where the code was ambiguous, it is called out under
> **§9 Open questions** rather than guessed.
>
> Scope note: Drawie2 is a larger collaborative-mosaic product (auth, Supabase backend,
> discovery, private canvases, moderation). This document covers **only the drawing /
> canvas / rendering subsystem**, which is the relevant part for a renderer migration.
> The surrounding product code is summarized only where it touches drawing.

---

## 1. Stack and tooling

| Concern | Reality |
|---|---|
| Framework | **React 19** SPA (`react` / `react-dom` `^19.0.0`). **Not Next.js.** |
| Build tool | **Vite 5** (`vite ^5.4.0`), `@vitejs/plugin-react`. See [vite.config.ts](../vite.config.ts). |
| Language | **TypeScript 5.6**, `strict: true`. Config split across [tsconfig.app.json](../tsconfig.app.json) (app) + [tsconfig.node.json](../tsconfig.node.json). Target `ES2022`, `moduleResolution: bundler`, JSX `react-jsx`. |
| Package manager | **npm** (`package-lock.json` present; no pnpm/yarn lockfile). |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite`, plus **HeroUI v3** (`@heroui/react`) component library. |
| Router | `react-router-dom` ^6.28. |
| Backend | `@supabase/supabase-js` ^2.107 (Postgres + Auth + Realtime + Storage + Edge Functions). |
| On-device ML | `@tensorflow/tfjs`, `nsfwjs`, `tesseract.js` — used only by content moderation, **not drawing**. |

**Scripts** ([package.json](../package.json)):
- `dev` → `vite`
- `build` → `tsc -b && vite build`
- `preview` → `vite preview`
- `typecheck` → `tsc -b --noEmit`

**Deploy:** Vercel SPA. [vercel.json](../vercel.json) rewrites all routes to `/index.html`.
`dist/` is a built static bundle. Deployment runbook lives in [DEPLOY.md](../DEPLOY.md);
production is `drawie-xi.vercel.app` fronting a Supabase Cloud project.

**Monorepo:** none. This is a single flat Vite app. (Note: a *sibling* `Drawie` v1 project
exists one directory up, but Drawie2 is self-contained and does not reference it.)

**Key drawing-relevant dependencies:** there are **none beyond the platform**. All drawing
is hand-written against the browser **Canvas 2D API** and **Pointer Events**. No canvas/
graphics library (no Konva, Fabric, PixiJS, Three.js, p5, WebGL/WebGPU wrapper, Skia/
CanvasKit/WASM). Confirmed by repo-wide search — zero matches for any of those terms in `src/`.

**Tests:** none. No Vitest/Jest/Testing-Library in `package.json`; no `*.test.*` / `*.spec.*` files.

---

## 2. Repo structure

Annotated tree (drawing-relevant paths emphasized):

```
Drawie2/
├─ index.html                 # Vite entry; mounts #root
├─ vite.config.ts             # react + tailwind plugins only
├─ vercel.json                # SPA rewrite to index.html
├─ supabase/                  # migrations, seed, Edge Functions (moderate, composite-mosaic)
├─ src/
│  ├─ main.tsx                # React root
│  ├─ App.tsx                 # Routes (see §6 for the two draw routes)
│  ├─ session.ts              # localStorage draft persistence (WebP/PNG dataURLs)  ★persistence
│  ├─ types.ts                # ToolId, ToolSettings, StrokePoint, Layer, AssistSettings  ★drawing types
│  ├─ types/
│  │  ├─ domain.ts            # Product domain (Canvas/Tile/User); CanvasConfig.allowedTools/colorPalette
│  │  └─ database.ts          # Supabase generated types
│  │
│  ├─ drawing/                # ★★ CORE DRAWING LOGIC ★★
│  │  ├─ engine.ts            # StrokeEngine — all per-tool stamping (972 lines). The heart.
│  │  ├─ shapes.ts            # QuickShape-like shape detection + path replay (pure math)
│  │  ├─ textures.ts          # Procedural grain textures (alpha-mask canvases)
│  │  └─ mockTiles.ts         # Procedural neighbour/mosaic artwork (not user drawing)
│  │
│  ├─ components/
│  │  ├─ Canvas.tsx           # ★ The React canvas host: layer <canvas> stack, pointer
│  │  │                       #   capture, zoom/scroll, shape-assist orchestration, rAF tick
│  │  └─ editor/
│  │     ├─ BottomToolbar.tsx # Tool picker + undo/redo/clear/reveal
│  │     ├─ ToolSettings.tsx  # Per-tool settings panel (sliders/toggles) + TOOL_META table
│  │     ├─ ColorPicker.tsx   # Color UI
│  │     ├─ Layers.tsx        # Layer list panel (max 3)
│  │     ├─ ExportDialog.tsx  # Export UI (MOCK — see §9)
│  │     └─ MosaicReveal.tsx  # Composites tiles into a mosaic preview
│  │
│  ├─ hooks/
│  │  └─ useHistory.ts        # ★ Per-layer ImageData undo/redo stacks
│  │
│  ├─ screens/
│  │  ├─ DrawingScreen.tsx    # ★ Top-level editor: owns tool/settings/layers state, save/submit
│  │  └─ CanvasDrawScreen.tsx # Router wrapper: loads canvas+tile, uploads artwork on submit
│  │
│  └─ services/ state/ lib/ mock/   # product plumbing (Supabase, auth, moderation) — non-drawing
└─ docs/
   └─ CURRENT_STATE.md        # this file
```

**Where drawing lives, precisely:** the framework-agnostic-*ish* engine is
[src/drawing/engine.ts](../src/drawing/engine.ts) (+ `shapes.ts`, `textures.ts`). The
web/React binding is [src/components/Canvas.tsx](../src/components/Canvas.tsx). The editor
shell/state is [src/screens/DrawingScreen.tsx](../src/screens/DrawingScreen.tsx). Undo is
[src/hooks/useHistory.ts](../src/hooks/useHistory.ts). Draft persistence is
[src/session.ts](../src/session.ts).

---

## 3. Rendering

### Technique: **Canvas 2D, immediate-mode, distance-based stamping**

- **Only `getContext('2d')` is ever used.** No WebGL/WebGPU/SVG drawing surface.
  ([Canvas.tsx:129](../src/components/Canvas.tsx#L129) requests
  `{ willReadFrequently: true }` because the engine reads pixels back constantly.)
- The artboard is a **stack of one `<canvas>` per layer**, absolutely positioned and
  overlaid, drawn bottom-first ([Canvas.tsx:527-549](../src/components/Canvas.tsx#L527-L549)).
  Each layer canvas has a fixed **internal resolution of `INTERNAL_SIZE = 2000`** px square
  ([Canvas.tsx:77](../src/components/Canvas.tsx#L77)); CSS scales it to a 1200 px artboard
  and `transform: scale(zoom)` handles zoom. So compositing of layers is **the browser's
  own painting of stacked DOM canvases**, not a manual composite (except when exporting —
  see `getCompositeCanvas`).

### Draw cycle: there is **no retained render loop**

This is important: strokes are painted **synchronously inside pointer event handlers**,
directly onto the active layer's 2D context. There is no scene graph, no per-frame redraw,
no diffing. Pixels, once stamped, are owned by the canvas.

- `onPointerDown` ([Canvas.tsx:277](../src/components/Canvas.tsx#L277)) creates a
  `new StrokeEngine(ctx, tool, settings, assist)` bound to the active layer's context,
  clips to the canvas rect, and calls `engine.begin(point)`.
- `onPointerMove` ([Canvas.tsx:322](../src/components/Canvas.tsx#L322)) calls
  `engine.extend(point)` for every coalesced pointer sample.
- `finishStroke` ([Canvas.tsx:345](../src/components/Canvas.tsx#L345)) calls `engine.end()`.

`StrokeEngine.extend` ([engine.ts:92](../src/drawing/engine.ts#L92)) does the real work:
it low-pass smooths the raw input (EMA), then walks the gap from the last point in
**fixed spacing steps** (`spacing = dia * spacingFactor(tool)`,
[engine.ts:131](../src/drawing/engine.ts#L131)) calling `stamp()` at each interpolated
position. Each `stamp()` ([engine.ts:241](../src/drawing/engine.ts#L241)) dispatches to a
per-tool method that draws onto `this.ctx`.

### The one rAF loop is **not** a render loop

`tickLoop` ([Canvas.tsx:178](../src/components/Canvas.tsx#L178)) runs only while a stroke
is active and exists for two side-effects: (1) firing **hold-to-snap** shape assist after a
dwell, and (2) calling `engine.tick(now)` so the **watercolor pool** can keep depositing
pigment while the pointer is held still ([engine.ts:191](../src/drawing/engine.ts#L191)).
Every other tool ignores `tick`.

### Blend modes (`globalCompositeOperation`) in use

| Mode | Where | Purpose |
|---|---|---|
| `source-over` (default) | most stamps | normal paint |
| `multiply` | Marker ([engine.ts:464,466](../src/drawing/engine.ts#L464)) | darkening semi-transparent overlay |
| `destination-out` | Eraser ([engine.ts:551](../src/drawing/engine.ts#L551)) | soft-edge erase |
| `destination-in` | Texture masking ([textures.ts:101](../src/drawing/textures.ts#L101)), Smudge soft mask ([engine.ts:583](../src/drawing/engine.ts#L583)), Waterdrop mask ([engine.ts:896](../src/drawing/engine.ts#L896)) | clip a stamp by an alpha mask |

### Pixel readback (`getImageData`/`putImageData`) — heavily used

This is the single biggest renderer-portability concern. CPU pixel readback drives several
core effects:

- **`sampleDest`** ([engine.ts:282](../src/drawing/engine.ts#L282)) — reads a 1×1 pixel
  under each stamp to support **blending (wet-on-wet)** and **build-up** colour decisions
  (`resolveStamp`, [engine.ts:313](../src/drawing/engine.ts#L313)). This runs **per stamp**.
- **`applyBuildUp`** ([engine.ts:630](../src/drawing/engine.ts#L630)) — a per-pixel
  darkening post-pass: `getImageData` → multiply each RGB channel by `(1-dk)` → `putImageData`.
  *(Defined but note: the active build-up path is actually the per-stamp `resolveStamp`
  branch at [engine.ts:328](../src/drawing/engine.ts#L328); `applyBuildUp` is not called by
  any stamp method in the current engine — see §9.)*
- **Smudge** (`captureSmudgeBuffer` [engine.ts:596](../src/drawing/engine.ts#L596)) —
  `getImageData` a patch, re-stamp it offset via a temp canvas + `putImageData`.
- **Waterdrop** (`stampWaterdrop` [engine.ts:777](../src/drawing/engine.ts#L777)) — reads a
  circular patch, runs a per-pixel displacement + turbulence + bilinear resample, box-blurs,
  and writes back. Entirely CPU.

### Offscreen / temp canvases

Several effects allocate scratch `document.createElement('canvas')` surfaces:
- `tempStamp` reused for **textured stamps** ([engine.ts:480](../src/drawing/engine.ts#L480)).
- Per-call temp canvases in **smudge** ([engine.ts:578](../src/drawing/engine.ts#L578)) and
  **waterdrop** ([engine.ts:891](../src/drawing/engine.ts#L891)) to hold the masked result.
- `getCompositeCanvas` ([Canvas.tsx:404](../src/components/Canvas.tsx#L404)) flattens visible
  layers into one canvas for export/coverage/moderation.

No `OffscreenCanvas`, no Web Workers for drawing — everything is on the main thread.

### Shaders

None. There is a software **value-noise** function (`smoothNoise`,
[engine.ts:927](../src/drawing/engine.ts#L927)) used by waterdrop and the bristle brushes —
that is the closest thing to procedural-texture math, but it runs in JS per-pixel/per-stamp.

---

## 4. Document / state model

### Strokes are **rasterized, not vector**

There is **no persistent vector stroke model anywhere.** A stroke is applied immediately to
the active layer's 2D bitmap and then forgotten. The document *is* the pixels.

- The only point arrays that exist are **transient, per-stroke**:
  - `StrokeEngine.rawPoints: InputPoint[]` ([engine.ts:54](../src/drawing/engine.ts#L54)) —
    captured during the stroke purely so **shape-assist** can analyze and replay it; discarded
    on `end()`.
  - `StrokePoint` ([types.ts:38](../src/types.ts#L38)) is the interpolated stamp position used
    internally during a single stroke.
- After the stroke, none of this is retained. Undo and persistence both operate on **bitmaps**.

### Per-point data captured

`InputPoint` ([engine.ts:10-16](../src/drawing/engine.ts#L10-L16)): `{ x, y, pressure,
hasPressure, t }`.

- `x, y` — canvas-space (internal 2000px) coordinates.
- `pressure` — `PointerEvent.pressure` (0..1), captured at
  [Canvas.tsx:313](../src/components/Canvas.tsx#L313) / [:337](../src/components/Canvas.tsx#L337).
- `hasPressure` — true only for non-mouse pointers with `pressure > 0`.
- `t` — `performance.now()` timestamp (ms), used for speed/dwell.
- **NOT captured:** tilt (`tiltX/tiltY`), azimuth/altitude, barrel rotation, velocity vector
  (speed is derived on the fly, not stored). Confirmed by repo search: no `tiltX`/`tiltY`/
  `azimuth`/`altitude` references exist.

### Layers

`Layer` ([types.ts:45](../src/types.ts#L45)) = `{ id, name, visible }` — pure metadata; the
pixels live in the DOM `<canvas>` keyed by `layer.id` in `Canvas.tsx`'s
`layerCanvasRefs` map. **`MAX_LAYERS = 3`** ([types.ts:51](../src/types.ts#L51)). Layer ops
(add/remove/merge-down/toggle) are in
[DrawingScreen.tsx:167-202](../src/screens/DrawingScreen.tsx#L167-L202); merge-down is just
`dstCtx.drawImage(srcCanvas)` ([Canvas.tsx:397-403](../src/components/Canvas.tsx#L397-L403)).

### Undo / redo

[useHistory.ts](../src/hooks/useHistory.ts): **per-layer stacks of full-layer `ImageData`
snapshots** (`past[]` / `future[]`), capped (`useHistory(10)` in DrawingScreen, so 10 deep).
- A snapshot of the active layer is pushed on **stroke start** (`onStrokeStart={snapshot}`,
  [DrawingScreen.tsx:389](../src/screens/DrawingScreen.tsx#L389)) and on **clear**.
- Undo/redo restore by `putImageData` ([Canvas.tsx:384-390](../src/components/Canvas.tsx#L384-L390)).
- Cost: each entry is a full 2000×2000×4 ≈ **16 MB** `ImageData`. 10 entries × N layers is a
  significant memory footprint (see §8).

### Persistence / serialization

[session.ts](../src/session.ts) — **localStorage drafts only**. `SavedSession`
([session.ts:21](../src/session.ts#L21)) stores: each layer as a **WebP data URL**
(`canvas.toDataURL('image/webp', 0.85)`, [Canvas.tsx:419](../src/components/Canvas.tsx#L419)),
plus `activeLayerId`, `tool`, the full `settingsMap`, `secondaryColor`, `recentColors`,
`assist`, `theme`, timer, `savedAt`. Restored on mount by drawing each dataURL back into its
layer canvas ([DrawingScreen.tsx:107-123](../src/screens/DrawingScreen.tsx#L107-L123)).
Key is per-tile (`drawie.session.<canvasId>.<tileId>.v1`,
[CanvasDrawScreen.tsx:53](../src/screens/CanvasDrawScreen.tsx#L53)) or the legacy default.

On **submit**, the flattened composite is encoded to a **PNG blob**
(`composite.toBlob(..., 'image/png')`, [DrawingScreen.tsx:284](../src/screens/DrawingScreen.tsx#L284))
and uploaded to Supabase Storage ([CanvasDrawScreen.tsx:61-68](../src/screens/CanvasDrawScreen.tsx#L61-L68)).

**There is no vector/replayable save format.** The saved artifact is always a raster image
(WebP draft, PNG submission). A different renderer could *display* these images but could not
re-derive strokes, layers-as-geometry, or re-run brush dynamics from them.

### State management

Plain **React `useState` + `useRef`**, no Zustand/Redux/Jotai.
- [DrawingScreen.tsx](../src/screens/DrawingScreen.tsx) owns editor state: `tool`,
  `settingsMap` (a `Record<ToolId, ToolSettings>`), `recentColors`, `layers`, `activeLayerId`,
  zoom display, coverage, modals.
- The mutable drawing state (engine instance, pointer id, rAF handle, pre-stroke snapshot)
  lives in **refs** inside `Canvas.tsx` to stay stable across renders.
- `Canvas` exposes an imperative `CanvasHandle` via `useImperativeHandle`
  ([Canvas.tsx:378](../src/components/Canvas.tsx#L378)) (snapshot/restore/clear/merge/
  composite/dataURL/zoom) — this is the seam between React state and the bitmap canvases.

---

## 5. Tools / brushes

Full tool list (`ToolId`, [types.ts:1-12](../src/types.ts#L1-L12)), 11 tools:
`brush, drybrush, inkbrush, pencil, pen, marker, watercolor, spray, eraser, smudge, waterdrop`.

Shared per-tool `ToolSettings` ([types.ts:19-34](../src/types.ts#L19-L34)): `color, size,
opacity, softness, strength, hardness, shape (circle|square), texture
(none|canvas|grain|noise|speckle), blending, dilution, persistence, buildUp, pressureSim,
wetPaint`. Which settings each tool surfaces is declared in `TOOL_META`
([ToolSettings.tsx:34-46](../src/components/editor/ToolSettings.tsx#L34-L46)). Defaults per
tool in `DEFAULT_SETTINGS` ([DrawingScreen.tsx:44-56](../src/screens/DrawingScreen.tsx#L44-L56)).

Shared pipeline for every tool (the **framework-independent** part): EMA input smoothing →
distance-stepped interpolation → per-stamp pressure derivation (`derivePressure`,
[engine.ts:228](../src/drawing/engine.ts#L228); falls back to **speed→pressure simulation**
for mouse) → `brushDiameter` (pressure scales size) → `spacingFactor` per tool. All of that
is pure arithmetic. The **renderer-dependent** part is what each `stamp*` method does to `ctx`.

Below, each tool's **logic (portable math)** vs **render (Canvas-2D-specific)** is marked.

### brush — `stampBrush` [engine.ts:444](../src/drawing/engine.ts#L444)
- **Logic:** alpha from opacity×pressure; `wetPaint` widens radius ×1.25 and lowers base
  alpha; `applyDilution` drains "ink" over the stroke; `resolveStamp` decides colour
  (blend/build-up).
- **Render:** `fillShape` ([engine.ts:368](../src/drawing/engine.ts#L368)) draws a radial-
  gradient soft disc (or `fillRect` for square shape); if a texture is set, routes through
  `stampTextured` (offscreen canvas + `createPattern` + `destination-in` mask).

### marker — `stampMarker` [engine.ts:459](../src/drawing/engine.ts#L459)
- **Logic:** low per-stamp alpha (0.13×).
- **Render:** same `fillShape`/`stampTextured` but composited with **`multiply`** so overlaps
  darken.

### pencil — `stampPencil` [engine.ts:422](../src/drawing/engine.ts#L422)
- **Logic:** 4 jittered micro-dots per stamp, random radius/alpha → grainy feel. Uses
  `Math.random()` (unseeded).
- **Render:** plain `ctx.arc` + `fill` per dot.

### pen — `stampPen` [engine.ts:399](../src/drawing/engine.ts#L399)
- **Logic:** crisp; alpha from opacity×pressure.
- **Render:** filled `arc` at the point **plus a connecting `stroke()` line** from the
  previous stamp (segment-based, for clean continuous lines). Relies on `lineCap/lineJoin='round'`.

### watercolor — `stampWatercolor` [engine.ts:503](../src/drawing/engine.ts#L503) + `tick`/pool
- **Logic:** wet, low alpha, wide radius (×1.25); **dwell pooling** — `tick()`
  ([engine.ts:191](../src/drawing/engine.ts#L191)) grows a pool when the pointer is stationary
  (>90 ms), depositing repeated low-alpha stamps at the dwell anchor
  (`stampWatercolorPool`, [engine.ts:513](../src/drawing/engine.ts#L513)). Uses blending +
  build-up via `resolveStamp`.
- **Render:** `fillShape` radial gradient. The pooling cadence depends on the host calling
  `tick` from the rAF loop (a coupling between Canvas.tsx and the engine).

### drybrush / inkbrush — `stampBristle` [engine.ts:721](../src/drawing/engine.ts#L721)
- **Logic (substantial, mostly portable):** at stroke start, `generateBristles`
  ([engine.ts:690](../src/drawing/engine.ts#L690)) creates a fixed set of bristles (16 dry /
  30 ink) with stable perpendicular offsets, widths, dryness, seeds. Per stamp, bristles are
  laid across the axis perpendicular to travel direction; a `smoothNoise` lookup indexed by
  **travelled distance** drives a continuous flicker so streaks stay coherent, and a
  `skip` threshold (scaled by the "Dryness"=`strength` slider, higher at edges) lifts
  bristles → ragged broken coverage.
- **Render:** one small `ctx.arc`+`fill` per surviving bristle.

### spray — `stampSpray` [engine.ts:523](../src/drawing/engine.ts#L523)
- **Logic:** **particle scatter.** `particleCount = floor(density·r·0.7)` where
  `density = settings.strength`. Each particle: random angle, radius `pow(random,0.7)·r`
  (sqrt-ish for even areal spread, biased inward), random sub-pixel radius 0.4–2.0, random
  alpha. All `Math.random()` (unseeded).
- **Render:** `ctx.arc`+`fill` per particle. Pure stamping — **the most renderer-agnostic of
  the "interesting" tools**; the only Canvas-specific bit is the arc fill itself.

### eraser — `stampEraser` [engine.ts:547](../src/drawing/engine.ts#L547)
- **Logic:** soft radial falloff controlled by `softness`.
- **Render:** `globalCompositeOperation='destination-out'` with a radial-gradient fill.

### smudge — `stampSmudge` [engine.ts:562](../src/drawing/engine.ts#L562)
- **Logic:** carries colour by **picking up pixels** at the previous position and re-laying
  them at the current position with reduced alpha (`strength·0.8`); re-captures forward each
  step.
- **Render (Canvas-2D-bound):** `getImageData` to capture a patch → temp canvas
  `putImageData` → `destination-in` radial soft mask → `drawImage` onto main. **Pixel-readback
  dependent.**

### waterdrop — `stampWaterdrop` [engine.ts:777](../src/drawing/engine.ts#L777) — **the hard one**
(`color: 'transparent'` = water-only displacement; a real colour adds an ink tint.)
- **Logic (rich, but written around raw pixel buffers):**
  1. Read circular patch via `getImageData` (radius enlarged to ~1.38r).
  2. For each pixel inside an **irregular noise-perturbed boundary** (`effectiveR =
     r·(0.65 + noise·0.70)` → 0.65r…1.35r lobes):
     - compute outward **displacement** `maxPush·falloff·magnMod` where `falloff = 1 - t²`,
     - apply **angular turbulence** (rotate push dir by ±60° from a noise channel) and
       **magnitude turbulence** (0.35×…1.65× from another channel),
     - **bilinearly sample** the source buffer at the back-projected position (pushes colour
       outward).
  3. **Box-blur** the displaced result inside the circle (`boxBlurInCircle`,
     [engine.ts:943](../src/drawing/engine.ts#L943)) for colour bleeding.
  4. Composite via temp canvas + `destination-in` soft radial mask; optionally overlay a
     radial **ink tint** gradient.
- The displacement/turbulence/noise/bilinear math is conceptually portable, but it is
  **expressed entirely as direct `Uint8ClampedArray` manipulation on a CPU-read pixel patch**,
  which is exactly the pattern that does not translate to a GPU/Skia renderer without a
  rewrite (it would become a fragment shader / runtime effect / displacement image-filter).

### Cross-cutting render helpers
- `fillShape` [engine.ts:368](../src/drawing/engine.ts#L368) — shaped soft/hard/square stamp
  via radial gradient or rect. Honours `hardness` (gradient inner-stop) and `shape`.
- `stampTextured` [engine.ts:475](../src/drawing/engine.ts#L475) — offscreen stamp +
  world-aligned `createPattern` mask (`textures.ts`).
- `resolveStamp` [engine.ts:313](../src/drawing/engine.ts#L313) + `sampleDest` /
  `blendColor` — colour resolution needing pixel readback.

### Textures ([textures.ts](../src/drawing/textures.ts))
`canvas / grain / noise / speckle` procedurally generated as 96×96 alpha-only canvases
(`createImageData` + per-pixel `Math.random`), cached, applied as **`destination-in`
patterns** aligned to world space via `pattern.setTransform(DOMMatrix)`. Web-Canvas-specific
(`createPattern`, `DOMMatrix`), though the noise generation logic is portable.

### Shape assist ([shapes.ts](../src/drawing/shapes.ts)) — **fully portable, pure math**
This file has **zero Canvas/DOM dependencies** — it operates only on point arrays.
- `analyzeShape` ([shapes.ts:43](../src/drawing/shapes.ts#L43)) — detects line/circle/ellipse/
  arc/rectangle/square/triangle from raw points (resampling, Douglas-Peucker simplification,
  Kåsa least-squares circle fit, centroid/stddev heuristics, strength-scaled tolerances).
- `generateShapePath` ([shapes.ts:141](../src/drawing/shapes.ts#L141)) — turns a detected
  shape back into a dense `InputPoint[]` (seeded with median pressure) for the engine to
  re-stamp; optional hand-drawn jitter when not "perfect".
- `smoothFreeform` ([shapes.ts:265](../src/drawing/shapes.ts#L265)) — Chaikin corner-cutting
  fallback.
The orchestration (snapshot → analyze → restore → replay with a second `StrokeEngine`) lives
in `Canvas.tsx` (`runShapeAssist`, [Canvas.tsx:133](../src/components/Canvas.tsx#L133)).

---

## 6. Input handling

- **Pointer Events** throughout (no mouse/touch fallbacks, no input library). The scrollable
  wrapper in `Canvas.tsx` binds `onPointerDown/Move/Up/Cancel/Leave`
  ([Canvas.tsx:454-458](../src/components/Canvas.tsx#L454-L458)) and uses
  `setPointerCapture` / `releasePointerCapture`.
- **Coalesced events** are consumed for high-frequency stylus sampling:
  `e.nativeEvent.getCoalescedEvents()` ([Canvas.tsx:328-330](../src/components/Canvas.tsx#L328-L330)),
  each fed to `engine.extend`. `getPredictedEvents` is **not** used.
- **Pressure:** yes — `PointerEvent.pressure`, gated by `pointerType !== 'mouse'`
  ([Canvas.tsx:314](../src/components/Canvas.tsx#L314)). For mouse (or pens reporting 0), the
  engine **simulates** pressure from stroke speed (`derivePressure`,
  [engine.ts:234-236](../src/drawing/engine.ts#L234-L236)).
- **Tilt / azimuth / rotation:** **not read.** Apple Pencil exposes `tiltX/tiltY` (and
  altitude/azimuth) but the code never touches them — a real gap for the iPad target (§9).
- **Coordinate mapping:** `toInternal` ([Canvas.tsx:258-275](../src/components/Canvas.tsx#L258-L275))
  converts client coords → stage CSS px (zoom-aware via `getBoundingClientRect`) → subtracts
  the neighbour-sliver offset → scales to the 2000px internal resolution. Strokes that begin
  in the neighbour sliver are allowed but clipped to the artboard rect.
- **Zoom/pan:** Ctrl/Cmd+wheel zooms toward cursor with a scroll-correction in
  `useLayoutEffect` ([Canvas.tsx:217-254](../src/components/Canvas.tsx#L217-L254)); `ResizeObserver`
  computes fit-zoom.

**Two draw entry points** ([App.tsx:30-39](../src/App.tsx#L30-L39)):
- `/draw` → `<DrawingScreen>` standalone sandbox (no canvas/tile, default session key).
- `/canvas/:id/draw/:tileId` → `<CanvasDrawScreen>` → `<DrawingScreen>` wired to a real tile
  (claims tile, restricts tools/palette via `CanvasConfig`, uploads PNG on submit).
  *(The App.tsx comment at line 22-24 claiming these are "ComingSoon stubs" is **stale** — both
  routes render the real editor. Noted, not changed — see §9.)*

---

## 7. Existing separation of concerns

There **is** a deliberate, partial boundary — better than a typical prototype, but not clean.

**Already close to framework-agnostic ("core" candidates):**
- [src/drawing/shapes.ts](../src/drawing/shapes.ts) — pure geometry/point math, **no DOM**.
  Directly portable as-is.
- [src/types.ts](../src/types.ts) — `ToolId`, `ToolSettings`, `StrokePoint`, `Layer`,
  `AssistSettings`, `InputPoint`. Pure data contracts.
- The **stroke-orchestration math** inside `StrokeEngine`: EMA smoothing, distance stepping
  (`extend`'s interpolation loop), `spacingFactor`, `brushDiameter`, `derivePressure`,
  `applyDilution`, `generateBristles`'s layout, `smoothNoise`, and the *math* of the
  waterdrop displacement/turbulence. These are arithmetic and would survive a renderer swap —
  but they are **interleaved** with `ctx` calls in the same methods, so they aren't cleanly
  extractable today.

**Tightly coupled to the web / Canvas 2D:**
- `StrokeEngine` is constructed with a live `CanvasRenderingContext2D`
  ([engine.ts:62](../src/drawing/engine.ts#L62)) and **every `stamp*` method mutates it
  directly** (`ctx.fillRect`, `createRadialGradient`, `globalCompositeOperation`,
  `getImageData`, `putImageData`, `drawImage`). There is no render-command abstraction.
- The engine itself calls `document.createElement('canvas')` (tempStamp, smudge, waterdrop)
  — DOM access from "logic".
- [textures.ts](../src/drawing/textures.ts) uses `createImageData`, `createPattern`,
  `DOMMatrix`.
- [Canvas.tsx](../src/components/Canvas.tsx) couples React lifecycle, Pointer Events, zoom DOM
  math, the layer-`<canvas>` map, undo snapshotting, and shape-assist replay together.
- [useHistory.ts](../src/hooks/useHistory.ts) is defined in terms of `ImageData`.
- [session.ts](../src/session.ts) serializes via `canvas.toDataURL`.

**Net:** the *shape detection* and *stroke kinematics* are portable in spirit; the *pixel
production* (every brush's actual mark-making) is written straight against Canvas 2D with no
seam. A migration would need to introduce a renderer interface (e.g. "draw soft disc",
"draw textured stamp", "displace region", "erase region") that both Canvas 2D and Skia can
implement, then refactor each `stamp*` to emit those commands instead of touching `ctx`.

---

## 8. Coupling and risks

**Things that make extracting a shared core hard:**

1. **No vector document model.** The biggest structural risk. Strokes are destroyed into
   pixels immediately; there is nothing to "re-render" on a new backend. Undo, save, and
   collaboration all assume bitmaps. A shared renderer that wants resolution independence,
   re-styling, or deterministic replay would need a **new retained stroke/scene model** that
   does not exist today (everything would otherwise be a one-way rasterize).

2. **Pixel-readback effects.** `sampleDest` (per-stamp blending/build-up), smudge, waterdrop,
   and `applyBuildUp` all depend on synchronous `getImageData`/`putImageData`. On a GPU/Skia
   renderer, per-stamp CPU readback is both architecturally different and a performance
   cliff; these must be re-expressed as shaders / runtime effects / image filters / blend
   equations. `willReadFrequently: true` is set precisely because of this — a tell that the
   current design is CPU-pixel-bound.

3. **Engine ↔ context fusion.** `StrokeEngine` takes a `CanvasRenderingContext2D` and there
   is no indirection. Direct calls to `createRadialGradient`, `globalCompositeOperation`,
   `createPattern`/`setTransform`, `drawImage`, `arc`/`fillRect` are scattered through every
   tool. No render-command/IR layer to retarget.

4. **DOM access inside "logic":** `document.createElement('canvas')` in the engine and
   textures; `DOMMatrix` in textures. These are web-only and live below the UI layer.

5. **Unseeded `Math.random()`** in pencil, spray, bristles, and texture generation
   ([engine.ts:430,532,695,699,701](../src/drawing/engine.ts#L430), textures `alphaFor`). The
   marks are non-deterministic, so identical inputs don't reproduce identical output. For a
   *shared* renderer (web vs iPad parity, or any replay/collab), this is a correctness hazard —
   you'd want a seeded PRNG threaded through the engine (one exists for mock tiles, `mulberry32`
   in mockTiles.ts, but the brush engine doesn't use it).

6. **Memory:** undo stores full-layer `ImageData` (~16 MB each at 2000² ); up to 10 deep ×
   up to 3 layers. Plus `getImageData` allocations per waterdrop/smudge stamp. A renderer
   migration is a chance to fix this but must be mindful of it.

7. **Watercolor's host-driven `tick`** couples the engine's pooling cadence to `Canvas.tsx`'s
   rAF loop and `performance.now()` — timing-dependent behavior that must be reproduced on iPad.

8. **Hardcoded `INTERNAL_SIZE = 2000`** and the 1200px artboard / sliver layout assumptions
   are baked into both `Canvas.tsx` and the coordinate math.

**Hardest tool to reproduce on a different renderer: `waterdrop`** (then `smudge`, then
textured `brush`/`marker`). Why:
- It is a **gather/displacement filter over a live region of the canvas**, not an additive
  stamp — it reads existing pixels, warps them with two-channel turbulence + an irregular
  noise boundary, bilinearly resamples, box-blurs, and re-composites under a soft mask. On
  Skia/GPU this is not a brush stamp at all; it becomes a runtime-effect/shader or a
  displacement `ImageFilter` with a noise source, plus a blur — a fundamentally different
  implementation that must be tuned to *look the same*. Its reliance on direct
  `Uint8ClampedArray` access and CPU bilinear sampling has no 1:1 Skia equivalent.
- `smudge` shares the same "read pixels, move them" problem.
- Textured stamps depend on world-aligned `createPattern` masking, which maps to a Skia
  shader/`SkImageFilter` but needs care to keep grain registration stable across stamps.
The additive stamps (pen, pencil, brush body, spray, eraser, bristles) port comparatively
cleanly — they're discs/particles/gradients/blend-mode fills.

---

## 9. Open questions

1. **iPad target architecture is unknown from this repo.** "Shared Skia renderer (web + iPad)"
   could mean CanvasKit/Skia-WASM on web + Skia on a native iPad app, or React Native Skia, or
   a C++ core. Nothing here indicates the intended host. The answer heavily shapes how much of
   the TS engine can be reused vs. reimplemented.

2. **`applyBuildUp` appears dead.** The per-pixel build-up post-pass
   ([engine.ts:630](../src/drawing/engine.ts#L630)) is fully implemented and documented but is
   **not called by any stamp method** — the live build-up path is the `resolveStamp` branch
   ([engine.ts:328](../src/drawing/engine.ts#L328)). Is `applyBuildUp` intended to be wired in,
   or removed? (Flagging, not changing.)

3. **Export is a mock.** [ExportDialog.tsx](../src/components/editor/ExportDialog.tsx)
   simulates a 1.1 s delay and shows "Export ready" but **never renders or downloads** an
   image (no canvas work, no `toBlob`/anchor download). The real composite path that *does*
   produce a PNG is the **submit** flow, not export. Is a real export expected pre-migration?

4. **Stale routing comment.** [App.tsx:22-24](../src/App.tsx#L22-L24) says the draw routes are
   "ComingSoon stubs"; they actually render the full `DrawingScreen`/`CanvasDrawScreen`.

5. **No tilt capture** despite an Apple-Pencil target. Should the new model capture
   `tiltX/tiltY`/azimuth (and barrel pressure) now, so the document model and engine are
   ready for it? Today only `pressure` + `t` are recorded.

6. **Determinism intent.** Should brush randomness become seeded for web/iPad visual parity
   and replay? Currently unseeded `Math.random()`.

7. **Coverage gate disabled.** `MIN_SUBMIT_COVERAGE = 0`
   ([DrawingScreen.tsx:23](../src/screens/DrawingScreen.tsx#L23)) — a previously-50% submit
   gate is intentionally paused. Not a renderer concern, but a behavioral note.

8. **Internal resolution is fixed at 2000².** Is the migration expected to introduce
   resolution independence / higher-DPI artboards, or preserve the 2000px raster contract that
   stored drafts (WebP) and submissions (PNG) currently assume?

9. **Layer compositing relies on DOM stacking.** Visible layers are composited by the browser
   painting overlaid `<canvas>` elements; only export flattens them manually with default
   `source-over`. There are **no per-layer blend modes or opacity** in the model today — worth
   confirming whether the shared renderer should add them (it would need an explicit compositor).

---

### Most important findings (TL;DR)

- **Rendering:** 100% **Canvas 2D**, immediate-mode, **no render loop** — strokes are stamped
  synchronously in pointer handlers onto a **stack of per-layer `<canvas>` elements** at a
  fixed **2000×2000** internal resolution. No WebGL/WebGPU/Skia/SVG, no graphics library.
- **Strokes are raster, not vector.** No persistent stroke/scene model exists; pixels *are*
  the document. Undo = full-layer `ImageData` snapshots; drafts = WebP data URLs in
  localStorage; submissions = flattened PNG. Raw points survive only transiently for shape
  assist. This is the central migration risk.
- **Waterdrop** is a CPU **displacement filter** (read patch → noise-perturbed irregular
  boundary → ±60° angular + magnitude turbulence → bilinear resample → box-blur →
  `destination-in` mask → optional ink tint) — the hardest tool to port. **Spray** is a simple
  particle scatter (`density·r·0.7` particles, random angle/`pow(rand,0.7)·r` radius, random
  alpha) — mostly portable; only the arc-fill is Canvas-specific. Both, like smudge and
  per-stamp blending/build-up, lean on `getImageData`/`putImageData`, which is the pattern that
  won't translate to a GPU/Skia backend without re-expression as shaders/effects.
- **Portable today:** `shapes.ts` (pure geometry) and the stroke kinematics math. **Coupled:**
  every brush's actual mark-making is written straight against a `CanvasRenderingContext2D`
  with no abstraction seam.
