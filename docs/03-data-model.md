# 03 — Data Model (On-Device SQLite)

> Status: draft for review. No application code. See [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md).

SQLite on the device is the **single source of truth**. There is no server database. All
entities below live on the user's device and are encrypted at rest. Nothing here is
uploaded automatically.

## Relationship to the Structured Project Profile

The **Structured Project Profile** is the application-level data contract between the
interview layer and all downstream engines. Its canonical schema is defined in
[16 — AI Interview & Project Discovery Architecture](16-ai-interview-and-project-discovery.md)
(Section 2).

This document describes the **persistence-level** SQLite schema — how the profile data
is stored on-device. The two are a 1:1 mapping: the `applicant` entity stores the
`ProjectProfile.applicant` section, the `project` entity stores `business`, `location`,
`land`, `capacity`, `financials`, and `completion` sections, and so on. The confidence
metadata (`ProjectProfile.confidence`) maps to columns and companion tables within the
project schema.

The profile schema (doc 16) is what engines and features *work with*. The SQLite
schema (this document) is how data *lives on disk*. They serve different readers but
describe the same information.

## Design rules for the data model

1. **Everything is local.** No foreign keys to server-side identity; there is no server.
2. **PII lives only in the tables that need it**, so it can be masked/redacted in one place.
3. **Money is never stored as floating point.** Store integer paise (₹1 = 100 paise) or
   integer rupees; the Financial Engine decides the unit and it is documented per column.
   Never store a computed financial figure as a float.
4. **Scheme-parameterized.** Rows that depend on scheme rules carry a `scheme_code`
   (e.g. `PMEGP`) so a second scheme can be added without a schema rewrite.
5. **Knowledge is versioned separately from user data.** The Bundled Knowledge Package and
   any downloaded data packs are read-mostly reference data, versioned by `knowledge_version`.

## Entity groups

### A. User project data (created by the user, holds PII)
- **applicant** — name, contact, category (SC/ST/OBC/General/Minority/Ex-servicemen/PH),
  district, mandal, PIN, urban/rural, education, age. *(PII — encrypted, masked in logs.)*
- **project** — business activity, NIC code ref, location, land status (own/rented),
  employees, expected monthly production, machinery budget, working capital, `scheme_code`,
  status (draft/complete), timestamps.
- **project_financials** — the engine outputs snapshotted for a project: project cost,
  subsidy, bank loan, own contribution, EMI, DSCR, break-even, P&L summary, cash-flow summary.
  Stored as integers. These are *engine outputs*, never AI-written.
- **dpr_document** — generated DPR content: the structured section data + which template +
  which knowledge_version + which engine-output snapshot produced it (for reproducibility).
- **attachment** — OCR'd quotations/invoices and their extracted fields, stored on-device.

### B. AI configuration (holds a secret)
- **ai_provider_config** — Base URL, Model Name, and the API key. The **API key is stored
  encrypted** and is never written to logs, never included in exports, never sent anywhere
  except directly to the user-configured endpoint. One active config; user can save/test.

### C. Reference data (read-mostly, from the Knowledge Package / data packs)
- **scheme** — scheme_code, display name, active flag, knowledge_version.
- **rule_set** — scheme rules (subsidy matrix, ceilings, own-contribution %, eligibility
  criteria, negative list) keyed by scheme_code + version + "effective as of" date.
- **activity / nic_code / machinery / raw_material / bank / template / circular / faq** —
  the reference tables that back the Knowledge Engine.
- **prompt_template** — default prompt templates for the AI interviewer and writer.

### D. App/meta
- **app_meta** — installed knowledge_version, first-run-notice acknowledged flag, schema
  migration version, last update-check timestamp.

## Reproducibility invariant

A generated DPR must record the triple **(knowledge_version, template id, engine-output
snapshot id)** so the same project can be regenerated identically, and so a rule change is
never silently applied to an already-produced document.

## Backup / restore (see [12-import-export-and-update.md](12-import-export-and-update.md))

- **Export project** → JSON containing group A + the referenced reference-data versions
  (not the whole knowledge package). **The API key is never exported.**
- **Backup** → full SQLite copy for device-to-device migration. Encrypted; the user controls
  where it goes. **Restore** re-imports it.

## Open questions for review
- Store money as integer paise or integer rupees? (Recommendation: paise, format at the edge.)
- Should backups include the AI key if the user opts in, or never? (Recommendation: never.)
