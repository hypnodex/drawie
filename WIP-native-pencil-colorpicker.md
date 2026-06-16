# WIP — Native iPad: Apple Pencil glitch in the colour picker (UNRESOLVED)

_Branch: `feat/native-shadcn` · worktree: `drawie2-spike-nativewind` · iPad: `00008103-001E18843E07001E` (iPadOS 26.5)_
_JS build badge: **b13** (shown next to "← Leave" in the editor)_

## TL;DR — where we are
The colour picker still misbehaves with the Apple Pencil **after** we shipped a native Apple-Pencil-Scribble
disable. So the current theory (iPadOS Scribble) is either **incomplete** (the swizzle doesn't catch it on
iPadOS 26) or **wrong** (it's an app-level issue, not Scribble). Next session must **disambiguate first**
(one 10-second test) before writing more code.

## THE problem still open
- Using the Apple Pencil **in the custom colour picker** (SV square / hue strip / RGB fields) still produces
  the glitch the user reported: stray **gray ink over the UI** that **fades after a few seconds**, and it
  felt like "I can draw over the picker."
- Last user message: _"no in color picker, still the same problem"_ — i.e. unchanged after the native rebuild.
- ⚠️ Ambiguity to resolve: the colour picker has had **two** complaints over time — (1) **laggy** thumb drag,
  (2) **gray ink / draw-through**. Confirm with the user **which** remains (get a fresh screenshot).

## What is CONFIRMED working (don't re-litigate)
- **Canvas draw-block**: `blockedSv` shared-value check inside the draw gesture worklet (DrawCanvas.tsx) —
  the artboard stays **white** when the settings/mosaic overlay is open. Strokes do NOT land on the canvas.
  Verified from the user's own screenshot (white artboard).
- **Sliders** smooth (UI-thread thumb + 30fps throttle) — user confirmed.
- **SV/hue thumbs** are UI-thread (smooth) — `SvColorPicker.tsx`.

## Diagnostic history (draw-through / ink)
1. `blocked` prop + `.enabled(false)` on the pan → insufficient (gesture-arena race).
2. Gesture "shield" overlay below the popover → bypassed by touches **on** the popover. Removed.
3. `pointerEvents="none"` on the active layer when settings open → gesture-handler **ignored** it for the
   Pencil. Reverted.
4. **`blockedSv` worklet check** (race-free) for `settingsOpen || mosaicOpen` → **this fixed canvas strokes.**
5. Diagnosed the remaining **gray ink** as **iPadOS Scribble** (Apple Pencil handwriting). Evidence: the iPad
   floating **handwriting toolbar** pill in both screenshots, search box filled with garbled **"l mm N"**,
   ink is **gray ≠ green brush**, ink **fades** (recognition).
6. JS mitigation (**b13**): dismiss keyboard on SV/hue drag-begin so picking drops RGB-field focus
   (`SvColorPicker.tsx` → `dismissKb` via `runOnJS(Keyboard.dismiss)` in svPan/huePan `onBegin`).
7. **Native**: swizzle `UIView.addInteraction(_:)` to drop `UIScribbleInteraction` /
   `UIIndirectScribbleInteraction` app-wide.
   - `ios/Drawie/AppDelegate.swift` (on-disk; `ios/` is **gitignored**).
   - `plugins/withDisableScribble.js` + registered in `app.json` (**committed** `187de78`) → re-applies on
     `expo prebuild`.
   - Dev client **rebuilt + installed** (`expo run:ios --device …`, Build Succeeded, 0 errors).
   - **Result: user says colour picker STILL broken.**

## DO THIS FIRST next session — the disambiguating test
**iOS Settings → Apple Pencil → toggle "Scribble" OFF**, then test the colour picker with the Pencil:
- **Glitch GONE with Scribble off** → it *is* Scribble, and our **swizzle is incomplete on iPadOS 26**
  (pursue path A below). The system toggle is the proof.
- **Glitch REMAINS with Scribble off** → it is **NOT Scribble** → stop chasing Scribble; investigate the app
  (path B). All the native swizzle work would then be irrelevant to this symptom (still fine to keep, but not
  the cause).

Also confirm the **new binary is actually running**: fully quit (swipe away) + reopen; the badge should be
`b13`. Optionally add an `NSLog`/marker in the swizzle install to prove it ran on iPadOS 26.

## Hypotheses & next steps

### Path A — it IS Scribble but the swizzle misses it (likely on iPadOS 26.5)
- `UIView.addInteraction(_:)` swizzle assumes UIKit attaches Scribble via the **public** method. On iPadOS 26
  UIKit may attach it **internally** (private path) → our swizzle never sees it. Verify with an `NSLog` inside
  `drawie_addInteraction` (does it ever fire with a "Scribble" interaction?).
- Stronger native options:
  - Set a `UIScribbleInteractionDelegate` on text inputs returning `false` from
    `scribbleInteraction(_:shouldBeginAt:)` (needs a handle to the interaction / subclassing RCTUITextField).
  - Subclass / category on `RCTUITextField` + `RCTUITextView` to remove scribble interactions in
    `didMoveToWindow`/`layoutSubviews` (iterate `self.interactions`, drop "Scribble" ones).
  - Last resort: ship guidance to keep iOS Scribble off (not acceptable for store users).

### Path B — it is NOT Scribble (app-level)
- Re-examine `SvColorPicker.tsx`: the SV square / hue strip are Skia `<Canvas>` + gesture-handler `Pan`. Could
  a stray render / gesture be drawing a gray trail? (Strokes were gray, not the brush colour — suspicious.)
- Check whether the gray ink is some **system touch-trail / accessibility** overlay unrelated to Scribble
  (e.g. screen-recording pencil trail, AssistiveTouch).
- If the real complaint is **lag** (not ink): profile the SV drag again; consider `React.memo` on the
  DrawCanvas layers so a colour commit doesn't re-render every Skia layer (the "next perf lever" noted earlier).

## Key files
- `apps/native/src/ui/SvColorPicker.tsx` — custom picker (SV square + hue + RGB inputs + eyedropper); UI-thread
  thumbs; `dismissKb` on drag-begin.
- `apps/native/src/DrawCanvas.tsx` — draw gesture; `blockedSv` worklet check.
- `apps/native/src/EditorScreen.tsx` — `blocked={settingsOpen || mosaicOpen}`; `BUILD = 'b13'` badge.
- `apps/native/ios/Drawie/AppDelegate.swift` — Scribble swizzle (on-disk, gitignored).
- `apps/native/plugins/withDisableScribble.js` + `apps/native/app.json` — config plugin (committed).

## Build / run notes
- **Metro** (worktree doesn't auto-watch): from `apps/native`, restart with `--reset-cache`,
  `PATH="/opt/homebrew/bin:$PATH"`, `REACT_NATIVE_PACKAGER_HOSTNAME=192.168.0.184`. Mac IP currently
  `192.168.0.184`.
- **Native rebuild**: `cd apps/native && PATH="/opt/homebrew/bin:$PATH" REACT_NATIVE_PACKAGER_HOSTNAME=192.168.0.184 npx expo run:ios --device 00008103-001E18843E07001E` (~few min, works; CocoaPods at `/opt/homebrew/bin/pod`).
- Verify bundle freshness: `curl ".../index.bundle?platform=ios&dev=true&minify=false"` then grep for the
  `BUILD` badge string + new symbols.

## Constraints / parking lot
- **Do NOT touch the hosted Supabase DB.**
- **Oil paint**: user has a NEW brief pending ("for oil I have new brief but in next step") — not yet given; do
  not iterate oil until it arrives.
- `feat/native-shadcn` is **not merged to main**. Pending user device-verify of the editor rework + zoom↔Pencil
  alignment under magnification.

## Latest commits
- `187de78` ios: durable Scribble disable via config plugin
- `181989a` diagnose Scribble; blur RGB fields on picker drag (**b13**)
- `0c736c7` draw-through: race-free block via shared value in gesture worklet
- (AppDelegate.swift edit is on-disk only — gitignored — re-applied by the config plugin on prebuild)
