# @drawie/tokens — single-source design tokens

One canonical token source → both platforms' shadcn semantic palette mean the same color.

- **Source of truth:** [`tokens.json`](./tokens.json) — the shadcn semantic colors with their
  **web** values. The web brand palette (`apps/web/src/index.css`, OKLCH at hue 147.88, resolved
  through the web's `@theme inline` shadcn bridge) is canonical; this file mirrors it.
- **Generator:** [`build.mjs`](./build.mjs) — zero-dependency. Converts each OKLCH value to HSL
  channels (OKLab → linear sRGB → sRGB → HSL, Ottosson's matrices) and writes the native
  `apps/native/global.css` `:root`, so `bg-primary` / `text-foreground` / … resolve to the **same
  color** on web and native.

```bash
node packages/tokens/build.mjs              # regenerate apps/native/global.css (prints the table)
node packages/tokens/build.mjs --out /tmp/x.css   # dry-run elsewhere to inspect first
```

## Design decisions

- **Web is canonical; the web CSS is NOT regenerated** from this source — it stays hand-authored
  OKLCH and remains the reference. Only the **native** `:root` is generated, so the prod web app is
  never touched. (Native converged to the web palette on 2026-06-16.)
- Web stays **OKLCH**, native is emitted as **HSL channels** (`H S% L%`) because the native
  `tailwind.config.js` composes `hsl(var(--token) / <alpha-value>)`.
- To change a brand color: edit it in **both** `tokens.json` and `apps/web/src/index.css` (kept in
  sync by hand for now), then rerun `build.mjs`. A future step can also emit the web CSS from here.
- `success` / `warning` are included to complete the shared shadcn semantic set (native can use
  `bg-success` / `bg-warning` instead of ad-hoc `emerald`/`amber`).
