# Native editor rework + 8 fixes — session resume (2026-06-15)

Handoff doc for the Drawie2 **native** (iPad) work done this session. Picks up where we stopped.
Branch: **`feat/native-shadcn`** (worktree `../drawie2-spike-nativewind`). Pushed to origin.

| Wave | Commit | Contents |
|------|--------|----------|
| A | `6c619d3` | per-tool settings, merge-down, undo×30, bigger+centered dock |
| B | `a2c1fc9` | canvas zoom/pan, web-aligned Discovery, framed mosaic grid |

All changes are **JS-only** → they Fast-Refresh on the device (no rebuild). `react-native-svg`,
`react-native-reanimated`, `react-native-gesture-handler` are already in the installed dev client.
**Drawing engine / DrawCanvas / Skia are untouched** except one additive merge handle.

---

## What changed

### Editor rebuilt to mirror the web
- **`src/components/icons.tsx`** (NEW) — react-native-svg port of all web tool/action glyphs
  (`TOOL_ICON` map: brush…waterdrop; undo/redo/trash/send/plus/eye/merge/chevron/layers/close;
  pressure/wet/build-up; zoom-in/zoom-out/fit).
- **Floating tool DOCK** (in `EditorScreen.tsx`) — icon tools with a color dot, active = primary,
  then undo / redo / clear. Tap the **active** tool to toggle the settings popover.
- **Settings POPOVER** — opens above the dock; scrolls when a tool is control-heavy.
- **`src/components/editor/LayersCard.tsx`** (NEW) — floating layers card (count/add/collapse +
  per-row eye/select/**merge-down**/delete).
- **Top bar** — `← Leave` · Style-rules quote · green **Submit** (send icon).
- Intentionally **omitted** (no native equivalent): Save-draft, coverage % ring. (Zoom was added — see #2.)

### The 8 fixes (user's list)
1. **Per-tool settings** — `src/components/editor/ToolSettings.tsx` (NEW), native port of the web
   `ToolSettingsPanel` `TOOL_META`. Each tool shows its **own** controls (hardness / shape / texture /
   blending / dilution / persistence / strength [Density/Dryness] / softness + pressure/wet/build-up
   toggles) instead of a fixed four sliders.
   ⚠️ Exported as **`ToolSettingsPanel`** — the name `ToolSettings` collides with the `@drawie/core` type import.
2. **Zoom** — pinch + two-finger pan + **Fit / − / +** buttons (top-left). Drawing is **stylus-only**
   (`DrawCanvas` pan bails on `e.stylusData == null`), so finger gestures never conflict. Implemented with
   Reanimated shared values + `Gesture.Simultaneous(Pinch, Pan.minPointers(2))`; transform applied to the
   whole stage (`Animated.View`). Scale clamped 1–6; pan only when zoomed in; Fit resets.
3. **Discovery** — `src/screens/DiscoveryScreen.tsx` rewritten: hero (headline + lede + CTA) +
   "Recently completed" carousel (`listCompleted`) + "Trending now" row (`listTrending`) + "All canvases"
   browser (search + sort/status + grid). Mirrors the web `DiscoveryScreen` IA, mobile-adapted.
4. **Merge layers** — `DrawCanvas.mergeImage(img)` handle composites a layer's snapshot onto the surface
   (undoable) + `EditorScreen.mergeDown(id)` + merge-down button on each non-bottom `LayersCard` row.
5. **Mosaic grid** — `src/screens/CanvasScreen.tsx`: the live tile grid is framed as a mosaic-in-progress
   (rounded surface, tighter cells) + a status **legend** (Completed / In progress / Empty) + claim hint;
   cell colors aligned to the web (greens; empty = paper).
6. **Bigger** — tool dock icons `h-14`, Layers card `w-72`, larger rows/icons.
7. **Centered toolbar** — content-width pill centered via an outer centering `ScrollView` (scrolls only if
   it ever exceeds screen width), not stretched full-width.
8. **History** — `DrawCanvas` `MAX_UNDO` 10 → **30** (only the active layer accumulates checkpoints).

### Files touched
```
src/components/icons.tsx                 (NEW)
src/components/editor/ToolSettings.tsx   (NEW)
src/components/editor/LayersCard.tsx     (NEW)
src/DrawCanvas.tsx                       (MAX_UNDO 30 + mergeImage handle)
src/EditorScreen.tsx                     (dock, popover, layers, top bar, zoom, mergeDown)
src/screens/DiscoveryScreen.tsx          (redesign)
src/screens/CanvasScreen.tsx             (mosaic framing + legend)
src/ui/Slider.tsx                        (track contrast)
```

---

## How to resume

**Metro** (serves the iPad over LAN, Mac IP `192.168.0.110`):
```bash
cd apps/native && npx expo start --dev-client     # port 8081
```

**Force-bundle sanity check** (no device needed — JS compiles?):
```bash
curl -s -o /tmp/b.js -w '%{http_code}\n' "http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false"
# 200 + a JS file = OK; a JSON {"type":"TransformError",...} body = compile error
```

**Native rebuild** (only if you add another native module). iPad UDID `00008103-001E18843E07001E`.
CocoaPods is **not on the background-shell PATH** — it's at `/opt/homebrew/bin/pod` (1.16.2), so prefix it:
```bash
cd apps/native/ios && PATH="/opt/homebrew/bin:$PATH" pod install
cd apps/native && PATH="/opt/homebrew/bin:$PATH" npx expo run:ios --device 00008103-001E18843E07001E
```
(A bare `expo run:ios` fails at "sandbox not in sync with Podfile.lock" because the auto pod-install can't find pod/brew.)

---

## Verify on device (next session)
- **Editor**: switch tools → controls change per tool; pinch / two-finger pan / Fit/−/+; merge-down a layer;
  bigger centered dock; undo many steps.
- ⚠️ **Drawing alignment while zoomed** — draw at ~3× and confirm ink lands under the Pencil. RNGH should
  map the touch through the ancestor transform; **if offset**, adjust `DrawCanvas.toArtboard` to account for
  the live scale/pan.
- **Discovery** sections + **canvas mosaic grid / legend**.

## Open items
- Device-verify the 8 fixes → if good, record native editor as device-confirmed + consider merging
  `feat/native-shadcn`.
- Deferred: **Style Dictionary** single-source tokens (web CSS vars + native `:root` HSL — OKLCH-web vs HSL-native).
- Unrelated/open: prod web smoke-test at https://drawie-xi.vercel.app.
