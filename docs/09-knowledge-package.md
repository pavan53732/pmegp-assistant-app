# 09 — Bundled Knowledge Package

Status: draft for review · No application code yet
Related: [06-eligibility-engine.md](06-eligibility-engine.md) · [05-financial-engine.md](05-financial-engine.md) · [12-import-export-and-update.md](12-import-export-and-update.md) · [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md)

---

## 1. Purpose

The Knowledge Package is the **reference-data pack that ships inside the APK** so the app is fully useful the moment it is installed — with no network. It is the offline source of truth for the Knowledge Engine and supplies the scheme parameters the deterministic engines consume.

It is **not just "rules."** Calling it a Knowledge Package keeps the design honest and future-proof.

---

## 2. Contents

```
Knowledge Package
├── PMEGP Rules            # eligibility criteria, subsidy matrix, ceilings, own-contribution %, negative list
├── Activities             # permitted activity catalog
├── NIC Codes              # National Industrial Classification mapping (4 files, normalized schema)
│   ├── Manufacturing      # ~700 entries, sector: MANUFACTURING
│   ├── Service-Service    # ~970 entries, sector: SERVICE, subCategory: SERVICE
│   ├── Service-Trading    # ~22 entries, sector: SERVICE, subCategory: TRADING
│   └── Service-Transport  # ~33 entries, sector: SERVICE, subCategory: TRANSPORT
├── Machinery Database     # common machinery, indicative specs
├── Raw Material Database   # common raw materials
├── Banks                  # bank/branch reference data
├── Templates              # DPR templates, PDF layouts, checklist templates
├── Sample DPRs            # reference examples
├── FAQ                    # common questions
├── Circulars              # relevant notifications/circulars text
├── Financial Ratios       # default/benchmark ratios used in projections
├── Validation Rules       # field validation constraints
└── Default Prompt Templates  # interviewer + writer prompt scaffolds
```

### NIC Code data structure

PMEGP accepts two main sectors: **Manufacturing** and **Service**. Trading and Transport are not standalone sectors — certain trading and transport activities are accepted under the Service sector only. Each NIC entry has a normalized schema:

```json
{
  "nicCode": "181101",
  "description": "Printing of newspapers, books, periodicals, maps, etc.",
  "sector": "MANUFACTURING",
  "subCategory": "MANUFACTURING"
}
```

Fields:
- `nicCode` — 6-digit NIC classification code
- `description` — human-readable activity description
- `sector` — `"MANUFACTURING"` or `"SERVICE"` (determines cost ceiling)
- `subCategory` — `"MANUFACTURING"`, `"SERVICE"`, `"TRADING"`, or `"TRANSPORT"`

Source: Official PMEGP Portal (kviconline.gov.in). A metadata file records source, version date, and schema definition.

---

## 3. Versioning & provenance

- The whole package carries a **`knowledge_version`** and, for rule-bearing data, an **"effective as of" date** and a **source citation** (guideline clause / circular reference).
- Engines record which `knowledge_version` produced a given result (the reproducibility triple in [03-data-model.md](03-data-model.md)), so any figure is traceable to the rule version behind it.
- Because PMEGP parameters are set by KVIC/MoMSME and revised by notification, values are treated as **data with provenance**, never hardcoded in engine logic. Authoritative values must be sourced during package authoring.

---

## 4. Scheme parameterization

The package is keyed by `scheme_code` (PMEGP today). The subsidy matrix, ceilings, own-contribution %, negative list, and criteria all live under the scheme key. Adding a scheme later = adding a new keyed dataset, not editing engine code. This is the multi-scheme seam at the data layer.

---

## 5. Runtime model

- **Read-mostly.** At runtime the package is reference data; the app reads it and never mutates it as part of normal use.
- **Loaded into SQLite** (or read directly, decided at implementation) on first run, tagged with `knowledge_version` so the app knows what it has.
- Separate from **user project data** (which the user creates and edits). Backups of user data reference the knowledge version used, but do not need to duplicate the whole package.

---

## 6. Updates (see [12](12-import-export-and-update.md))

- Updates arrive as **signed data packs** via the Update Engine.
- The signature is **verified before** the pack is applied to SQLite — mandatory, because rule packs drive money calculations, so an unverified pack is both a tamper risk and a correctness risk.
- An update never silently rewrites already-produced DPRs; existing documents keep the `knowledge_version` they were generated with.

---

## 7. Authoring responsibility & disclaimer

- Package authoring is a **content task requiring authoritative sourcing** (official PMEGP guidelines, KVIC circulars). It is out of scope for code generation and must be reviewed by someone who can verify the numbers.
- Outputs derived from the package should carry a "rules current as of <date>; verify against latest guidelines" note, since scheme parameters change.

---

## 8. Boundaries

- The package is **data**, not logic. It contains no calculation code.
- Engines depend on the package's *shape* (typed schema in `shared/types`), not on any single hardcoded value.
- The Knowledge Engine serves this data to features; it does not compute financials or eligibility itself.

### Data vs Code boundary

| Belongs in Knowledge Package (data) | Belongs in engines/ (code) |
|------|------|
| Interest rates, subsidy %, own-contribution % | EMI formula, DSCR formula, break-even formula |
| Age rules, education rules, project ceilings | Eligibility determination logic |
| Negative list entries | Negative-list checking algorithm |
| DPR section names and required inputs | AI prompt behavior (temperature, min words) |
| Field schema (name, type, validation, required) | Interview flow / question branching |
| Portal field mapping | Workflow orchestration |

### File organization principle

Separate datasets by **domain ownership**, not by file size:
- Each file represents an independent knowledge domain (updated independently, sourced from a distinct authority)
- Related constants (project limits, margin money, EDP, age, education, own-contribution defaults) consolidate into a single `pmegp_rules.json`
- Don't split one domain into many files; don't merge unrelated domains into one file
- Create files only when actual data is available — no empty scaffolds

### Target folder structure (created incrementally as data is sourced)

```
src/knowledge-package/
├── metadata.json              # version, source, schema definitions
├── activities/
│   ├── manufacturing.json     # ~700 NIC entries
│   ├── service.json           # ~970 NIC entries
│   ├── trading.json           # ~22 NIC entries (under Service)
│   └── transport.json         # ~33 NIC entries (under Service)
├── rules/
│   ├── pmegp_rules.json       # ceilings, margin money, EDP, age, education, collateral, scheme version
│   ├── subsidy_matrix.json    # category × area subsidy percentages
│   ├── eligibility_rules.json # criteria by category
│   └── negative_list.json     # prohibited activities
├── mappings/
│   └── portal_mapping.json    # profile field → portal field → DPR field
├── templates/
│   ├── dpr_sections.json      # section structure, required inputs
│   └── narrative_templates/   # prose templates for AI writer
└── knowledge/
    ├── glossary.json          # PMEGP terminology
    └── faq.json               # common questions
```
