# Placeholder assets

`icon.png`, `adaptive-icon.png`, and `splash.png` are programmatically
generated placeholders (a plain terracotta/gold circle on the brand
background) — they exist only so `expo start`/`eas build` doesn't fail
looking for a missing file. Replace them with real brand assets before
any real build:

- `icon.png` — 1024×1024, no transparency, iOS/Android app icon
- `adaptive-icon.png` — 1024×1024, transparent background, the
  foreground layer of the Android adaptive icon (`app.config.ts`'s
  `android.adaptiveIcon.backgroundColor` supplies the background)
- `splash.png` — sized for `resizeMode: "contain"`, shown at cold start

`npx expo install` won't regenerate these — swap the files directly.
