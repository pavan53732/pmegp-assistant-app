# 12 — Import/Export Engine & Update Engine

Status: draft for review · No application code yet
Related: [03-data-model.md](03-data-model.md) · [09-knowledge-package.md](09-knowledge-package.md) · [13-security-and-privacy.md](13-security-and-privacy.md) · [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md)

Two related but distinct engines. **Import/Export** moves *user data* in and out. **Update** brings *reference data* (the Knowledge Package) up to date. Both are first-class because, with no cloud, they are the app's only durability and freshness mechanisms.

---

# Part A — Import/Export Engine

## A1. Why it is first-class

There is no server backup. If a CSC operator prepares 40 DPRs and their phone breaks, **without export/backup everything is lost.** So this engine *is* the durability story, not a convenience feature.

## A2. Capabilities

| Capability | Description |
|---|---|
| **Export project** | Serialize one project (profile, financials snapshot, DPR data, attachments refs) to a portable JSON file. |
| **Import project** | Read a project JSON back into SQLite, with validation and version checks. |
| **Backup** | Full encrypted copy of the SQLite database for device-to-device migration. |
| **Restore** | Re-import a backup, replacing/merging local data (user-confirmed). |
| **Share** | Send an exported project to another consultant via the Android share sheet. |

## A3. Format & integrity

- Exports are **versioned JSON** carrying `schema_version`, `scheme_code`, and the `knowledge_version` the data referenced — so an import knows how to interpret it.
- Imports **validate against Zod schemas** before touching SQLite; a malformed or tampered file is rejected, not partially applied.
- Money and figures are carried as stored (integer units), never re-derived on import.

## A4. Privacy rules (critical)

- **The AI API key is NEVER exported or backed up.** It stays in secure storage only (see [13](13-security-and-privacy.md)).
- Project exports contain PII → the exported file is treated as sensitive; backups are **encrypted**; the user controls where files go and is reminded they contain personal data.
- Sharing is an explicit, user-initiated action through the OS share sheet — nothing is shared automatically.

## A5. Boundaries

- Does not calculate, decide eligibility, or write prose.
- Does not perform network I/O — files go through the device filesystem/share sheet, not to any server of ours.

---

# Part B — Update Engine

## B1. Purpose

Centralizes bringing the **Knowledge Package** (rules, ceilings, negative list, templates, NIC codes, prompt templates, etc.) up to date, instead of scattering update logic across the app. Because PMEGP rules change by government notification, this keeps a correct-at-launch app correct over time.

## B2. Flow

```
Check for update      (optional network; user-initiated or on app start if online)
      │
      ▼
Download data pack    (signed bundle)
      │
      ▼
VERIFY SIGNATURE      ◀── MANDATORY. Reject if signature invalid.
      │
      ▼
Validate schema/version
      │
      ▼
Apply to SQLite       (new knowledge_version recorded)
```

## B3. Signature verification is mandatory

Rule packs drive money calculations, so an unverified or tampered pack is both a **tamper risk and a correctness risk**. Therefore:

- Every data pack is **cryptographically signed**; the app verifies the signature against a bundled public key **before** applying anything.
- A pack that fails verification is discarded; the current knowledge version is retained.
- Verification and application are atomic — a partial/failed apply never leaves SQLite in a mixed-version state.

## B4. Non-disruption of existing documents

- Updating the Knowledge Package **never silently rewrites already-produced DPRs.** Each DPR keeps the `knowledge_version` it was generated with (reproducibility triple, [03](03-data-model.md)).
- The user can regenerate a project against a newer version deliberately; it never happens behind their back.

## B5. Offline behavior

- Updates are **optional**. With no connectivity, the app keeps using the bundled/last-applied Knowledge Package indefinitely.
- Outputs surface "rules current as of <date>" from the active knowledge version so users know their basis.

## B6. Boundaries

- The Update Engine only manages reference data; it never touches user project data (that is Import/Export).
- It performs the one narrowly-scoped network action of fetching a signed pack — this is **not** a backend of ours; it is a static, signed artifact source, and the app never depends on it to function.

> Note: the pack **distribution source** (where signed packs are hosted) is a deployment/content decision, not an app-runtime dependency. The app must run forever on bundled data if no update is ever fetched.
