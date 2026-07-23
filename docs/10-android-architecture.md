# 10 — Android Architecture (Capacitor)

Status: draft for review · No application code yet
Related: [01-system-architecture.md](01-system-architecture.md) · [11-ocr-architecture.md](11-ocr-architecture.md) · [13-security-and-privacy.md](13-security-and-privacy.md) · [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md)

---

## 1. Approach

The app is a **web app (React 19 + TS + Vite) packaged as a native Android app via Capacitor 8**. The web layer is the UI and orchestration; Capacitor bridges to native Android capabilities (camera, filesystem, secure storage, share).

Why Capacitor rather than React Native (recorded decision):
- The app is **form- and document-heavy**, which suits web technologies.
- A **future web/admin/desktop** surface can reuse the same UI without a rewrite.
- Capacitor gives good native Android integration while keeping a single codebase.

Everything still honors offline-first: the WebView runs local bundled assets, not a remote site.

---

## 2. Layer mapping to Android

```
React UI (WebView)
   │  Capacitor bridge
   ▼
Native Android capabilities
   • Camera          → OCR capture (see doc 11)
   • Filesystem      → save/read PDFs, backups, exports
   • Secure storage  → encrypted AI key + encryption keys (see doc 13)
   • Share sheet     → share PDF / exported project
   • (optional) Biometrics → gate access to the app / secure store
```

The deterministic engines and SQLite access run inside the web/JS layer; only device-integration concerns cross the Capacitor bridge.

---

## 3. Capacitor plugins (planned)

| Capability | Plugin (indicative) | Use |
|---|---|---|
| Local database | SQLite plugin (e.g. `@capacitor-community/sqlite`) | On-device source of truth |
| Camera | Camera plugin | Capture quotations/invoices for OCR |
| Filesystem | Filesystem plugin | Store PDFs, backups, JSON exports |
| Secure storage | Secure-storage/keystore plugin | Encrypt AI API key + DB key via Android Keystore |
| Share | Share plugin | Send PDF/exports through Android share sheet |
| Preferences | Preferences plugin | Small flags (first-run notice ack, etc.) |
| Biometrics (optional) | Biometric-auth plugin | Optional local unlock |

Exact plugin choices finalized at implementation; constraints: actively maintained, Capacitor-7 compatible, offline-capable.

---

## 4. Storage layout on device

- **SQLite DB** — encrypted, in app-private storage (see [03-data-model.md](03-data-model.md), [13](13-security-and-privacy.md)).
- **Generated PDFs** — app storage, shareable via share sheet.
- **Exports/backups** — user-directed location; **never contain the AI API key**.
- **Bundled Knowledge Package** — read-only assets shipped in the APK.

---

## 5. Offline & lifecycle

- App fully functional offline; the only optional network path is the WebView → user-configured AI endpoint (via the provider layer), not through any server of ours.
- Long operations (PDF render, OCR) run without blocking the UI where possible; state persists to SQLite so a killed/relaunched app resumes safely.

---

## 6. Build & distribution (documentation only)

- Output is a signed **APK** (and/or AAB) built from the Capacitor Android project.
- App signing keys are the developer's responsibility and are **not** stored in the repo.
- No backend endpoint is configured in the build — there is none.

---

## 7. Permissions posture

Request only what's needed, when needed:
- **Camera** — only for OCR capture, requested at first use.
- **Storage** — scoped to app storage / user-chosen export locations.
- No location, contacts, or network-identity permissions are required for core function.

---

## 8. Boundaries

- Native bridge code carries **no business logic** — engines stay in the portable JS layer so they remain testable without a device.
- The Android layer never introduces a server dependency.
