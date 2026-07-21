# Traceability Matrix

Maps every major requirement to where it is **defined**, **detailed**, and **tested** across the architecture documentation set.

Governing document: [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md)

---

## Principle-level traceability

| # | Requirement | Defined in | Detailed in | Tested per |
|---|---|---|---|---|
| P1 | Offline-first, no mandatory internet | DESIGN_PRINCIPLES §1 | [01](01-system-architecture.md) §5, [10](10-android-architecture.md) §5 | [14](14-testing-strategy.md) §4 (AI/fallback matrix) |
| P2 | No backend or server of ours | DESIGN_PRINCIPLES §2 | [01](01-system-architecture.md) §6, [CLAUDE.md](../CLAUDE.md) rule 1 | [14](14-testing-strategy.md) §7 (import-boundary lint) |
| P3 | No mandatory login | DESIGN_PRINCIPLES §3 | [13](13-security-and-privacy.md) §7 (first-run notice) | [14](14-testing-strategy.md) §4 (component tests) |
| P4 | SQLite is the local source of truth | DESIGN_PRINCIPLES §4 | [03](03-data-model.md) (full schema) | [14](14-testing-strategy.md) §6 (import/export round-trip) |
| P5 | Deterministic calculations | DESIGN_PRINCIPLES §5 | [05](05-financial-engine.md), [06](06-eligibility-engine.md) | [14](14-testing-strategy.md) §2 (worked-example fixtures), §8 (determinism guards) |
| P6 | AI never invents financial figures | DESIGN_PRINCIPLES §6 | [04](04-ai-architecture.md) §6.1, [07](07-dpr-engine.md) §6 | [14](14-testing-strategy.md) §3 (number-injection guard tests) |
| P7 | AI is the primary experience, provider-independent, with guided fallback | DESIGN_PRINCIPLES §7 | [04](04-ai-architecture.md) §2, §3 | [14](14-testing-strategy.md) §4 (AI/fallback matrix) |
| P8 | Only external call is app → user's AI | DESIGN_PRINCIPLES §8 | [04](04-ai-architecture.md) §3.3, [13](13-security-and-privacy.md) §5 | [14](14-testing-strategy.md) §5 (API key never leaks), §7 (boundary lint) |
| P9 | Engines are independently testable | DESIGN_PRINCIPLES §9 | [02](02-modules-and-folder-structure.md) §3, [05](05-financial-engine.md), [06](06-eligibility-engine.md) | [14](14-testing-strategy.md) §1, §2 (engine unit tests) |
| P10 | Separation of UI, engines, providers | DESIGN_PRINCIPLES §10 | [02](02-modules-and-folder-structure.md) §2, [15](15-application-workflows.md) §9 | [14](14-testing-strategy.md) §7 (import-boundary lint) |
| P11 | Privacy-first local storage | DESIGN_PRINCIPLES §11 | [13](13-security-and-privacy.md) (full doc), [03](03-data-model.md) | [14](14-testing-strategy.md) §5 (security/privacy tests) |
| P12 | Scheme-parameterized | DESIGN_PRINCIPLES §12 | [02](02-modules-and-folder-structure.md) §4, [05](05-financial-engine.md) §scheme, [06](06-eligibility-engine.md) §6 | [14](14-testing-strategy.md) §2 (version fixtures) |
| P13 | Knowledge ships in the box, updates signed | DESIGN_PRINCIPLES §13 | [09](09-knowledge-package.md), [12](12-import-export-and-update.md) Part B | [14](14-testing-strategy.md) §5 (signature verification), §6 (update tests) |
| P14 | Project Completion & Validation gates engines | DESIGN_PRINCIPLES §14 | [04](04-ai-architecture.md) §5, [15](15-application-workflows.md) §1 step 2, §2 | [14](14-testing-strategy.md) §3a (validation engine tests) |
| P15 | AI questions originate from the Project Profile schema | DESIGN_PRINCIPLES §15 | [04](04-ai-architecture.md) §4, [15](15-application-workflows.md) §1 step 1 | [14](14-testing-strategy.md) §4 (AI/fallback matrix) |

---

## Feature-level traceability

