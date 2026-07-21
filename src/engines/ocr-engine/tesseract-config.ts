// ─── Tesseract.js Local Asset Configuration ────────────────────────────────
// Centralises the local (offline) paths for the three asset classes that
// tesseract.js v5 needs to run without fetching from a CDN:
//
//   1. workerPath          — the Web Worker script (worker.min.js, ~120KB)
//   2. corePath            — the WASM core loader (tesseract-core-simd.wasm.js,
//                            ~4.6MB) which in turn fetches the matching
//                            tesseract-core-simd.wasm (~3.3MB) from the same
//                            directory.
//   3. langPath            — directory prefix where Tesseract looks for the
//                            `<lang>.traineddata.gz` files. For "eng" it will
//                            request `${langPath}/eng.traineddata.gz` (~11MB).
//
// All three assets live under `public/tesseract/` and are therefore served by
// Vite at the root paths below. Because they are bundled with the app, OCR is
// fully offline — the first OCR call no longer fetches ~10MB from unpkg /
// jsDelivr / tessdata.projectnaptha.com.
//
// See `public/tesseract/README.md` for download URLs, licensing, and the
// CI/CD pre-build step that fetches these files (they are git-ignored due to
// their size: ~19MB total).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Local asset paths for offline Tesseract.js operation.
 *
 * Assets are bundled under `/public/tesseract/` and served at `/tesseract/`.
 * Paths are absolute (root-relative) so they resolve identically in the Vite
 * dev server, the production web build, and the Capacitor WebView (which
 * serves the same `dist/` tree via the `capacitor://` / `https://localhost`
 * origin).
 */
export const TESSERACT_CONFIG = {
  /** Worker script — small (~120KB), committed-capable but git-ignored here. */
  workerPath: "/tesseract/worker.min.js",

  /**
   * Core WASM loader script. tesseract.js loads this script, which then
   * instantiates `tesseract-core-simd.wasm` from the SAME directory. We use
   * the SIMD build for modern devices (faster); a non-SIMD fallback
   * (`tesseract-core.wasm.js`) can be substituted on very old WebViews if
   * needed.
   */
  corePath: "/tesseract/tesseract-core-simd.wasm.js",

  /**
   * Directory prefix for language training data. Tesseract.js appends
   * `/<lang>.traineddata.gz` to this when `createWorker("eng", ...)` is
   * called, so for English it requests `/tesseract/eng.traineddata.gz`.
   */
  langPath: "/tesseract",
} as const;
