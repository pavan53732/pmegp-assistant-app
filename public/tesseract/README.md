# Tesseract.js — Local (Offline) Assets

This directory holds the three asset classes that **tesseract.js v5** needs to
run **fully offline** — i.e. without fetching ~10 MB from a CDN (`unpkg` /
`jsDelivr` / `tessdata.projectnaptha.com`) on the first OCR call. They are
loaded by `src/engines/ocr-engine/index.ts` (via
`src/engines/ocr-engine/tesseract-config.ts`) using local, root-relative
paths so they resolve identically in:

- the Vite dev server (`http://localhost:5173/`),
- the production web build (`dist/`),
- the Capacitor 7 WebView (`capacitor://localhost/` on Android).

## Files required

| File                             | Size   | Purpose                                   |
| -------------------------------- | ------ | ----------------------------------------- |
| `worker.min.js`                  | ~120 KB | tesseract.js Web Worker script            |
| `tesseract-core-simd.wasm.js`    | ~4.6 MB | WASM core loader (SIMD build)             |
| `tesseract-core-simd.wasm`       | ~3.3 MB | The actual WebAssembly module (SIMD)      |
| `eng.traineddata.gz`             | ~11 MB  | English language training data (gzipped)  |

**Total: ~19 MB.** These are git-ignored (see `.gitignore`) because of their
size. They MUST be fetched as a pre-build step (see **CI/CD** below).

## Download (one-time / pre-build)

Run from the repository root (`/home/z/my-project`):

```bash
mkdir -p public/tesseract

# Worker script
curl -sL "https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js" \
  -o public/tesseract/worker.min.js

# Core (SIMD version for modern devices)
curl -sL "https://unpkg.com/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js" \
  -o public/tesseract/tesseract-core-simd.wasm.js
curl -sL "https://unpkg.com/tesseract.js-core@5.1.1/tesseract-core-simd.wasm" \
  -o public/tesseract/tesseract-core-simd.wasm

# English language data
curl -sL "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz" \
  -o public/tesseract/eng.traineddata.gz
```

### Verifying integrity

After download, sanity-check the magic bytes:

```bash
# worker.min.js & tesseract-core-simd.wasm.js → ASCII ("/*! For …" / "\nvar …")
# tesseract-core-simd.wasm                    → 00 61 73 6d (WebAssembly magic)
# eng.traineddata.gz                          → 1f 8b       (gzip magic)
od -A x -t x1z -v public/tesseract/tesseract-core-simd.wasm | head -1
od -A x -t x1z -v public/tesseract/eng.traineddata.gz       | head -1

# And verify the gzip stream is intact:
gunzip -t public/tesseract/eng.traineddata.gz && echo "gz OK"
```

## Fallback (non-SIMD) core

If you target a WebView that does **not** support WebAssembly SIMD (rare for
Android System WebView ≥ 2021, but possible on very old devices), swap the
SIMD build for the non-SIMD one in `tesseract-config.ts`:

```ts
corePath: "/tesseract/tesseract-core.wasm.js",
```

…after also downloading:

```bash
curl -sL "https://unpkg.com/tesseract.js-core@5.1.1/tesseract-core.wasm.js" \
  -o public/tesseract/tesseract-core.wasm.js
curl -sL "https://unpkg.com/tesseract.js-core@5.1.1/tesseract-core.wasm" \
  -o public/tesseract/tesseract-core.wasm
```

## Adding more languages

To support additional languages (e.g. Hindi `hin`, Tamil `tam`), drop the
matching `<lang>.traineddata.gz` next to `eng.traineddata.gz` and pass the
language code(s) to `createWorker("eng+hin", 1, { … })`. Language files live
at `https://tessdata.projectnaptha.com/4.0.0/<lang>.traineddata.gz`.

## CI/CD pre-build step

Because these assets are git-ignored, **the CI/CD pipeline (and any local
build) MUST run the download commands above before `vite build` / `npx cap
sync android`**. Suggested pipeline snippet (GitHub Actions):

```yaml
- name: Fetch Tesseract offline assets
  run: |
    mkdir -p public/tesseract
    curl -sL "https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js" -o public/tesseract/worker.min.js
    curl -sL "https://unpkg.com/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js" -o public/tesseract/tesseract-core-simd.wasm.js
    curl -sL "https://unpkg.com/tesseract.js-core@5.1.1/tesseract-core-simd.wasm" -o public/tesseract/tesseract-core-simd.wasm
    curl -sL "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz" -o public/tesseract/eng.traineddata.gz
```

If this step is skipped, OCR will still work but will fall back to the CDN
fetch that we are trying to eliminate — and on a fully offline device it will
**fail**.

## Licensing

| Asset                       | License     | Source                                            |
| --------------------------- | ----------- | ------------------------------------------------- |
| `worker.min.js`             | Apache-2.0  | `tesseract.js` package — https://github.com/naptha/tesseract.js |
| `tesseract-core-simd.wasm*` | Apache-2.0  | `tesseract.js-core` package — https://github.com/naptha/tesseract.js-core |
| `eng.traineddata.gz`        | Apache-2.0  | Tesseract OCR engine trained data — https://github.com/tesseract-ocr/tessdata |

All three components are Apache-2.0 licensed and may be redistributed and
bundled freely, provided the LICENSE and NOTICE files (embedded as comments
at the top of `worker.min.js` and `tesseract-core-simd.wasm.js`) are retained.
The `.wasm` binary is machine code generated from the same Apache-2.0 source.
