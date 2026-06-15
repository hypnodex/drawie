# Drawie2 — Current State (ground truth)

> **As of 2026-06-14.** Read-only snapshot of where the project *actually* is, traced to real
> files and the live git/branch state — not to plans or intentions.
>
> **Provenance note:** this file previously held the **Phase-0 audit of the web drawing
> subsystem** ("Monorepo: none… 100% Canvas 2D… no Skia"). That audit predates the native-core
> migration and is now stale; it is preserved in git history. The deep engine-internals analysis
> in it (per-tool Canvas-2D mechanics, waterdrop/smudge readback risks) is still a useful
> reference for *how the brushes work*, but its top-line claims about the architecture are
> superseded by everything below. Cross-platform parity has its own living doc:
> [PHASE6-VERIFICATION.md](./PHASE6-VERIFICATION.md).

---

## 0. TL;DR

Drawie2 is now a **monorepo** with a framework-agnostic drawing core, a pluggable renderer
contract, and **two app targets** (web + a new native iOS app). The drawing engine no longer
touches Canvas 2D directly — it emits primitives onto a `RendererBackend`, implemented three
ways (Canvas2D, web-Skia/CanvasKit, RN-Skia). Strokes are now a **retained vector model** that
replays deterministically (seeded RNG), so the same artwork renders bit-for-bit across
platforms — this is proven by an on-device golden test.

**All of the migration + the native app + a realtime "live neighbor" feature live on one branch
(`feat/native-foundation`, 41 commits ahead of `main`) and have NOT been merged.** `main` — and
therefore the deployed web app — is parked at the end of Phase 4 (Skia wired behind a flag, no
native, no realtime live-neighbors). The single biggest fact about the project's state is this
unmerged divergence.

---

## 1. Phases — done vs pending

The migration plan is `drawie2-native-core-plan.md` (referenced by commits/PHASE6 doc). Mapping
the plan to what's actually in the tree:

