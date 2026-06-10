# Drawie Native (Phase 5) — foundation + integration plan

This is the **Expo / React Native** app. The drawing **core is already shared and proven**:
the same `@drawie/core` `StrokeEngine` + retained vector model that power web render here
through `RNSkiaBackend` (a `RendererBackend` against `@shopify/react-native-skia`). This
folder lays the rendering foundation and documents the device-dependent remainder.

## ✅ Device bring-up — what actually runs (2026-06-10, iPad Pro 11″, iOS 26.5, Xcode 26.5)

The app builds, installs, and **draws on a real iPad** with the shared `@drawie/core` engine.

**Versions (Expo SDK 56):** react-native 0.85.3 · @shopify/react-native-skia 2.6.2 ·
react-native-reanimated 4.3.1 + react-native-worklets 0.8.3 (babel `react-native-worklets/plugin`,
last) · react-native-gesture-handler 2.31.1 · react 19.2.7. TypeScript 6 in apps/native.

**Build/sign (free Apple ID):** set `DEVELOPMENT_TEAM` + `CODE_SIGN_STYLE = Automatic` in
`ios/Drawie.xcodeproj` (personal team). `expo run:ios` does NOT pass `-allowProvisioningUpdates`,
so the **first** build must be `xcodebuild … -allowProvisioningUpdates` to generate the free-team
profile (it's then cached and `expo run:ios` works). Device needs **Developer Mode** on
(Settings → Privacy & Security) and the dev cert **trusted** (Settings → General → VPN & Device
Management). `ios/` is git-ignored (CNG) — `expo prebuild` regenerates it; re-apply the two signing
keys after a clean prebuild.

**Low-latency input/render binding (DrawCanvas):**
- Input: gesture-handler `Pan` with **worklet** callbacks (UI thread). Pen **pressure + tilt** read
  from `event.stylusData` (`{pressure, tiltX, tiltY, azimuthAngle, altitudeAngle}`). Confirmed:
  pressure ranges ~0.04 (light) … ~0.80 (firm) on Apple Pencil.
- Active stroke: a reactive Skia `<Path>` from a Reanimated `useDerivedValue` — redraws on the UI
  thread per frame, **no React state / re-render on the hot path**. Width tracks live pressure.
- Committed strokes: on lift only (one `runOnJS`), the `@drawie/core` engine renders into an
  offscreen surface; cached as an `<Image>` (scene not replayed per move). Preview cleared after the
  committed image renders (avoids a 1-frame flash).
- **Two gotchas solved:** (1) an offscreen surface snapshot is a GPU-texture image the on-screen
  `<Canvas>` can't draw — convert via `makeImageSnapshot().makeNonTextureImage()`. (2) Keep the
  drawing surface **transparent** (white paper = the View bg); filling it white makes the brush's
  build-up read opaque-white → near-white (invisible) strokes.

**Confirmed:** dev-client on device, shared engine renders, low-latency pen tracking, real pressure,
no crashes. **Remaining (STEP 3+):** pressure feel/curve tuning, use tilt, palm rejection
(finger-vs-pen filtering), Apple predicted/coalesced touches (RNGH doesn't expose these — native
follow-up), all 11 tools on device, perf at scale, then the editor UI + auth (STEP 4–5).

## ⚠️ Status — what's real vs. what's unverified

| Piece | State |
|---|---|
| `src/render/RNSkiaBackend.ts` — RendererBackend for RN-Skia | Written (mirrors the proven web `SkiaBackend`). **Not built/run** — see `VERIFY:` tags. |
| `src/render/textures.ts` — DOM-free grain | Written (same seed as web). |
| `src/DrawCanvas.tsx` — shared engine + model on a Skia surface + gesture input | Written. **Not built/run.** |
| `App.tsx` / `index.ts` / `app.json` / `metro.config.js` | Scaffold. |
| Build + run on device | **Not possible in a headless CI/agent env** — needs the RN toolchain + a device. |
| Product screens (homepage/auth/discovery/editor chrome/submit) | **Not started** — see inventory below. |
| Supabase auth in RN | **Not started** — see below. |

**Nothing in this folder has been compiled or executed.** react-native-skia 2.x is a native
module requiring a custom dev client (it does **not** run in Expo Go), the RN toolchain
(Xcode / Android SDK), and a physical iPad / Android device for the Phase 5 acceptance test.
Treat the code here as a verified-by-design starting point, not a working app.

## Why this app is NOT in the root npm workspaces

Adding React Native + react-native-skia to the root `workspaces` install would risk the
**verified web build** (peer-dep/React-version churn, native postinstalls). So `apps/native`
is deliberately excluded from the root `workspaces` array. It installs independently:

```bash
cd apps/native
npm install
npx expo prebuild            # generates native projects (custom dev client)
npx expo run:ios             # or run:android — needs Xcode / Android SDK + a device/simulator
```

`metro.config.js` is configured with `watchFolders` + `extraNodeModules` so Metro resolves
`@drawie/core` / `@drawie/data` from `../../packages` despite the app being out-of-workspace.

## First-device checklist (the `VERIFY:` tags)

1. **RN-Skia API shape** — confirm `Skia.Surface.MakeOffscreen`, `Skia.Shader.MakeRadialGradient`
   (center as `Skia.Point`), `SkImage.readPixels` off `makeImageSnapshot`, `Skia.Image.MakeImage`
   + `Skia.Data.fromBytes`, and `drawLine(x0,y0,x1,y1,paint)` signatures against the installed
   2.x version. The mapping is mechanical (see RNSkiaBackend) but signatures drift between majors.
2. **Presentation cadence** — `DrawCanvas` snapshots the offscreen surface per gesture event into
   `<Image>`. For 60 fps prefer `useCanvasRef` + an imperative draw loop or a Reanimated shared
   value; snapshot-per-move is fine to validate correctness first.
3. **Pen pressure + tilt** — RNGH's pan event may not surface stylus force/tilt on all platforms.
   Read them from the pointer event (RNGH 2.x pointer type) or a small native module and feed them
   into `toInput(...)`. The model + engine already accept pressure and **store tilt** (Phase 3),
   so no core change is needed — only the capture site.
4. **Golden parity** — once it renders, reuse the corpus (`docs/baseline/stroke-corpus.json`) +
   `skia-golden` approach to diff native-Skia vs web-Skia (Phase 6) and confirm tools match within
   tolerance. The deterministic seed makes this a clean comparison.

## Product-screen rebuild inventory (Phase 5, step 3)

Rebuild these web screens in RN, reusing `@drawie/data` for ALL backend/business logic (no UI in
data). Each maps to an existing web screen under `apps/web/src/screens` / `components`:

- Auth (`LoginScreen`) — incl. dev personas; RN Supabase auth (below).
- Home / discovery (`DiscoveryScreen`, `HeroSection`, `FilterBar`, canvas cards).
- Dashboard / my canvases / user profile.
- Create-canvas wizard.
- **Editor shell** (`DrawingScreen`) — toolbars (`BottomToolbar`), tool settings, layers panel
  (max 3, `MAX_LAYERS`), color picker, coverage gauge, save/submit. The drawing surface itself is
  `DrawCanvas` here; port the rest as RN components. Lift `DEFAULT_SETTINGS` / `DEFAULT_ASSIST` into
  `@drawie/core` so both platforms share one source.
- Canvas detail + mosaic reveal (realtime via `@drawie/data` hooks — `useRealtimeCanvas/Tiles`
  re-implemented with RN-friendly subscriptions).

## Supabase auth in RN (Phase 5, step 3)

`@drawie/data`'s client currently uses supabase-js web defaults. For RN:

- Provide `storage: AsyncStorage`, `autoRefreshToken: true`, `persistSession: true`,
  `detectSessionInUrl: false`; import `react-native-url-polyfill/auto`.
- OAuth (Google) + email confirmations use the **`drawie://` deep link** (`app.json` scheme) — handle
  the redirect with `expo-linking` / `Linking.addEventListener` and exchange the code.
- Cleanest: have `@drawie/data` export a `createSupabaseClient(opts)` factory so web passes its
  storage and native passes AsyncStorage — one client implementation, two configs. (Today the web
  client is a singleton; this small refactor unblocks native without duplicating the data layer.)

Point at the **same Supabase project** as web (ref `orsuxhtzbabmurbijofj`) so accounts/canvases are
shared across platforms (the Phase 6 interconnection test).

## Acceptance (unchanged from the plan)

The native app runs on a real iPad + Android device, draws with pressure+tilt via the shared engine,
and logs into the same backend as web. **Requires a device — cannot be signed off headlessly.**
