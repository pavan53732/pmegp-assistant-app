# 13 — Security & Privacy

Status: draft for review · No application code yet
Related: [03-data-model.md](03-data-model.md) · [10-android-architecture.md](10-android-architecture.md) · [12-import-export-and-update.md](12-import-export-and-update.md) · [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md)

The app holds real citizen PII (applicant identity, financial data) entirely on-device, with no accounts and no server of ours. That shape removes some risks (no server breach surface, no upload) and concentrates others (device loss, local key handling). This document defines the posture.

---

## 1. Threat model (what we protect against)

| In scope | Out of scope / N/A |
|---|---|
| Lost/stolen device exposing PII | Server breach (there is no server of ours) |
| API key leaking to logs/exports/network | Account takeover (there are no accounts) |
| Tampered rule/data packs altering money math | Mass data exfiltration (nothing is uploaded) |
| Prompt-injection via user/OCR input | Cross-user data leakage (single-device, no multi-tenancy) |
| PII leaking into AI prompts or logs | — |

---

## 2. Data classification

- **Sensitive PII** — applicant name, identifiers, contact, category, financial figures. On-device only.
- **Secret** — the user's AI API key.
- **Reference data** — Knowledge Package (not secret, but integrity-critical).
- **Derived** — engine outputs and generated DPRs (contain PII).

---

## 3. Encryption at rest

- The SQLite database is **encrypted at rest** (e.g. SQLCipher-class encryption or platform-backed encryption).
- The database encryption key is held in **Android Keystore / secure storage**, not in plain app files or source.
- Backups produced by the Import/Export Engine are **encrypted** as well.

---

## 4. API key handling (strict)

The AI API key is the one long-lived secret in the app. Rules:

1. Stored in **secure storage (Android Keystore-backed)**, encrypted — never in plain SQLite, preferences, or files.
2. **Never written to logs**, crash reports, or analytics (there are no analytics).
3. **Never exported or backed up** (see [12](12-import-export-and-update.md) A4).
4. Sent **only** to the user-configured AI endpoint, over HTTPS, directly from the device.
5. The "Test connection" action validates it without persisting it anywhere else.

---

## 5. The only external call

There is exactly one outbound network path in normal operation: **device → user-configured AI endpoint** (optional). Plus the optional, user-initiated **signed data-pack fetch** (Update Engine), which carries no PII and no key. Nothing else phones home; there is no server of ours to phone.

---

## 6. PII and the AI layer

- PII is **minimized** before inclusion in any prompt — send only what the interview/writing task needs.
- PII is **redacted/masked before any logging** (dev logs included).
- The user's data is never sent to any provider unless the user has configured AI and initiated an action that requires it.
- The user should be able to run the entire app without AI configured and never transmit anything.

---

## 7. First-run transparency notice (not a consent gate)

On first launch, show a one-time notice:

> "This application stores your project information only on your device. No applicant data is uploaded automatically."

With **OK** / **Don't show again**. This is transparency appropriate to an offline tool — deliberately **not** a cloud-style consent flow, which would misrepresent the app as an online service. On-device PII is still encrypted regardless of the notice.

---

## 8. Untrusted input (prompt injection & OCR)

- User answers, OCR-extracted text, and any AI output are **data, not instructions**.
- Authority lives in **code** (the engines), never in prompts, so a manipulated prompt cannot change an eligibility verdict or a financial figure.
- All such input passes through Zod validation before it can affect state.

---

## 9. Integrity of rule data

- Knowledge Package updates are **signature-verified before apply** (mandatory) — see [12](12-import-export-and-update.md) B3. This prevents a tampered pack from silently corrupting money calculations.

---

## 10. Device-loss mitigations

- Encryption at rest protects data if the device is lost.
- Optional **biometric/local unlock** can gate app access (see [10](10-android-architecture.md)).
- The Import/Export Engine lets users keep encrypted backups so loss ≠ total loss.

---

## 11. Compliance note (India DPDP)

The design is privacy-favorable by construction: local-only storage, no upload, no accounts, explicit user control over exports/sharing. Formal DPDP review is a product responsibility; this architecture supports it (data minimization, on-device processing, user-held data) rather than working against it.