| Phase | What it was | State | Evidence |
|---|---|---|---|
| **0 — Audit & baseline** | Audit web drawing; capture Canvas2D golden PNGs | ✅ Done | Original audit (this file's history); `docs/baseline/` captures + `stroke-corpus.json` |
| **1 — Monorepo extraction** | Split into `@drawie/core` / `@drawie/data` / `@drawie/renderer` | ✅ Done | `packages/{core,data,renderer}`; root `package.json` workspaces |
| **2 — Engine → RendererBackend + determinism** | Remove `ctx` from engine; seeded RNG | ✅ Done | [`packages/core/src/renderer.ts`](../packages/core/src/renderer.ts) (interface), [`engine.ts`](../packages/core/src/engine.ts) uses `mulberry32(seed)`, [`rng.ts`](../packages/core/src/rng.ts) |
| **3 — Retained document model** | Strokes become a replayable vector model | ✅ Done | [`packages/core/src/document.ts`](../packages/core/src/document.ts): `DrawDocument`/`ModelLayer`/`ModelStroke`/`StrokeSample` + `replayStroke()`/`renderLayer()` |
| **4 — SkiaBackend + web-on-Skia** | CanvasKit backend; wire web editor to it behind a flag | ✅ Done (flagged, default-off) | [`packages/renderer/src/skia.ts`](../packages/renderer/src/skia.ts), [`apps/web/src/skiaRuntime.ts`](../apps/web/src/skiaRuntime.ts) (`?skia=1`), `main` HEAD commit `a0f9417` |
| **5 — Native iOS bring-up** | Expo/RN app: input→render, tilt, 11 tools, perf, auth, product screens | ✅ Done (feature-complete on branch) | `apps/native/` (see §3); commits `236011a`…`856a0e7` |
| **6 — Cross-platform parity** | Web-vs-native golden within tolerance; shared backend | ✅ Done (with caveats) | [PHASE6-VERIFICATION.md](./PHASE6-VERIFICATION.md); native golden run on iPad 2026-06-11 |
| **Realtime live-neighbor** (post-6 feature) | Live in-progress strokes in adjacent-tile slivers over Supabase Broadcast + a dev sim harness | ✅ Done + verified (web & iPad↔web) | `packages/data/src/realtime/`, `apps/{web,native}` live hooks; commit `856a0e7` |

**Pending / not started** (from the migration notes, not yet in the tree):
- **Phase 7 — store readiness** for iOS (icons/splash, EAS build/submit, App Store metadata,
  privacy, real auth UX) — not started.
- **Android** — explicitly **deprecated** (decision 2026-06-11); "all platforms" = web + iOS.
- **Cross-device draft sync** — deferred (drafts are per-device; see PHASE6 §3).
- **Polling fallback** for realtime behind WS-blocking ad-blockers — decided **DEFER**
  (2026-06-14); not a bug, only affects ad-blocker web users.

---

## 2. Branch / merge / push status

| Branch | Tracks | Sync vs origin | Role |
|---|---|---|---|
| `main` | `origin/main` | in sync (pushed) | Phase-4 web app; **what Vercel deploys** |
| `feat/native-foundation` | `origin/feat/native-foundation` | in sync (pushed) | **All** migration + native + realtime work |
| `backup/pre-native-core-20260609` | — (local only) | local | Safety snapshot pre-migration |

- **`feat/native-foundation` is 41 commits ahead of `main`; `main` is 0 commits ahead of feat**
  (`git rev-list --count main..feat` = 41; `feat..main` = 0). Merge base is `a0f9417`.
- **`feat/native-foundation` is NOT merged into `main`** (`git branch --merged main` does not
  list it). So Phases 5, 6, and the realtime feature exist **only on the branch**.
- **Nothing is unpushed.** Both `main` and `feat/native-foundation` match their origin refs
  (latest verified push of feat: `856a0e7`, 2026-06-14).
- **Working tree:** clean except one untracked file — `apps/web/.env.local.localstack.bak`
  (a backup created during this session's realtime testing; see §5).
- **Deployment implication:** the production web app (`drawie-xi.vercel.app`, fed from `main`)
  does **not** include the retained model on the default path, the native app, or live-neighbor
  drawing. Web users still draw on **Canvas2D by default** (Skia is opt-in via `?skia=1`).

---

## 3. Native iOS app — what works vs what's missing

App: `apps/native` (Expo SDK 56 / React Native 0.85.3, `react-native-skia`). Navigation is a
**hand-rolled route state machine** in [`App.tsx`](../apps/native/App.tsx) (not react-navigation;
a deliberate "replace when the screen set grows" choice). **Note:** `apps/native` is intentionally
**excluded from the npm workspaces** (`workspaces: ["apps/web","packages/*"]`) — it installs
separately to avoid Metro/Expo hoisting issues.

### Works on device (verified on iPad — see §4)
- **Low-latency stroke input → render** through the shared `@drawie/core` engine drawing onto
  an `RNSkiaBackend` ([`apps/native/src/render/RNSkiaBackend.ts`](../apps/native/src/render/RNSkiaBackend.ts)).
  WYSIWYG live rendering; native-object leak fixes; `alive`/rAF guard prevents the Clear-remount crash.
- **Pressure** (Apple Pencil) and **tilt** (`tiltX/tiltY` captured into the model's `StrokeSample`).
- **Palm/finger rejection** — only the pen draws.
- **All 11 tools** (`brush, drybrush, inkbrush, pencil, pen, marker, watercolor, spray, eraser,
  smudge, waterdrop`) + Clear, per-tool color/size/opacity, texture picker, hardness/softness.
- **Layers** (max 3) and **instant undo/redo/clear** (pixel checkpoints).
- **Perf fixes:** bounded `Canvas.readPixels` readback, `fillCircle` paint-state cache, cached
  texture tile (the readback-heavy tools were the hot path).
- **Auth:** email/password, **anonymous guest**, and **Google OAuth** (PKCE via `drawie://`
  deep link, no extra native module). Session persisted via AsyncStorage; auth gate.
  ⚠️ Native login is a **plain email form — no persona picker** (that's web-only dev impersonation),
  so dev login is the full email `alex@drawie.test` / `drawie123`, *not* bare `alex`.
- **Product loop:** discovery (sort/status/search filters) → canvas detail (live tile grid +
  mosaic reveal) → claim tile → editor → save/submit (composite → PNG → upload → `complete_tile`)
  with a **server-side moderation gate** before submit.
- **Founder/private canvases:** create wizard (premium-gated private-link), share/invite, join,
  **host console** (participant list + remove), canvas aspect ratios (square/portrait/landscape).
- **Realtime live-neighbor slivers:** the native sliver subsystem renders on hardware; the dev
  **sim harness** animates the 8 neighbor slivers; **iPad↔web live drawing confirmed** (2026-06-14).

### Stubbed / missing / not rebuilt in RN
- **No dedicated Premium / purchase screen.** Premium is *gated* inline (private-link creation,
  profile `★ Premium` badge) but there is no upsell/billing flow (web has `PremiumScreen.tsx`).
- **No Design-System screen.** Web's `DesignSystemScreen.tsx` (component showcase) has no RN
  equivalent.
- **No Dashboard / 404.** Web's `DashboardScreen`/`NotFoundScreen` have no RN counterpart; the
  native home is Discovery and navigation is state-driven (no URL 404).
- **My-canvases + user profile are merged** into one native `ProfileScreen` (web splits them
  into `MyCanvasesScreen` + `UserProfileScreen`).
- **Native-only:** `GoldenScreen` (the on-device parity harness — not a product screen).

### UI / design parity with web
**Functional parity, not visual parity.** Native screens are hand-built RN `StyleSheet` views;
web uses **Tailwind v4 + HeroUI v3**. There is **no shared design system / Figma tokens** between
them — the native UI is bespoke and does not match web's look. Bringing native UI to design parity
(or adopting a shared design system) is an open decision (§6), not done.

| Web screen | Native equivalent |
|---|---|
| LoginScreen | `auth/LoginScreen` (no persona picker) |
| DiscoveryScreen | `DiscoveryScreen` |
| CanvasDetailScreen | `CanvasScreen` |
| DrawingScreen + CanvasDrawScreen | `EditorScreen` + `DrawCanvas` |
| PrivateHostScreen | `HostConsoleScreen` |
| PrivateJoinScreen | `JoinScreen` |
| MyCanvasesScreen + UserProfileScreen | `ProfileScreen` (merged) |
| (share is inline on web) | `ShareScreen` |
| PremiumScreen | — (inline gating only) |
| DesignSystemScreen | — |
| DashboardScreen / NotFoundScreen | — |

---

## 4. Verification status — hardware vs headless vs unverified

### ✅ Verified on hardware (physical iPad)
- **Phase 6 native-vs-web golden parity — YES, it was actually run.** On iPad **2026-06-11** via
  the on-device harness (`apps/native/src/golden/`, launched by long-pressing the discovery title
  → "Run", streaming `[golden]` verdicts to the Metro log). Result: **deterministic tools 14/14
  within tolerance (≤3.0 meanAbs), 9 stochastic tools reported, 0 errors.** Both web-Skia and
  native-Skia drive the same engine through the same `RendererBackend` with the same seed
  (`0x9e3779b9`); only the rasteriser differs. Largest deterministic delta
  (`watercolor-dwell-pool`, 0.253/255) is *identical* on web-Skia → an inherent Skia-vs-Canvas2D
  accumulation delta, not a native divergence. Details in [PHASE6-VERIFICATION.md](./PHASE6-VERIFICATION.md) §1.
- **Native drawing, pressure, tilt, 11 tools, layers, undo, perf** — exercised on device (Phase 5).
- **Native submit → shared backend** — a tile drawn+submitted on iPad persisted to the shared DB
  (REST-confirmed: completed count 8→9, `status=completed`, `artwork_path` set). PHASE6 §2.
- **Realtime live-neighbor slivers on iPad** — sim harness animates slivers on HW; **iPad↔web
  cross-platform live drawing confirmed by the user (2026-06-14)**; Clear/back/re-enter dispose
  cycles are crash-free (no "access a disposed object").

### ✅ Verified headless / on the local stack
- **Monorepo typechecks clean (2026-06-14):** `@drawie/web`, `@drawie/core`, `@drawie/data`,
  `@drawie/renderer` (root `npm run typecheck`) **and** `@drawie/native` all pass with no errors.
- **Web-Skia golden** is **CI-runnable** via Playwright + CanvasKit
  (`tools/baseline-capture/skia-golden.mjs` → `docs/baseline/PARITY-SKIA.json`).
- **Realtime wire-format round-trip:** `tools/baseline-capture/realtime-roundtrip.*`
  (events → assembler → live-engine vs canonical `replayStroke`) = **10/10 bit-identical**
  (meanAbs 0.000000) across brush/inkbrush/pencil/marker.
- **Two-client Broadcast harness** (`realtime-broadcast.*`) drives start/append/end/undo/clear
  over a local WS across chromium/webkit/firefox.
- **Web 2-client live-neighbor** (Brave↔Safari, local stack) — user-confirmed 2026-06-12.

### ⚠️ Partial / runtime-isolated
- **Postgres-changes realtime (mosaic tile grid / reveal)** — the *backend* delivery is healthy
  for both anon and authenticated roles (independent subscriber tests received events live), and
  **native updates live**. But the **deployed web app** (`drawie-xi.vercel.app`) was observed
  **not** reflecting tile changes without a manual refresh, despite the hooks being on deployed
  `main` and the backend delivering — a **deployed-web runtime issue**, isolated from backend,
  RLS, and native. PHASE6 §2. (Distinct from the live-neighbor *Broadcast* path, which is fine.)

### ❓ Not (re-)verified / gaps
- **No automated native golden CI.** The native rasteriser is device-bound, so native parity is
  an on-device harness, not headless CI. It was last run **2026-06-11** and was **not** re-run in
  the 2026-06-14 session — any engine change since then is unverified on native until re-run.
- **Hosted-backend migration state — VERIFIED 2026-06-15:** `supabase migration list --linked` shows
  `claim_tile_allow_multiple` IS applied on hosted (the testing relaxation **leaked to prod** — hosted
  currently allows multiple tiles per user). Phase-0 cleanup added a forward one-tile migration
  (`20260615000000_claim_tile_one_per_user`) and moved the relaxation to `supabase/dev/` (test-only);
  hosted is restored to one-tile at the redeploy via `db push` + `migration repair` (needs DB password).
- **The deployed-web realtime bug** above remains unchased.

---

## 5. Loose ends / risks / temporary hacks

1. **`claim_tile_allow_multiple` is a TESTING relaxation.** Migration
   `supabase/migrations/20260611000000_claim_tile_allow_multiple.sql` (commit `0cb9a3e`, *"(testing)"*)
   lets **one user hold many tiles per canvas** — added to unblock single-account multi-tile
   testing. This **must be reverted/guarded before production** (it changes core claiming
   semantics). Paired with `20260612000000_release_tile.sql` (discard releases a tile).

2. **Web `.env.local` env-swap (this session).** To test iPad↔web realtime, web was temporarily
   pointed at the **hosted** backend, then **restored to the local stack**. A leftover backup
   `apps/web/.env.local.localstack.bak` remains untracked in the working tree — harmless (it holds
   the public local-demo anon key) but should be deleted. `.env*` files are gitignored and not
   committed; the `.bak` is *not* matched by the ignore globs, so it would be caught by `git add -A`.

3. **Live-neighbor strokes are PRE-moderation.** Broadcast carries in-progress strokes *before*
   the submit-time moderation gate. Mitigations today: only a thin sliver is shown, receiver caps,
   and an optional `blockedSenders` list. **Flagged-user suppression is a backend follow-up** (not
   built). Broadcast also rides the same WebSocket that ad-blockers can kill (degrades gracefully;
   polling fallback deferred).

4. **Submit coverage gate disabled.** `MIN_SUBMIT_COVERAGE = 0`
   ([`apps/web/src/screens/DrawingScreen.tsx:23`](../apps/web/src/screens/DrawingScreen.tsx#L23)) —
   the previous ~50% gate is intentionally paused. Behavioral, not architectural.

5. **Dev-flag-gated surfaces** (must stay out of production):
   - **Sim neighbor harness** — gated on `import.meta.env.DEV` / `__DEV__` **and** an explicit
     `dev:true`; `simulateNeighbors.ts` hard-returns an inert handle otherwise (defence-in-depth),
     and the web sim panel is tree-shaken out of the prod bundle. Enabled via `?simulateNeighbors=1`
     / localStorage (web) or the `__DEV__` row in `EditorScreen` (native).
   - **`VITE_DEV_IMPERSONATE=true`** (web only) — auto-login + seeded persona picker; must be false
     in production.
   - **Web Skia path** (`?skia=1`) — opt-in; default users render Canvas2D and never download the
     ~7 MB CanvasKit WASM.

6. **`main` is far behind reality.** Until `feat/native-foundation` is merged, every external
   surface (Vercel web app, GitHub `main`) misrepresents the project. Long-lived divergence risk:
   the longer the 41-commit branch sits, the harder the merge + the staler the deployed web app.

---

## 6. Open decisions (not yet made)

1. **Universal app (web → RN) vs keep two UIs.** Today there are two separate UI layers (web:
   Tailwind+HeroUI; native: bespoke RN). Whether to converge on a shared component layer / RN-web,
   or keep web and native UIs separate, is undecided.
2. **Figma / shared design system.** No design tokens or shared component library exist across
   web+native. Whether to introduce one (and bring native UI to visual parity with web) is open.
3. **Android.** Deprecated for now (2026-06-11). Whether/when to revive is open.
4. **Store / launch path for iOS.** No EAS build/submit, app icons/splash, store metadata, or
   privacy disclosures yet (Phase 7). Whether to ship to TestFlight/App Store and when is undecided.
5. **Realtime hardening before launch:** custom domain (first-party WS, ~$10/mo) vs polling
   fallback vs accept graceful degradation behind ad-blockers — deferred, revisit pre-launch.
6. **Cross-device draft sync** — deferred; whether to add a `data`-layer sync is open.

---

## 7. The single most important next thing

**Merge `feat/native-foundation` into `main` (and redeploy web) — or make a deliberate decision
not to, and write down why.**

Everything of value built over the last weeks — the monorepo, the retained model, the
RendererBackend abstraction, web-Skia, the entire native iOS app, and realtime live-neighbors —
sits on a single 41-commit branch that **no external surface reflects**. The deployed web app and
GitHub `main` are stuck at Phase 4. The risk compounds daily: merge friction grows, and anyone
looking at `main` (including future-you) sees a project that no longer exists. Before merging,
two things must be cleaned up first because they are not production-safe:

1. **Revert/guard `claim_tile_allow_multiple`** (the "(testing)" migration, §5.1).
2. **Confirm dev flags are off** in any production build (`VITE_DEV_IMPERSONATE`, sim harness) — the
   gating looks solid, but verify on a real prod build.

A close second is **re-running the on-device native golden** (last run 2026-06-11) after the
recent realtime work, so the parity claim is current at merge time. The deployed-web
postgres-changes realtime bug (§4) is real but **separable** — it can be chased after the merge,
since it's a web-runtime issue, not a blocker for the branch's correctness.
