# 08 — PDF Engine

Status: draft for review · No application code yet
Related: [07-dpr-engine.md](07-dpr-engine.md) · [09-knowledge-package.md](09-knowledge-package.md) · [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md)

---

## 1. Purpose

The PDF Engine renders a structured `DprDocument` (and other structured outputs) into a finished PDF file **entirely on-device**. It is the last stage of the pipeline and produces the artifact the user hands to a bank.

Per [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md) principle 2 & the client-side-PDF decision: **PDF generation happens on the device, offline, with no server.** No document bytes ever leave the phone.

---

## 2. What it renders

- **DPR** — the full detailed project report (all sections from the DPR Engine).
- **Project Profile** — a shorter summary sheet.
- **Financial Statements** — project cost, means of finance, EMI/repayment schedule, P&L, cash flow, balance sheet, DSCR, break-even (tables).
- **Quotations** — machinery/equipment quotation sheets (may incorporate OCR-captured data).
- **Checklists** — application/document checklists from the Knowledge Package.

---

## 3. Inputs & output

```
renderPdf(doc: RenderableDocument, options: PdfOptions): PdfArtifact

RenderableDocument   // DprDocument or another structured, render-agnostic object
PdfOptions {
  templateId: string          // layout/branding template (from Knowledge Package)
  pageSize: "A4"              // default; configurable
  locale: string              // i18n seam (English now)
  includeAnnexures: boolean
}
PdfArtifact {
  bytes / fileUri             // written to on-device storage via Capacitor Filesystem
  meta: { pages, generatedAt, knowledgeVersion, templateId }
}
```

The engine consumes the **already-assembled, already-verified** `DprDocument`. It does not calculate, does not call AI, and does not re-fetch content. All numbers arriving here have already passed the DPR Engine's number-integrity check.

---

## 4. Determinism

Given the same `RenderableDocument` + `PdfOptions` + fonts, the PDF Engine produces layout-equivalent output every time. It introduces **no new data** — it only lays out what it is given. Any timestamp or page-count is derived, not invented content.

---

## 5. Technology approach (to be finalized at implementation)

Because rendering is on-device inside a Capacitor/WebView app, the realistic options are:

| Approach | Notes |
|---|---|
| HTML/CSS → PDF (client-side lib, e.g. a print-to-PDF or pdf-lib/jsPDF-style path) | Reuses React/HTML templating; good for text-heavy DPRs; must bundle fonts for Indian scripts if ever localized. |
| Template + programmatic layout (pdf-lib style) | More control over tables/financial statements; more code. |
| Capacitor plugin bridging a native Android PDF path | Best fidelity/perf; adds native surface. |

Decision deferred to implementation and recorded here when made. Constraints that hold regardless:
- **Fully offline**, no remote fonts/assets — everything bundled.
- **Deterministic layout** for reproducibility.
- Tables (financial statements) must paginate cleanly.
- Output must be shareable via the Android share sheet (Capacitor Share) and saved to device storage.

---

## 6. Fonts & localization

- Fonts are **bundled in the APK** (no network fetch), consistent with offline-first.
- English now, but templates use i18n string keys (seam kept). If Indian-language rendering is added later, the corresponding fonts must be bundled and the PDF path must support the script.

---

## 7. Boundaries

- Does **not** compute anything (Financial Engine) or assemble content/order (DPR Engine).
- Does **not** call AI providers.
- Does **not** perform network I/O of any kind.
- Only reads bundled templates/fonts and the structured document handed to it; writes the resulting file to on-device storage.

---

## 8. Testability

- Given a fixed `DprDocument` fixture, rendering runs with **no AI and no network**.
- Snapshot/structural tests assert the rendered document contains exactly the figures present in the source `financials` (defense-in-depth alongside the DPR Engine's check).
- Pagination tests for long repayment/P&L tables.
