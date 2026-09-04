# Brand assets

`icon.png`, `adaptive-icon.png`, and `splash.png` are generated from the
real Shri Anandam logo (the gold "श्री" medallion — sourced from the
existing website's own favicon set at the repo root:
`android-chrome-512x512.png`), not placeholders.

- `icon.png` — 1024×1024, flattened onto the brand background
  (`#FFF8F0`, no transparency — iOS/Android app icon)
- `adaptive-icon.png` — 1024×1024, transparent, the logo scaled to 60%
  of the canvas and centered so Android's adaptive-icon masking
  (circular/squircle/rounded-square depending on launcher) doesn't crop
  the medallion's star points — `app.config.ts`'s
  `android.adaptiveIcon.backgroundColor` supplies the background this
  composites onto
- `splash.png` — 1242×2436, logo centered on the brand background at
  cold start (`resizeMode: "contain"`)

Regenerate from the source logo if the brand mark ever changes — see
the generation script in the Phase 12 session history, or recreate with
any image tool: flatten for `icon.png`, pad to ~60% content size on a
transparent canvas for `adaptive-icon.png`, center at ~32% of the
shorter dimension on the brand background for `splash.png`.
`npx expo install` won't regenerate these — swap the files directly.