| Feature | Architecture doc | Engine(s) used | Data entities | Workflow step |
|---|---|---|---|---|
| AI conversational interview | [04](04-ai-architecture.md) §4 | — (AI layer, not an engine) | applicant, project | [15](15-application-workflows.md) §1 step 1 |
| Structured form intake (fallback) | [04](04-ai-architecture.md) §2 | — | applicant, project | [15](15-application-workflows.md) §1 step 1 |
| Project validation gate | [04](04-ai-architecture.md) §5, [15](15-application-workflows.md) §2 | Validation Engine | project | [15](15-application-workflows.md) §1 step 2 |
| Eligibility check | [06](06-eligibility-engine.md) | Eligibility Engine | rule_set, scheme | [15](15-application-workflows.md) §1 step 3 |
| Financial computation | [05](05-financial-engine.md) | Financial Engine | project_financials | [15](15-application-workflows.md) §1 step 4 |
| AI narrative writing | [04](04-ai-architecture.md) §7 | — (AI layer) | dpr_document | [15](15-application-workflows.md) §1 step 5a |
| Number-injection guard | [04](04-ai-architecture.md) §7.1, [07](07-dpr-engine.md) §6 | DPR Engine | — | [15](15-application-workflows.md) §1 step 5a |
| DPR assembly | [07](07-dpr-engine.md) | DPR Engine | dpr_document | [15](15-application-workflows.md) §1 step 5b |
| PDF generation | [08](08-pdf-engine.md) | PDF Engine | — (file output) | [15](15-application-workflows.md) §1 step 6 |
| OCR capture & extraction | [11](11-ocr-architecture.md) | OCR Engine | attachment | [15](15-application-workflows.md) §5 |
| AI Settings (gear icon) | [04](04-ai-architecture.md) §3.1 | — | ai_provider_config | [15](15-application-workflows.md) §4 |
| Project export/share | [12](12-import-export-and-update.md) Part A | Import/Export Engine | applicant, project, project_financials | [15](15-application-workflows.md) §6 |
| Project import/restore | [12](12-import-export-and-update.md) Part A | Import/Export Engine | applicant, project, project_financials | [15](15-application-workflows.md) §7 |
| Knowledge Package update | [12](12-import-export-and-update.md) Part B, [09](09-knowledge-package.md) | Update Engine | rule_set, scheme, app_meta | [15](15-application-workflows.md) §8 |
| First-run notice | [13](13-security-and-privacy.md) §7 | — | app_meta | [15](15-application-workflows.md) §9 |

---

## Security requirement traceability

| Security requirement | Defined in | Enforced by | Tested per |
|---|---|---|---|
| API key encrypted in secure storage | [13](13-security-and-privacy.md) §4.1 | [10](10-android-architecture.md) §3 (Secure storage plugin) | [14](14-testing-strategy.md) §5 |
| API key never logged | [13](13-security-and-privacy.md) §4.2 | CLAUDE.md rule 2 | [14](14-testing-strategy.md) §5 |
| API key never exported/backed up | [13](13-security-and-privacy.md) §4.3, [12](12-import-export-and-update.md) A4 | Import/Export Engine | [14](14-testing-strategy.md) §5 |
| API key sent only to user's endpoint | [13](13-security-and-privacy.md) §4.4 | Provider Manager | [14](14-testing-strategy.md) §5, §7 |
| SQLite encrypted at rest | [13](13-security-and-privacy.md) §3 | [10](10-android-architecture.md) §4 | [14](14-testing-strategy.md) §5 |
| PII redacted before logs/AI prompts | [13](13-security-and-privacy.md) §6 | AI layer (providers/) | [14](14-testing-strategy.md) §5 |
| Signed data pack verification | [13](13-security-and-privacy.md) §9, [12](12-import-export-and-update.md) B3 | Update Engine | [14](14-testing-strategy.md) §5, §6 |
| OCR output is untrusted, human-confirmed | [11](11-ocr-architecture.md) §5, [13](13-security-and-privacy.md) §8 | OCR review screen | [14](14-testing-strategy.md) §5 |
| Prompt injection cannot change engine verdict | [13](13-security-and-privacy.md) §8 | Engine isolation (no AI imports) | [14](14-testing-strategy.md) §5, §7 |

---

## Engine coverage

| Engine | Architecture doc | Folder (`src/engines/`) | Mentioned in DESIGN_PRINCIPLES §9 | Independently testable |
|---|---|---|---|---|
| Project Engine | [01](01-system-architecture.md) | `project-engine/` | Yes | Yes |
| Validation Engine | [04](04-ai-architecture.md) §5, [15](15-application-workflows.md) §2 | `validation-engine/` | Yes | Yes |
| Financial Engine | [05](05-financial-engine.md) | `financial-engine/` | Yes | Yes |
| Eligibility Engine | [06](06-eligibility-engine.md) | `eligibility-engine/` | Yes | Yes |
| DPR Engine | [07](07-dpr-engine.md) | `dpr-engine/` | Yes | Yes |
| PDF Engine | [08](08-pdf-engine.md) | `pdf-engine/` | Yes | Yes |
| Knowledge Engine | [09](09-knowledge-package.md) | `knowledge-engine/` | Yes | Yes |
| OCR Engine | [11](11-ocr-architecture.md) | `ocr-engine/` | No (in doc 01 only) | Yes (field extraction) |
| Import/Export Engine | [12](12-import-export-and-update.md) Part A | `import-export-engine/` | Yes | Yes |
| Update Engine | [12](12-import-export-and-update.md) Part B | `update-engine/` | Yes | Yes |

> Note: The OCR Engine is listed in [01-system-architecture.md](01-system-architecture.md) as a business engine but not enumerated in DESIGN_PRINCIPLES.md §9. The field-extraction logic is deterministic and independently testable; the ML-based text recognition runs via a Capacitor native bridge.
