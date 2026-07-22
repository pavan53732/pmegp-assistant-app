# Branding Assets — Canonical Source

This directory holds the **single source of truth** for the PMEGP Assistant brand
imagery. All platform-specific icons (Android launcher, adaptive, splash, iOS,
PWA) are generated from these two files by `@capacitor/assets`.

## Source files

| File | Purpose |
|------|---------|
| `logo.svg` | Hand-crafted vector (primary). Used directly as the web favicon + app header. |
| `logo.png` | 1024×1024 RGBA PNG rasterized from `logo.svg`. Source for `@capacitor/assets`. |

## Regenerate all platform assets

```bash
# PWA (web icons + manifest entries)
bunx @capacitor/assets generate --pwa \
  --iconBackgroundColor "#064e3b" --iconBackgroundColorDark "#064e3b" \
  --splashBackgroundColor "#064e3b" --splashBackgroundColorDark "#064e3b"

# Android (launcher + adaptive + splash, all densities)
bunx @capacitor/assets generate --android \
  --iconBackgroundColor "#064e3b" --iconBackgroundColorDark "#064e3b" \
  --splashBackgroundColor "#064e3b" --splashBackgroundColorDark "#064e3b"

# iOS (when iOS platform is added)
bunx @capacitor/assets generate --ios \
  --iconBackgroundColor "#064e3b" --iconBackgroundColorDark "#064e3b" \
  --splashBackgroundColor "#064e3b" --splashBackgroundColorDark "#064e3b"
```

## After generation

- PWA icons land in `public/icons/` (served at `/icons/`)
- Android resources land in `android/app/src/main/res/`
- iOS resources land in `ios/App/App/Assets.xcassets/`

The `public/manifest.webmanifest` and `index.html` reference the PWA icons.
The `capacitor.config.ts` `SplashScreen.androidSplashResourceName = "splash"`
references the Android `drawable*/splash.png` resources.
