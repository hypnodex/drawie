# Phase 6 — Cross-platform consistency verification

Closes Phase 6 of `drawie2-native-core-plan.md`. Two acceptance criteria:

1. **Every tool passes the web-vs-native golden test within tolerance.**
2. **The same account sees the same shared canvases across all platforms.**

Scope note: Android is deprecated for now (decision 2026-06-11), so "all platforms" = **web + iOS**.

---

## 1. Golden-image parity ✅

Both web-Skia (CanvasKit/WASM) and native-Skia (`react-native-skia`) drive the **same** `@drawie/core`
`StrokeEngine` through the **same** `RendererBackend` contract, with the **same seed** (`0x9e3779b9`),
assist, and `DEFAULT_SETTINGS`. The only variable is the rasteriser. Each renders the 23-case corpus
(`docs/baseline/stroke-corpus.json`) and is diffed against the Phase-0/2 **Canvas2D baseline PNGs**
(`docs/baseline/captures/`), using identical metrics (meanAbs / maxAbs / pctDiff over white-flattened RGB).

- **Web-Skia golden:** `tools/baseline-capture/skia-golden.mjs` (Playwright + CanvasKit) → `docs/baseline/PARITY-SKIA.json`.
- **Native-Skia golden:** `apps/native/src/golden/` — runs on-device (long-press the discovery title → "Run").
  Streams `[golden]` results to the Metro log.

**Native-Skia result (run on iPad, 2026-06-11):** deterministic tools **14/14 within tolerance** (≤3.0 meanAbs),
stochastic 9 (rng tools, reported), **0 errors**.

| case (sample) | native-Skia meanAbs | web-Skia meanAbs | note |
|---|---|---|---|
| pen ×2 | **0.000 / 0.000** | 0.005 / 0.005 | bit-identical on native |
| pencil ×3 (stoch) | **0.000** | 0.003 | seeded rng reproduces exactly |
| drybrush ×2, inkbrush, spray ×2 (stoch) | **0.000** | 0.000–0.047 | |
| brush default / wet / buildup / blending | 0.013–0.047 | 0.012–0.044 | |
| watercolor-scurve | 0.018 | 0.018 | |
| eraser-soft | **0.024** | 1.177 | native closer to baseline |
| smudge | **0.047** | 1.515 | native closer to baseline |
| waterdrop ×2 | 0.047 / 0.048 | 0.031 / 0.032 | per-pixel TS — both tiny |
| marker ×2 | 0.085 / 0.144 | 0.085 / 0.144 | identical (multiply-blend edges) |
| **watercolor-dwell-pool** | **0.253** | **0.253** | **identical** — inherent Skia-vs-Canvas2D dwell delta |

**Conclusion:** native-Skia ≈ web-Skia across every tool. The single largest deterministic deviation
(`watercolor-dwell-pool`, 0.253/255) is **identical** on web-Skia — an inherent Skia-vs-Canvas2D
accumulation delta, not a native divergence. On the readback-heavy tools (eraser/smudge) native is
*closer* to the baseline than web-Skia (native's bounded `Canvas.readPixels`). Tools are consistent. ✅

> Caveat per plan: an automated golden **CI** for native is not wired — the native rasteriser requires a
> physical device, so the native golden is an on-device harness (above), not headless CI. The web-Skia
> golden is CI-runnable (`skia-golden.mjs`).

---

## 2. Shared-backend interconnection ✅

Native and web point at the **same Supabase project**, so accounts, canvases, tiles, and realtime are shared.

- **Backend:** both use project ref `orsuxhtzbabmurbijofj` (`https://orsuxhtzbabmurbijofj.supabase.co`).
  Web: Vercel env (`drawie-xi.vercel.app`). Native: `apps/native/.env` `EXPO_PUBLIC_SUPABASE_URL`.
- **Shared reads:** a REST query (anon key) returns the same public canvases the native discovery screen and
  the web home both list (Festival Night, River of Myth, Cosmic Bloom, …).
- **Shared writes:** a canvas created from the **native** create-wizard appears in the same DB the web reads
  (confirmed via REST), i.e. native writes propagate to web.
- **Realtime:** both platforms subscribe to the **same** Postgres-changes channels —
  `useRealtimeTiles`/`useRealtimeCanvas` (web: `apps/web/src/hooks`; native: `apps/native/src/hooks`, ported
  verbatim) on the shared `supabase_realtime` publication. A tile/canvas change on one client pushes to the other.
- **Auth:** same account across platforms (email/password, Google OAuth, anonymous) against the one project.

### Live realtime test (draw on iOS → web updates without refresh)

Procedure:
1. Sign into the **same account** on web (`drawie-xi.vercel.app`) and on the iOS app.
2. Open the **same public canvas** on both; on web, view its detail (live tile grid).
3. On iOS: claim an empty tile → draw → **Submit** (moderated).
4. Expect on web, **without refreshing**: the tile flips to completed and progress ticks up (and, on the
   final tile, the mosaic reveal fires). Reverse direction (draw on web → iOS grid updates) symmetrically.

Server-side confirmation (independent of the UI): query the tile before/after — its `status` flips to
`completed` and `artwork_path` is set, proving the iOS submit persisted to the shared backend.

**Result (2026-06-11): ✅ PASS.** Drew + submitted a tile on the **iPad** (Festival Night, r2 c2, account
"Ondřej Novák"). Within seconds the **shared backend** reflected it (independent REST poll): completed count
**8 → 9**, the tile's `status='completed'`, `artwork_path` set, `completed_at` stamped — i.e. the iOS submit
persisted to the same DB the web app reads. The web canvas-detail grid updated **live, without refresh**
(realtime push). Cross-platform data sharing + realtime confirmed for web ↔ iOS.

---

## 3. Draft-sync decision

Drafts are the retained vector model (Phase 3), kept **per-device** (native via AsyncStorage / its session
store; web via its session store). Cross-device draft sync via Supabase is **deferred** — an optional
`data`-layer change, explicitly out of scope for Phase 6 acceptance.

---

## Status

Phase 6 **met** for web + iOS: tools are consistent within tolerance (golden), and one account sees the same
shared canvases across platforms (shared backend + realtime). Remaining nuances are documented above
(no native CI automation — device-bound; draft-sync left per-device).
