# 11 — OCR Architecture

Status: draft for review · No application code yet
Related: [10-android-architecture.md](10-android-architecture.md) · [03-data-model.md](03-data-model.md) · [13-security-and-privacy.md](13-security-and-privacy.md) · [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md)

---

## 1. Purpose

OCR lets a user photograph a document (quotation, invoice, applicant document) and extract structured fields into the app instead of typing them. This speeds up data entry in the field.

Per [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md): OCR is **on-device**. Documents never leave the phone, and OCR works with no network.

---

## 2. Why on-device (not cloud)

- **Offline-first** — works in villages with no connectivity.
- **Privacy** — quotations/invoices/applicant documents contain PII and pricing; they must not be shipped to a cloud service. On-device keeps them on the device.
- Consistent with "the only external call is app → user's AI."

Trade-off accepted: on-device OCR may be less accurate than cloud OCR. Mitigated by always showing extracted fields for **human review/correction** before use (see §5).

---

## 3. Flow

```
Camera (Capacitor)
   │  capture image (stored in app storage)
   ▼
On-device OCR (ML Kit text recognition / Tesseract-class)
   │  raw text + layout
   ▼
Field Extraction (deterministic parsing + heuristics)
   │  candidate fields
   ▼
Review Screen  ── user confirms / edits ──►  Structured data → SQLite
```

---

## 4. Engine choice (to finalize at implementation)

| Option | Notes |
|---|---|
| Google ML Kit text recognition (on-device) | Good accuracy, fast, on-device; via a Capacitor plugin/bridge. |
| Tesseract (on-device) | Fully open, bundled; heavier, tune per document type. |

Constraints regardless of choice: **fully on-device**, no network, models/data bundled or downloaded once via the signed Update path — never per-document cloud calls.

---

## 5. Extraction is assistive, never authoritative

- OCR output is **untrusted input** (like AI input): it is data, never instructions, and never bypasses validation.
- Extracted fields are always presented for **human confirmation** before entering SQLite. The user is the authority on what a quotation says.
- **OCR never feeds numbers directly into the Financial Engine without confirmation.** A misread price must not silently change a calculation. Confirmed values flow through the same validation (Zod) as manual entry.

---

## 6. What gets extracted (typical)

- **Quotations / invoices** — supplier, item, quantity, unit price, total, date.
- **Applicant documents** — name and identifiers where the user chooses to capture them (PII — handled per [13](13-security-and-privacy.md)).

Extracted attachments and their fields are stored on-device (see `attachment` in [03-data-model.md](03-data-model.md)).

---

## 7. Privacy handling

- Captured images and extracted text are **on-device only**, encrypted at rest with the rest of app data.
- OCR text is **not** sent to the AI provider unless the user explicitly initiates an AI action that needs it, and even then PII is minimized.
- Images can be deleted by the user; deletion removes them from app storage.

---

## 8. Boundaries

- OCR does **not** calculate, decide eligibility, or write prose.
- OCR does **not** perform network I/O.
- OCR feeds **reviewed** structured data into the normal data flow; downstream engines cannot tell OCR-sourced data from typed data once confirmed.
