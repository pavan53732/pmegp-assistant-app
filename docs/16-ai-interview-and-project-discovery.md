# 16 — AI Interview & Project Discovery Architecture

Status: draft for review · No application code until architecture docs are approved
Related: [01-system-architecture.md](01-system-architecture.md) · [03-data-model.md](03-data-model.md) · [04-ai-architecture.md](04-ai-architecture.md) · [09-knowledge-package.md](09-knowledge-package.md) · [15-application-workflows.md](15-application-workflows.md) · [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md)

---

## 1. Purpose

This document specifies **how the AI interview builds a project** — the one architectural gap left open by the existing documentation set.

The interview is the **first touchpoint** between the beneficiary and the application. Everything downstream — the Validation Engine, Eligibility Engine, Financial Engine, DPR Engine, and PDF Engine — consumes the same object: the **Structured Project Profile**. This document defines that object, the reasoning pipeline that constructs it, the phases the interview progresses through, the role of the Knowledge Package in assisting beneficiaries who cannot answer technical questions, and the provenance and suggestion models that track data origin and verification for every field.

This document sits between the user and the Validation Engine in the pipeline:

```
User
  ↓
AI Interview (this document)
  ↓
Structured Project Profile (Section 2)
  ↓
Validation Engine (doc 05 of doc 04 §5, doc 15 §2)
```

**No application code should be written until this document is reviewed and approved.**

---

## 2. The Structured Project Profile (canonical schema)

The Structured Project Profile is the **single data contract** between the interview layer and every downstream engine. Both the AI interview and the guided forms produce an identical instance of this object. Downstream engines consume only this object — never raw conversation messages, never partial AI outputs, never form state.

The profile is a **typed, Zod-validated** object. The canonical type definition lives in `shared/types/project-profile.ts`. The shape below is the **specification** — implementation will mirror it exactly.

### 2.1 Schema overview

```
ProjectProfile {
  // ── APPLICANT ──────────────────────────────────────────────
  applicant: {
    name:                   string
    age:                    number
    gender:                 "MALE" | "FEMALE" | "OTHER"
    category:               "GEN" | "SC" | "ST" | "OBC" | "MINORITY"
                            | "EX_SERVICEMEN" | "PH" | "NER"
    isWomen:                boolean        // derived from gender; stored for subsidy calc
    phone?:                 string
    email?:                 string
    education:              "NONE" | "BELOW_8TH" | "8TH_PASS" | "10TH_PASS"
                            | "12TH_PASS" | "GRADUATE" | "POST_GRADUATE" | "PROFESSIONAL"
                            | "OTHER"
    educationDetail?:       string         // free text if OTHER
    entityType:             "INDIVIDUAL" | "SHG" | "TRUST" | "SOCIETY"
                            | "COOP" | "PARTNERSHIP" | "LLP" | "PRIVATE_LIMITED"
    entityRegistrationNo?:  string
    aadhaarNo?:             string         // stored encrypted, masked in logs/prompts
    panNo?:                 string
    priorSubsidy:           boolean        // availed PMEGP/PMRY/other govt subsidy?
    priorSubsidyDetail?:    string
    edpCompleted:           boolean        // EDP training done?
    edpCertificateNo?:      string
    experienceYears?:       number
    experienceDetail?:      string
  }

  // ── BUSINESS ───────────────────────────────────────────────
  business: {
    name:                   string         // proposed unit/project name
    description:            string         // what the beneficiary wants to do, in their words
    activityType:           "MANUFACTURING" | "SERVICE"  // fixed after activity resolution
    nicCode:                string?        // 6-digit NIC code — fixed after activity resolution
    nicDescription:         string?        // human-readable NIC label — fixed after activity resolution
    sector:                 "MANUFACTURING" | "SERVICE"  // derived from NIC; fixed after activity resolution
    subCategory:            "MANUFACTURING" | "SERVICE" | "TRADING" | "TRANSPORT"
                                           // derived from NIC; fixed after activity resolution
  }

  // ── LOCATION ───────────────────────────────────────────────
  location: {
    state:                  string
    district:               string
    mandal?:                string
    village?:               string
    pinCode?:               string
    area:                   "URBAN" | "RURAL"
    premisesAddress?:       string
    isHillBorderArea:       boolean        // Hill & Border Area (affects subsidy categorization)
    isAspirationalDistrict: boolean        // Aspirational District
    industrialAreaName?:    string
    industrialAreaType?:    "INDUSTRIAL_ESTATE" | "SEZ" | "CLUSTER"
                          | "DAC" | "OTHER" | null
  }

  // ── LAND ───────────────────────────────────────────────────
  land: {
    status:                 "OWN" | "RENTED" | "LEASED" | "NONE" | "FAMILY"
    areaSqFt?:              number
    areaSqMt?:              number
    ownedLandValue?:        number         // in rupees (for project cost)
    monthlyRent?:           number         // in rupees
    leaseAmount?:           number
    leaseYears?:            number
    buildingType?:          "OWN" | "RENTED" | "CONSTRUCT"
    buildingAreaSqFt?:      number
    constructionCost?:      number         // in rupees (for project cost)
  }

  // ── CAPACITY & PRODUCTION ──────────────────────────────────
  capacity: {
    installedCapacity: {
      unit:                 string         // e.g., "kg/month", "units/month", "litres/day"
      value:                number
    }
    projectedCapacityUtil:  number         // percentage, typically 60-80%
    workingDaysPerMonth:    number         // typically 25-26
    workingHoursPerDay:     number         // typically 8
    shifts:                 number         // 1, 2, or 3
  }

  // ── MACHINERY & EQUIPMENT ──────────────────────────────────
  machinery: {
    items:                  MachineryItem[]
    totalCost:              number         // in rupees — sum of items, authoritative for project cost
  }

  MachineryItem {
    name:                   string
    specification?:         string
    quantity:               number
    unitCost:               number         // in rupees
    totalCost:              number         // quantity × unitCost
    supplier?:              string
    quotationRef?:          string         // links to attachment if OCR'd quotation exists
    source:                 "USER" | "AI" | "KNOWLEDGE" | "OCR"
  }

  // ── RAW MATERIALS ──────────────────────────────────────────
  rawMaterials: {
    items:                  RawMaterialItem[]
    totalMonthlyCost:       number         // in rupees — sum of items
  }

  RawMaterialItem {
    name:                   string
    specification?:         string
    monthlyQuantity:        number
    unit:                   string
    unitRate:               number         // in rupees
    totalMonthlyCost:       number         // quantity × unitRate
    source:                 "USER" | "AI" | "KNOWLEDGE" | "OCR"
  }

  // ── EMPLOYEES ──────────────────────────────────────────────
  employees: {
    skilled: {
      male:                 number
      female:               number
      monthlyWagePerPerson: number
    }
    unskilled: {
      male:                 number
      female:               number
      monthlyWagePerPerson: number
    }
    administrative: {
      count:                number
      monthlyWagePerPerson: number
    }
    totalMonthlyWages:      number         // computed sum
    totalEmployment:        number         // total persons
  }

  // ── UTILITIES & OVERHEADS ──────────────────────────────────
  utilities: {
    monthlyPowerCost:       number         // in rupees
    monthlyWaterCost:       number
    monthlyRentCost:        number
    monthlyMaintenanceCost: number
    monthlyTransportCost:   number
    monthlyCommunicationCost: number
    monthlyInsuranceCost:   number
    monthlyMiscCost:        number
    totalMonthlyOverheads:  number         // computed sum
  }

  // ── FINANCIAL ASSUMPTIONS ──────────────────────────────────
  financials: {
    machineryAndEquipment:  number         // in rupees — alias for machinery.totalCost
    otherFixedAssets:       number         // in rupees
    preOperativeExpenses:   number         // in rupees
    buildingAndCivilWorks:  number         // in rupees
    totalFixedCapital:      number         // computed sum of above
    workingCapital:         number         // in rupees
    totalProjectCost:       number         // fixedCapital + workingCapital
    interestRate:           number         // annual % (user-provided or Knowledge Package default)
    loanTenureYears:        number
    repaymentMoratoriumMonths: number      // typically 6
    collateralOffered?:     string
    projectedMonthlySales:  number         // in rupees
  }

  // ── WORKING CAPITAL BREAKDOWN ──────────────────────────────
  workingCapitalDetail: {
    rawMaterialDays:        number         // typically 30-45 days
    workInProgressDays:     number         // typically 7-15 days
    finishedGoodsDays:      number         // typically 15-30 days
    creditorsDays:          number         // typically 15-30 days
    computedWorkingCapital: number?        // days-based calculation result, in rupees
    method:                 "USER_PROVIDED" | "DAYS_BASED" | "PERCENTAGE_OF_PROJECT_COST"
  }

  // ── MARKET ─────────────────────────────────────────────────
  market: {
    targetMarket:           string         // description of target customers/area
    marketDemand?:          string         // demand assessment
    competition?:           string
    marketingStrategy?:     string
    sellingPricePerUnit?:   number
    sellingPriceUnit?:      string
  }

  // ── QUOTATIONS & ATTACHMENTS ───────────────────────────────
  attachments: {
    items:                  AttachmentRef[]
  }

  AttachmentRef {
    id:                     string
    type:                   "QUOTATION" | "IDENTITY_PROOF" | "ADDRESS_PROOF"
                            | "LAND_DOCUMENT" | "EDP_CERTIFICATE" | "OTHER"
    fileName:               string
    ocrExtractedFields?:    Record<string, string>   // from OCR engine
    linkedMachineryIndex?:  number         // index into machinery.items[]
    status:                 "PENDING_REVIEW" | "CONFIRMED" | "REJECTED"
  }

  // ── VALIDATION METADATA ────────────────────────────────────
  validation: {
    completeness:           number         // 0–100, computed by Validation Engine
    missingFields:          string[]       // mandatory fields not yet filled
    errors:                 ValidationError[]
    contradictions:         Contradiction[]
  }

  ValidationError {
    fieldPath:              string         // e.g., "applicant.age"
    code:                   string         // e.g., "TOO_LOW", "INVALID_FORMAT"
    message:                string
  }

  Contradiction {
    fields:                 string[]       // e.g., ["land.status", "land.ownedLandValue"]
    description:            string
  }

  // ── PROVENANCE METADATA ──────────────────────────────────
  // Every field carries two orthogonal dimensions:
  //   Source:      WHERE the value came from (USER, AI, OCR, KNOWLEDGE, null)
  //   Verification: whether the user has explicitly confirmed it
  // See Section 9 for the full provenance model.
  provenance: {
    perField:               Record<string, FieldProvenance>
    aggregate:              number         // 0–1, weighted average of engine-ready fields
  }

  FieldProvenance {
    source:                 "USER" | "AI" | "OCR" | "KNOWLEDGE" | null
    verification:           "UNVERIFIED" | "CONFIRMED" | "VALIDATED"
    confirmedAt?:           string         // ISO timestamp of user confirmation
    extractConfidence?:     number         // 0–1, from AI/OCR extraction confidence
    knowledgeSource?:       string         // Knowledge Package entry ref (if source = "KNOWLEDGE")
  }

  // ── COMPLETION METADATA ────────────────────────────────────
  completion: {
    currentPhase:           InterviewPhase // which interview phase is active
    phaseProgress:          Record<InterviewPhase, PhaseProgress>
    startedAt:              string         // ISO timestamp
    lastUpdatedAt:          string         // ISO timestamp
    interactionCount:       number         // number of AI or form interactions
  }

  PhaseProgress {
    status:                 "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "NEEDS_REVIEW"
    completedFields:        number
    totalFields:            number
  }
}

InterviewPhase =
  | "APPLICANT_DISCOVERY"
  | "BUSINESS_DISCOVERY"
  | "ACTIVITY_RESOLUTION"
  | "PROJECT_SIZING"
  | "FINANCIAL_PLANNING"
  | "REVIEW"
  | "VALIDATION_COMPLETION"
```

### 2.2 Design rules for the profile

1. **Every downstream engine consumes this object.** The Eligibility Engine, Financial Engine, DPR Engine, and PDF Engine all receive (a subset of) the `ProjectProfile` as their primary input. None reads conversation history, form state, or partial data.

2. **Money is never stored as floating point.** All rupee amounts are integers (whole rupees or paise — decided at implementation, recorded in [05-financial-engine.md](05-financial-engine.md)). The Financial Engine consumes integer values and returns integer values.

3. **The profile is the output of the interview, not the interview itself.** Conversation messages, UI state, and the question-selection logic live in `features/ai/` — they are not part of the profile.

4. **Optional fields (`?`) vs mandatory fields.** The Validation Engine defines which fields are mandatory for the profile to be considered complete. The schema itself allows `?` for fields that may be unknown or inapplicable — the Validation Engine enforces the business rules.

5. **The profile is immutable during a single engine run.** An engine receives a snapshot of the profile; it does not observe mid-interview mutations.

6. **Both interaction models produce the same type.** There is no `AiProjectProfile` vs `FormProjectProfile`. The Zod schema that validates the AI interview output is the same Zod schema that validates the guided forms.

### 2.3 Field ownership

Every field or field group in the Structured Project Profile has exactly one **authoritative owner** — the subsystem that is responsible for producing or computing its value. Other subsystems may read or display the field, but they never become its author.

This creates a powerful invariant: **no subsystem silently overwrites another subsystem's data.**

| Owner | Fields | Notes |
|-------|--------|-------|
| **Applicant (user input)** | `applicant.name`, `applicant.age`, `applicant.gender`, `applicant.category`, `applicant.phone`, `applicant.email`, `applicant.education`, `applicant.entityType`, `applicant.aadhaarNo`, `applicant.panNo`, `applicant.priorSubsidy`, `applicant.address.*` | Directly provided by the beneficiary. The interview/AI may extract these from conversation but the authoritative source is the user. |
| **Knowledge Engine** (after user confirmation) | `business.nicCode`, `business.nicDescription`, `business.sector`, `business.subCategory`, `business.activityType` | Looked up from the NIC code database. The user confirms the lookup result, making it authoritative. |
| **Interview / AI extraction** | `business.description`, `business.name`, `business.constitution` | Extracted from the user's conversational description. The user confirms. |
| **Applicant (user input)** | `location.district`, `location.state`, `location.pincode`, `location.urbanRural` | Directly provided or derived from district lookup. |
| **Applicant (user input)** | `land.status`, `land.ownedLandValue`, `land.rentedMonthlyRent` | Directly provided. |
| **Applicant + Knowledge Engine** | `capacity.*` | Production capacity is user-provided; unit benchmarks come from Knowledge Package as reference. |
| **Applicant + Knowledge Engine** | `machinery.items[]` | User selects/suggests machinery; Knowledge Package provides reference lists and indicative costs. Each item carries its own `source` tag. |
| **Applicant + Knowledge Engine** | `rawMaterials.items[]` | Same pattern as machinery. |
| **Applicant (user input)** | `employees.*` | Directly provided. |
| **Applicant (user input)** | `utilities.*` | Directly provided. |
| **Applicant (user input)** | `financials.*` | Directly provided (project cost, promoter's contribution, loan amount). |
| **Financial Engine** | *(computed results, stored in separate tables)* | Subsidy amount, DSCR, bank loan breakdown, interest calculations. These are NOT stored in the profile — they are snapshotted in `project_financials` (doc 03). The profile only stores the *inputs* to financial calculations. |
| **Eligibility Engine** | *(computed results, stored in separate tables)* | Eligibility status, applicable scheme rules, maximum project cost. Stored in separate tables, not in the profile. |
| **DPR Engine** | *(generated document)* | The DPR is an output that reads the profile — it does not write back to it. |
| **Validation Engine** | `validation.*` | The validation metadata section (errors, warnings, contradictions, completeness) is owned and written exclusively by the Validation Engine. |
| **Interview orchestration** | `provenance.*`, `completion.*` | Provenance and completion metadata are owned by the interview layer. |

**Key rules:**

1. **Engines never write to the profile.** The Financial Engine, Eligibility Engine, and DPR Engine are pure functions — they receive the profile and produce outputs. Their outputs are stored in their own tables, never written back into the profile.
2. **The Validation Engine only writes to `validation.*`.** It reads the entire profile but only modifies the validation metadata section.
3. **Derived fields have a defined owner.** `isWomen` (derived from `gender`) is owned by the Interview orchestration — it computes and writes it immediately after the gender field is set.
4. **Field ownership prevents responsibility creep.** If a future developer is tempted to have the Financial Engine "fix" a machinery cost, the ownership table makes it clear that this is a violation — machinery costs are owned by the Applicant + Knowledge Engine.

---

## 3. The AI Reasoning Pipeline

Every user message during the AI interview triggers a **deterministic, multi-stage reasoning pipeline** inside `features/ai/`. This pipeline is **orchestration code** — it lives in the feature layer, not in any engine, not in the AI provider. The AI model is called at specific stages; the rest is deterministic logic.

### 3.1 Pipeline stages

```
User message received
  │
  ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 1 — Response Parsing                                       │
│                                                                  │
│ Parse the raw user message into a structured intermediate         │
│ representation. This is NOT field extraction — it is parsing the  │
│ user's intent and content into a form the next stages can        │
│ process.                                                         │
│                                                                  │
│ Responsibilities:                                                │
│ • Detect if the user is answering a question, asking a           │
│   question, correcting a previous answer, or requesting          │
│   navigation (e.g., "go back", "show me what you have").         │
│ • Detect "I don't know" / uncertain responses.                   │
│ • Detect corrections and contradictions with previous answers.    │
│ • Detect when the user provides information for a field not      │
│   currently being asked about (opportunistic extraction).        │
│ Output: ParsedUserResponse { intent, content, targetField?,      │
│         uncertainty, corrections? }                               │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 2 — Structured Field Extraction                            │
│                                                                  │
│ Extract structured field values from the parsed response.         │
│ This is the stage where the AI model is called to map natural    │
│ language to profile fields.                                      │
│                                                                  │
│ Responsibilities:                                                │
│ • Map user's natural-language answer to one or more              │
│   ProjectProfile fields.                                         │
│ • Handle partial answers (e.g., "about 5 lakhs" → 500000 with    │
│   low extractConfidence score).                                  │
│ • Handle multi-field answers (e.g., "I'm 32, from Anantapur,    │
│   SC category" → three fields extracted).                         │
│ • When the user says "I don't know" or gives an uncertain        │
│   answer, produce no extraction — flag the field for suggestion   │
│   (Stage 6).                                                     │
│ • All extractions carry an extractConfidence score (0–1).         │
│                                                                  │
│ AI is called here. The AI receives the conversation context and   │
│ the current profile state, and returns structured field           │
│ extractions with provenance info.                                │
│                                                                  │
│ Output: FieldExtraction[] { fieldPath, value, extractConfidence,  │
│         source: "AI" }                                           │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 3 — Profile Update                                         │
│                                                                  │
│ Apply extracted fields to the in-memory Structured Project        │
│ Profile.                                                         │
│                                                                  │
│ Responsibilities:                                                │
│ • Apply each FieldExtraction to the profile.                     │
│ • If a field already has a value and the user is correcting it,  │
│   update the value and set source=USER, verification=UNVERIFIED.  │
│ • If the AI extracted a value but extractConfidence is below      │
│   threshold, do NOT apply to the profile — instead, present it   │
│   as a suggestion for user confirmation (see Section 8).          │
│ • Track provenance: every applied field gets a FieldProvenance   │
│   entry with source and verification (see Section 9).         │
│ • Trigger derived-field updates (e.g., if gender changes,         │
│   re-derive isWomen).                                            │
│ Output: Updated ProjectProfile                                   │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 4 — Validation                                             │
│                                                                  │
│ Run the Validation Engine against the updated profile.           │
│                                                                  │
│ Responsibilities:                                                │
│ • Compute completeness percentage.                               │
│ • Identify missing mandatory fields.                             │
│ • Run Zod and business-rule validation on all populated fields.  │
│ • Detect contradictions between fields.                          │
│ • Update provenance metadata (see Section 9).                    │
│                                                                  │
│ This calls engines/validation-engine — a pure, deterministic,    │
│ independently testable engine. The AI is NOT involved here.      │
│                                                                  │
│ Output: ValidationState { completeness, missingFields,           │
│         errors, contradictions, updated provenance }              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 5 — Dependency Evaluation                                 │
│                                                                  │
│ Evaluate the field dependency graph (see Section 7) to           │
│ determine what downstream fields are now answerable or need      │
│ revision.                                                        │
│                                                                  │
│ Responsibilities:                                                │
│ • When a field changes, check which other fields depend on it    │
│   (e.g., NIC code fixed → sector fixed → cost ceiling known).   │
│ • If a dependency change invalidates a previously-set field,      │
│   flag it for re-confirmation (but do NOT silently clear it).    │
│ • Determine which interview phase we are now in based on         │
│   completed dependencies.                                        │
│ • When activity resolution completes (NIC code fixed),           │
│   trigger Knowledge Engine lookups for machinery, raw materials,  │
│   and process defaults.                                          │
│ Output: DependencyEffects { invalidatedFields, newPhase?,        │
│         knowledgeQueries? }                                       │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 6 — Knowledge Retrieval & Suggestion Generation            │
│                                                                  │
│ Query the Knowledge Package (via Knowledge Engine) for           │
│ contextual data and suggestions.                                 │
│                                                                  │
│ Responsibilities:                                                │
│ • If the user gave an uncertain/"I don't know" answer,          │
│   query the Knowledge Package for suggested values               │
│   (machinery lists, indicative costs, raw material defaults,     │
│   wage benchmarks).                                              │
│ • If a new NIC code was fixed, retrieve associated machinery,    │
│   raw materials, process descriptions, and indicative costs.     │
│ • If the user is in PROJECT_SIZING, retrieve benchmark           │
│   project costs for similar activities.                           │
│ • Suggestions carry their source and are NEVER treated as        │
│   facts — they are presented to the user for confirmation.       │
│                                                                  │
│ This calls engines/knowledge-engine — a pure, deterministic       │
│ engine that searches the Knowledge Package data.                 │
│                                                                  │
│ Output: Suggestion[] { fieldPath, suggestedValue, source,        │
│         reasoning }                                               │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 7 — Question Planning                                      │
│                                                                  │
│ Determine the next question the AI should ask.                   │
│                                                                  │
│ Responsibilities:                                                │
│ • Read Validation State: prioritize missing mandatory fields.     │
│ • Read dependency graph: only ask questions whose dependencies   │
│   are satisfied.                                                  │
│ • Read interview phase: follow the phase sequence (Section 4).  │
│ • If there are suggestions pending (from Stage 6), the next      │
│   "question" may be a suggestion-present-and-confirm step.       │
│ • If there are contradictions, prioritize resolving those        │
│   before collecting new fields.                                   │
│ • If validation errors exist on recently-changed fields,         │
│   present them for correction before moving on.                   │
│ • If completeness >= threshold and no blockers remain,            │
│   transition to the REVIEW or VALIDATION_COMPLETION phase.       │
│ • The planned question maps to a specific field or field group    │
│   in the ProjectProfile schema (principle 15).                   │
│                                                                  │
│ Output: PlannedQuestion { targetField, questionType,              │
│         suggestions?, context, phase }                            │
│                                                                  │
│ QuestionType = "FIELD_COLLECTION" | "SUGGESTION_CONFIRMATION"     │
│              | "CONTRADICTION_RESOLUTION" | "ERROR_CORRECTION"    │
│              | "PHASE_TRANSITION" | "REVIEW"                      │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 8 — Natural-Language Response Generation                   │
│                                                                  │
│ Convert the planned question (and any suggestions, validation    │
│ feedback, or context) into a natural-language response to the    │
│ user.                                                            │
│                                                                  │
│ Responsibilities:                                                │
│ • Generate a conversational question that maps to the planned    │
│   target field(s).                                               │
│ • If suggestions exist, present them with clear labeling:         │
│   "Based on similar [activity] units, typical machinery includes  │
│   X, Y, Z. Would you like to use these or add your own?"         │
│ • If there are validation errors, explain them in user-friendly   │
│   language.                                                      │
│ • If transitioning phases, provide a brief summary of what was    │
│   collected and what comes next.                                  │
│ • Maintain conversational warmth while staying focused on         │
│   schema-driven data collection.                                  │
│ • Never ask a question not mapped to the ProjectProfile schema.  │
│                                                                  │
│ AI is called here to generate the natural-language response.      │
│ The planned question provides the structure; the AI provides      │
│ the phrasing.                                                    │
│                                                                  │
│ Output: string (the message displayed to the user)                │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Where AI is and is not called

| Stage | AI called? | Why |
|-------|-----------|-----|
| 1. Response Parsing | Optional | Can be rule-based for simple intents; AI for ambiguous cases |
| 2. Field Extraction | Yes | Natural language → structured fields requires language understanding |
| 3. Profile Update | No | Pure deterministic logic |
| 4. Validation | No | Validation Engine — deterministic |
| 5. Dependency Evaluation | No | Pure graph traversal |
| 6. Knowledge Retrieval | No | Knowledge Engine — deterministic search |
| 7. Question Planning | No | Pure logic reading validation state |
| 8. Response Generation | Yes | Structured plan → natural language |

AI is called at most twice per turn (stages 2 and 8). The other six stages are deterministic and testable without any AI model.

### 3.3 Prompt construction

The prompts sent to the AI provider include:

- **The system prompt** (from the Knowledge Package's `default prompt templates`).
- **The relevant portion of the ProjectProfile** — only fields relevant to the current phase and the planned question. PII is minimized; the full profile is never sent.
- **The planned question metadata** (target field, question type, suggestions).
- **Any recent conversation context** needed for coherence (last N turns, not the full history).

PII redaction is applied before any data enters the prompt. See [13-security-and-privacy.md](13-security-and-privacy.md).

---

## 4. Interview Phases

The interview is not one long, unstructured conversation. It progresses through **named phases**, each with a clear objective. Phases are sequential — a phase does not begin until the previous phase's objective is substantially met. Within a phase, the AI may ask questions in any order that feels natural, but it cannot skip ahead to fields whose dependencies are unsatisfied.

### Phase 1 — Applicant Discovery

**Objective:** Establish who the applicant is and their eligibility category.

Fields collected: `applicant.name`, `applicant.age`, `applicant.gender`, `applicant.category`, `applicant.entityType`, `applicant.education`, `applicant.experienceYears`, `applicant.priorSubsidy`, `applicant.edpCompleted`.

Exit condition: Applicant identity and category are known. Eligibility pre-checks (age, prior subsidy) can be evaluated. If the applicant is clearly ineligible (e.g., age < 18), the interview surfaces this immediately — the user is informed but not blocked from continuing (they may wish to review or adjust).

**Why this is first:** Category and area determine subsidy rates and cost ceilings — everything downstream depends on knowing who the applicant is.

### Phase 2 — Business Discovery

**Objective:** Understand what the applicant wants to do, in their own words, and where.

Fields collected: `business.description`, `business.name`, `location.state`, `location.district`, `location.area` (urban/rural), `location.mandal`, `location.village`, `location.pinCode`.

Exit condition: A natural-language business description exists and the geographic context is established. The AI has enough to begin activity resolution.

**Why this is second:** The business description is the input to activity resolution (Phase 3). The location determines the area classification (urban/rural) which affects subsidy rates.

### Phase 3 — Activity Resolution

**Objective:** Map the business description to a specific NIC code, sector, and sub-category. This is the **critical juncture** where the Knowledge Engine is most heavily involved.

Process: See Section 6 (Activity Discovery Lifecycle) for the full specification.

Exit condition: `business.nicCode`, `business.nicDescription`, `business.sector`, and `business.subCategory` are fixed. PMEGP rules for this sector/category/area combination are now determined.

**Why this is third:** The NIC code determines the sector, which determines the project cost ceiling, eligible subsidy rate, and what machinery/raw materials are relevant. No financial planning can proceed without this.

### Phase 4 — Project Sizing

**Objective:** Determine the physical scale of the project — land, building, machinery, employees, production capacity.

Fields collected: `land.*`, `capacity.*`, `machinery.*` (items), `employees.*`, `utilities.*`, `attachments.*` (if quotation scanning).

Exit condition: Machinery list is populated (with at least indicative items), employee count is known, production capacity is defined, and land/building status is clear.

**Why this is fourth:** Machinery and building costs drive the capital expenditure, which is the largest component of project cost. The Knowledge Package assists here with activity-specific machinery and raw material suggestions.

### Phase 5 — Financial Planning

**Objective:** Determine the financial parameters — working capital, interest rate, loan tenure, projected sales.

Fields collected: `rawMaterials.*`, `financials.*`, `workingCapitalDetail.*`, `market.*`.

Exit condition: Total project cost can be computed. Working capital is determined. Interest rate and tenure are set. Projected monthly sales are estimated.

**Why this is fifth:** Financial planning requires knowing the capital expenditure (from Phase 4) to compute total project cost, working capital, and the subsidy/loan/own-contribution split.

### Phase 6 — Review

**Objective:** Present the complete profile to the user for review and correction. This is a human-in-the-loop checkpoint before any engine runs.

Behavior:
- Display the structured profile in a readable, sectioned format.
- Highlight any fields sourced from AI, OCR, or Knowledge Package (these benefit most from review, though all fields are confirmed together on the REVIEW_PENDING screen).
- Highlight any validation warnings or soft contradictions.
- Allow the user to edit any field.
- Show a completeness summary and list of any remaining issues.

Exit condition: The user explicitly confirms the profile is correct, or edits are applied and validation is re-run.

**Why this exists:** The beneficiary must see and approve the data before engines produce numbers that go into a bank document. This is the last point where data quality is a human responsibility.

### Phase 7 — Validation Completion

**Objective:** Run the final Validation Engine check. If the profile passes (completeness at threshold, no blocking errors, no unresolved contradictions), unlock downstream engines.

Behavior:
- The Validation Engine runs one final time.
- If blockers exist, return to the relevant phase to resolve them.
- If the profile passes, transition the project status to "validated" and unlock Eligibility → Financial → DPR engines.
- The user is informed that the project is ready for processing.

Exit condition: Validation Engine passes. Project status becomes "validated." Downstream engines are unlocked.

**Why this is last:** This is the gate described in Design Principle 14 and doc 04 §5. No engine runs until this passes.

---

## 5. Knowledge-Assisted Interview

Most beneficiaries do not know their NIC code, what machinery they need, or what their working capital should be. They know: "I want to start a poultry farm" or "I want to buy a goods vehicle." The Knowledge Package bridges this gap.

### 5.1 How it works

When the beneficiary provides a business description or cannot answer a technical question, the interview orchestration queries the Knowledge Package through the Knowledge Engine:

```
Beneficiary says: "I want to do poultry farming."

    ↓ (features/ai/ calls Knowledge Engine)

Knowledge Engine searches:
  • activities/NIC codes → "Poultry farming" matches NIC 0146xx
  • machinery database → "Poultry sheds, feeders, waterers, incubator..."
  • raw material database → "Feed, chicks, vaccines, medicines..."
  • financial benchmarks → "Typical project cost for 1000-bird unit: ₹X lakhs"
  • FAQ → "Common questions about poultry farming under PMEGP"

    ↓ (Knowledge Engine returns structured results)

Interview presents:
  "Poultry farming falls under NIC 014612 (Poultry farming). This is classified
   as a Service sector activity with a maximum project cost of ₹25 lakhs.

   Based on similar projects, typical machinery includes:
   1. Poultry shed (2000 sq ft) — ₹3,50,000
   2. Feeders (20 units) — ₹20,000
   3. Waterers (20 units) — ₹15,000
   4. Incubator (1 unit) — ₹50,000

   Would you like to use these as a starting point?"

    ↓ (User confirms or edits)

Only confirmed values enter the Structured Project Profile.
Suggestions are never treated as facts.
```

### 5.2 Rules for knowledge assistance

1. **Knowledge queries are initiated by the interview, not by the user.** The user does not interact with the Knowledge Engine directly. The AI interview decides when to query and what to query for.

2. **Suggestions are presented, not applied.** Every suggestion from the Knowledge Package is shown to the user with a clear label ("Based on typical [activity] projects...") and requires explicit acceptance. See Section 10 (Suggestion Lifecycle) and Section 9 (Provenance Model).

3. **The user can always override.** A suggested machinery list, raw material cost, or working capital amount is a starting point — the user can add, remove, or edit any item.

4. **Knowledge assists; it does not decide.** The Knowledge Package does not determine eligibility, calculate subsidy, or compute financials. It provides reference data that the interview presents for human confirmation.

5. **Knowledge queries are deterministic and offline.** The Knowledge Engine searches bundled data; no network call is required. If AI is unavailable, the guided forms present the same Knowledge Package data as pre-populated defaults in the form fields.

---

## 6. Activity Discovery Lifecycle

Activity discovery is the process of mapping the beneficiary's business description to a specific NIC code, sector, and sub-category. This is a **responsibility of the Knowledge Engine** (as specified in [AGENTS.md](../AGENTS.md)) — no new engine is introduced.

### 6.1 The lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1 — Business Description Received                           │
│                                                                  │
│ The beneficiary provides a natural-language description of       │
│ what they want to do. This happens during Phase 2 (Business     │
│ Discovery) and flows into Phase 3.                              │
│                                                                  │
│ Example: "I want to start a small bakery in my village."        │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2 — Knowledge Engine Search                                 │
│                                                                  │
│ The interview orchestration sends the business description to    │
│ the Knowledge Engine, which searches the NIC code database       │
│ using:                                                          │
│ • Exact text matching against NIC descriptions                  │
│ • Text search (fuzzy matching, keyword extraction)               │
│ • Synonym expansion (e.g., "bakery" → "bread making",           │
│   "confectionery production")                                   │
│                                                                  │
│ The Knowledge Engine returns a ranked list of candidate NIC      │
│ activities.                                                     │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3 — Candidate NIC Activities Presented                      │
│                                                                  │
│ The interview presents the top candidates to the beneficiary:    │
│                                                                  │
│ "We found these matching activities:                            │
│  1. [10701] Manufacture of bread, cakes, pastries (Manufacturing)│
│  2. [10702] Manufacture of biscuits and cookies (Manufacturing) │
│  3. [56211] Retail sale of bread and bakery products (Service — │
│     Trading)                                                     │
│                                                                  │
│  Are you planning to manufacture bakery products, or sell them?" │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4 — User Confirmation                                       │
│                                                                  │
│ The user selects (or clarifies) which activity matches their     │
│ intention. The user may also describe further if none of the     │
│ candidates match.                                                │
│                                                                  │
│ If no match is found, the interview asks follow-up questions     │
│ to narrow down the search (e.g., "Are you making products or     │
│ providing a service?").                                          │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5 — NIC Code Fixed                                          │
│                                                                  │
│ Once the user confirms a NIC code:                              │
│ • business.nicCode is set                                        │
│ • business.nicDescription is set                                 │
│ • business.sector is derived from the NIC entry                  │
│ • business.subCategory is derived from the NIC entry             │
│ • business.activityType is derived (MANUFACTURING or SERVICE)    │
│                                                                  │
│ These fields are set with source=USER, verification=CONFIRMED      │
│ in the provenance metadata. They become authoritative.             │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 6 — PMEGP Rules Determined                                  │
│                                                                  │
│ With sector and subCategory fixed, the applicable PMEGP rules    │
│ are now known:                                                   │
│ • Project cost ceiling (Manufacturing: ₹50 lakhs,                 │
│   Service: ₹25 lakhs)                                           │
│ • Subsidy rate (from category × area matrix)                     │
│ • Own-contribution percentage                                   │
│ • Eligibility criteria for this activity type                    │
│ • Negative-list check (if applicable)                            │
│                                                                  │
│ These rules are NOT stored in the profile — they are looked up   │
│ from the Knowledge Package by the engines when they run. The     │
│ profile stores only the beneficiary's data and their chosen       │
│ activity.                                                        │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 7 — Interview Continues                                      │
│                                                                  │
│ With the NIC code fixed, the interview transitions to Phase 4    │
│ (Project Sizing). The Knowledge Engine now has the context to    │
│ provide activity-specific suggestions for machinery, raw         │
│ materials, and benchmarks.                                       │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Ambiguity and multi-match handling

- If multiple NIC codes match with similar relevance, the interview presents all candidates and asks the user to choose.
- If no NIC code matches, the interview asks clarifying questions (manufacturing vs service, product vs service delivery, etc.) and re-searches.
- The interview never silently assigns a NIC code. The user must confirm.
- If the beneficiary's description is too vague for any match, the interview explains what information is needed and asks follow-up questions.

### 6.3 Trading and Transport

Trading and Transport are not standalone sectors in PMEGP — they are sub-categories under Service. The activity discovery lifecycle handles this transparently:

- A beneficiary saying "I want to start a general store" is matched to a Trading NIC code under the Service sector.
- A beneficiary saying "I want to buy a goods vehicle" is matched to a Transport NIC code under the Service sector.
- The sector and cost ceiling are correctly determined (Service: ₹25 lakhs) even though the activity is Trading or Transport.
- The user never needs to know this distinction — the Knowledge Engine resolves it.

---

## 7. Field Dependency Graph

The interview cannot ask questions in arbitrary order. Many fields depend on other fields being known first. The dependency graph enforces this ordering.

### 7.1 Core dependency chains

```
applicant.category + location.area
    → subsidy rate (determined by Eligibility/Financial Engine, not stored)

business.nicCode
    → business.sector
    → business.subCategory
    → business.activityType
    → project cost ceiling (from Knowledge Package, used by engines)
    → eligible machinery (from Knowledge Package)
    → eligible raw materials (from Knowledge Package)

location.area
    → subsidy rate determination

machinery.items[]
    → financials.machineryAndEquipment
    → financials.totalFixedCapital
    → financials.totalProjectCost

land.buildingType + land.constructionCost
    → financials.buildingAndCivilWorks
    → financials.totalFixedCapital
    → financials.totalProjectCost

rawMaterials.items[]
    → rawMaterials.totalMonthlyCost
    → working capital computation
    → financials.workingCapital
    → financials.totalProjectCost

financials.totalProjectCost
    → financials.totalFixedCapital + financials.workingCapital
    → Eligibility Engine (cost.ceiling check)
    → Financial Engine (subsidy, loan, EMI, DSCR, P&L)

capacity.installedCapacity + capacity.projectedCapacityUtil
    → projected monthly production
    → market.sellingPricePerUnit → projectedMonthlySales
    → Financial Engine (revenue projections)

employees.*
    → employees.totalMonthlyWages
    → utilities + wages = operating expenses
    → Financial Engine (P&L, cash flow)
```

### 7.2 Dependency rules for the interview

1. **A field is only asked when all its dependencies are satisfied.** The question planner (Stage 7 of the pipeline) checks the dependency graph before selecting the next question.

2. **If a dependency changes, dependents are flagged.** For example, if the user changes the NIC code (going back to Phase 3), all machinery, raw material, and financial data that was based on the old NIC code is flagged for review — not silently cleared.

3. **The dependency graph is a read-only reference structure.** It is defined once (in the Knowledge Package or in `shared/types`) and consumed by the interview orchestration and the Validation Engine. It is not modified at runtime.

4. **Dependencies flow forward only.** A field in a later phase never determines a field in an earlier phase. This ensures the interview never needs to "go back" for data — though the user can always manually navigate back to edit.

5. **The guided wizard follows the same dependency order.** The wizard's step sequence mirrors the phase structure, and the Validation Engine's `missingFields` output respects the same dependency graph.

---

## 8. "I Don't Know" Strategy

Most PMEGP beneficiaries are first-time entrepreneurs from rural areas. They often cannot answer questions about machinery costs, working capital requirements, or financial projections. The application must handle this gracefully without blocking progress or degrading the quality of the final DPR.

### 8.1 The flow

```
User says "I don't know" / "Mujhe nahi pata" / gives an uncertain answer
  │
  ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1 — Detect Uncertainty                                      │
│                                                                  │
│ Stage 1 (Response Parsing) detects the uncertainty. The field   │
│ extraction (Stage 2) produces NO extraction for this field.      │
│ The field remains in its current state (MISSING or unchanged).  │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2 — Knowledge Package Suggestion                           │
│                                                                  │
│ Stage 6 (Knowledge Retrieval) queries the Knowledge Package      │
│ for a suggested value based on:                                 │
│ • The current NIC code / activity type                          │
│ • The beneficiary's location (district/state benchmarks)        │
│ • Activity-specific defaults from the Knowledge Package          │
│ • Financial benchmarks for similar project sizes                │
│                                                                  │
│ The Knowledge Engine returns a structured suggestion with       │
│ source attribution.                                             │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3 — AI Explains the Suggestion                             │
│                                                                  │
│ Stage 8 (Response Generation) produces a natural-language        │
│ explanation of the suggestion:                                  │
│                                                                  │
│ "That's completely fine! For a bakery unit in a rural area,     │
│  typical machinery costs around ₹2-3 lakhs. Based on common      │
│  setups, here's what most people include:                       │
│  • Oven — ₹80,000                                                │
│  • Dough mixer — ₹45,000                                         │
│  • Display counter — ₹25,000                                     │
│                                                                  │
│  Would you like to start with these and adjust later?"           │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4 — User Reviews and Decides                                │
│                                                                  │
│ The user has three options:                                      │
│                                                                  │
│ a) ACCEPT — The suggested value(s) are applied to the profile     │
│    with source=KNOWLEDGE, verification=UNVERIFIED.                │
│                                                                  │
│ b) EDIT — The user provides their own value, which is applied    │
│    with source=USER, verification=UNVERIFIED.                     │
│                                                                  │
│ c) SKIP — The field remains source=null, verification=UNVERIFIED  │
│    (equivalent to MISSING). The interview moves on.               │
│    The Validation Engine will flag this field as missing. The    │
│    profile cannot pass validation until all mandatory fields are  │
│    engine-ready (see Section 9).
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5 — Provenance Tracking                                       │
│                                                                  │
│ Regardless of the user's choice, the provenance metadata is      │
│ updated:                                                         │
│                                                                  │
│ • Accepted suggestion → source=KNOWLEDGE, verification=UNVERIFIED  │
│ • User-provided value → source=USER, verification=UNVERIFIED      │
│ • Skipped → source=null, verification=UNVERIFIED                  │
│                                                                  │
│ The Validation Engine reads provenance metadata to compute       │
│ aggregate provenance score (see Section 9). Only engine-ready     │
│ fields (source=USER, or verification=CONFIRMED) contribute fully. │
│ Non-engine-ready fields with a value contribute at reduced weight. │
│ MISSING fields contribute zero.                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Rules for unknown answers

1. **"I don't know" is never an error.** The interview treats it as a normal response and offers assistance.

2. **The user is never forced to provide a value immediately.** They can skip and come back. The Validation Engine will eventually require all mandatory fields, but the interview does not block mid-conversation.

3. **Suggestions are based on the current activity context.** A bakery suggestion is different from a poultry suggestion. The Knowledge Engine uses the fixed NIC code (if available) or the business description to provide relevant defaults.

4. **Suggested values are clearly labeled.** The user must always know which values they entered and which were suggested. The Review phase (Phase 6) highlights all suggested values for explicit confirmation.

5. **The interview does not invent financial figures.** Even when suggesting machinery costs or working capital, the values come from the Knowledge Package — never from the AI model's parametric knowledge. The AI's role is to phrase the suggestion naturally, not to generate the number.

---

## 9. Provenance Model (Source × Verification)

Every field in the Structured Project Profile carries **provenance metadata** — two orthogonal dimensions that track where a value came from and whether it has been confirmed. This separation provides much richer provenance than a single status field.

### 9.1 Why two dimensions?

The old single-status model (`USER_CONFIRMED`, `KNOWLEDGE_SUGGESTED`, etc.) conflated two distinct concepts:

- **Provenance** (where did this value originate?) — important for audit trails, DPR annotation, and understanding data quality.
- **Verification** (has the beneficiary explicitly agreed this is correct?) — important for the validation gate and engine readiness.

By separating them, we can express any combination:

| Example field | Source | Verification | Meaning |
|---|---|---|---|
| Applicant name (typed) | `USER` | `UNVERIFIED` | User typed it directly — has a value but not yet confirmed via REVIEW_PENDING |
| Machinery cost (suggested) | `KNOWLEDGE` | `UNVERIFIED` | Knowledge Package suggested it, user accepted but hasn't confirmed via REVIEW_PENDING |
| Machinery cost (confirmed) | `KNOWLEDGE` | `CONFIRMED` | Knowledge Package suggested it, user confirmed inline or via REVIEW_PENDING |
| Aadhaar number (OCR) | `OCR` | `CONFIRMED` | Extracted from document scan, user confirmed inline or via REVIEW_PENDING |
| Business description (AI) | `AI` | `CONFIRMED` | AI extracted from conversation, user confirmed via REVIEW_PENDING |
| Any field (post-gate) | *any* | `VALIDATED` | Validation Engine has stamped this field after the profile passed validation |

### 9.2 Source dimension

| Source | Meaning | Set by |
|---|---|---|
| `null` | No value exists — the field is MISSING | Initial state |
| `USER` | User directly typed, selected, or provided the value | Form input, guided wizard, or user editing a suggestion |
| `AI` | AI model extracted the value from a conversational response | Stage 2 of the reasoning pipeline |
| `OCR` | OCR Engine extracted the value from a scanned document | OCR Engine |
| `KNOWLEDGE` | Knowledge Package suggested this value; user accepted the suggestion | Knowledge Engine → user acceptance |

### 9.3 Verification dimension

| Verification | Meaning | Set by |
|---|---|---|
| `UNVERIFIED` | Value exists but has not been explicitly confirmed by the user | Default when a value is first written |
| `CONFIRMED` | User has explicitly reviewed and confirmed this value is correct | User action (in Review phase, or inline confirmation) |
| `VALIDATED` | The Validation Engine has stamped this field after the profile passed validation | Validation Engine (set on all fields when profile transitions to `VALIDATED`) |

### 9.4 Engine-ready definition

A field is **engine-ready** if and only if:

```
engineReady(field) = (field.provenance.verification === "CONFIRMED")
                  || (field.provenance.verification === "VALIDATED")
```

Source does not factor into engine readiness. A user-typed value and a Knowledge-suggested value are treated identically by the gate — both must be confirmed before engines can consume them.

This is a deliberate design choice for a financial application:

- **Typos are real.** A user can accidentally type ₹20,00,000 instead of ₹2,00,000. The REVIEW_PENDING screen catches this.
- **Source answers where it came from. Verification answers whether the system trusts it for downstream processing.** These are independent concerns — conflating them would mean trusting USER source without verification, which is inappropriate for subsidy calculations.
- **`CONFIRMED` is set by user action** — either inline (during the Review phase) or in bulk (by pressing "Confirm Project" on the REVIEW_PENDING screen).
- **`VALIDATED` is a system-level stamp.** Set by the Validation Engine on all fields when the profile passes the final gate. It means "this value passed Zod + business rules."

### 9.5 Provenance transitions

```
// Initial state (no value)
source=null, verification=UNVERIFIED  ─── MISSING

// User provides value directly
──[user types or selects]──→ source=USER, verification=UNVERIFIED

// AI extraction (confidence threshold determines whether to apply or suggest)
──[AI extracts, extractConfidence ≥ threshold]──→ source=AI, verification=UNVERIFIED  (applied to profile)
──[AI extracts, extractConfidence < threshold]──→ NOT applied; presented as suggestion
   ──[user confirms inline]──→ verification=CONFIRMED
   ──[user edits]──→ source=USER, verification=UNVERIFIED
   ──[user rejects]──→ source=null, verification=UNVERIFIED  (MISSING again)

// OCR extraction
──[OCR extracts, user accepts]──→ source=OCR, verification=UNVERIFIED
   ──[user confirms inline]──→ verification=CONFIRMED
   ──[user edits]──→ source=USER, verification=UNVERIFIED
   ──[user rejects]──→ source=null, verification=UNVERIFIED  (MISSING)

// Knowledge suggestion
──[user accepts suggestion]──→ source=KNOWLEDGE, verification=UNVERIFIED
   ──[user confirms inline]──→ verification=CONFIRMED
   ──[user edits]──→ source=USER, verification=UNVERIFIED
   ──[user rejects]──→ source=null, verification=UNVERIFIED  (MISSING)

// User edits any existing value
──[user edits]──→ source=USER, verification=UNVERIFIED  (always resets to USER source)

// User presses "Confirm Project" on REVIEW_PENDING screen
──[REVIEW_PENDING → VALIDATED transition]──→ verification=CONFIRMED  (ALL fields with values)

// Validation Engine stamps all fields after final gate
──[profile reaches VALIDATED]──→ verification=VALIDATED  (all fields)
```

Note: "Inline confirmation" during the Review phase (Phase 6) is optional — the user can confirm individual fields early if they wish. The mandatory confirmation point is the REVIEW_PENDING screen.

### 9.6 Aggregate provenance score

The Validation Engine computes an aggregate provenance score displayed to the user:

```
aggregateProvenance = Σ(provenanceWeight(field) for each mandatory field)
                    / count(mandatory fields)

where:
  provenanceWeight(source=null)                                = 0     // MISSING
  provenanceWeight(any, verification=VALIDATED)                 = 1.0   // post-gate
  provenanceWeight(any, verification=CONFIRMED)                = 1.0   // engine-ready
  provenanceWeight(any source≠null, verification=UNVERIFIED)   = 0.5   // has value, not confirmed
```

Note: source does not appear in the weight formula. A `USER`/`UNVERIFIED` field and a `KNOWLEDGE`/`UNVERIFIED` field contribute identically. The REVIEW_PENDING screen is what upgrades all UNVERIFIED fields to CONFIRMED.

A profile with 100% completeness but 50% aggregate provenance means all fields have values but none are confirmed — the REVIEW_PENDING screen will draw attention to this.

### 9.7 Provenance and downstream engines

Downstream engines (Eligibility, Financial, DPR) **do not consume provenance metadata**. They consume the field values. Provenance is an interview-layer concern — it determines *whether* a field is ready for engine consumption, not *how* the engine processes it.

**However, the Validation Engine enforces a provenance gate.** A profile cannot transition from `REVIEW_PENDING` to `VALIDATED` (and thus unlock downstream engines) until all mandatory fields have verification=CONFIRMED. In practice, pressing "Confirm Project" on the REVIEW_PENDING screen stamps all fields CONFIRMED, so this gate passes unless the user edited a field back to UNVERIFIED. See Section 11 (state machine) for the full gate logic.

This means:
- An `UNVERIFIED` value may exist in the profile during the interview (so the user can see and edit it), but it is **not** engine-ready.
- The Review phase (Phase 6) offers early inline confirmation for individual fields, but the mandatory checkpoint is the REVIEW_PENDING screen.
- The interview can progress past an unconfirmed field (to avoid blocking the conversation), but the profile cannot reach `VALIDATED` until the user presses "Confirm Project."
- When the Validation Engine runs, it returns `nonEngineReadyMandatoryFields` alongside `missingFields`. Both must be empty for the final gate to pass.

This is the enforcement of the principle that **suggested values never reach deterministic engines until the user confirms them.**

### 9.8 Provenance for DPR annotation

The DPR Engine can use the provenance metadata to annotate the generated document:

- Fields with `source=KNOWLEDGE` can be footnoted: *"Based on typical values for this activity."*
- Fields with `source=OCR` can be footnoted: *"Extracted from uploaded document."*
- Fields with `source=USER` need no annotation — they are the beneficiary's own values.
- The `knowledgeSource` field in `FieldProvenance` provides the specific Knowledge Package entry reference for traceability.

---

## 10. Suggestion Lifecycle

Suggestions are how the Knowledge Package assists beneficiaries who cannot answer technical questions on their own. The lifecycle ensures suggestions are helpful but never authoritative.

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. KNOWLEDGE PACKAGE                                              │
│                                                                  │
│    Contains reference data: machinery lists, raw material lists, │
│    indicative costs, wage benchmarks, financial ratios, etc.     │
│    This data is versioned, sourced, and read-only at runtime.    │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. KNOWLEDGE ENGINE (engines/knowledge-engine/)                   │
│                                                                  │
│    Receives a query from the interview (e.g., "machinery for     │
│    NIC 10701") and searches the Knowledge Package.               │
│    Returns structured results — never free text.                  │
│    This is a deterministic, pure, offline search engine.         │
│                                                                  │
│    Output: SuggestionResult { items: KnowledgeItem[], source,    │
│            confidence }                                           │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. SUGGESTION                                                     │
│                                                                  │
│    The interview orchestration wraps the Knowledge Engine        │
│    result into a Suggestion object that includes:                │
│    • The suggested value(s)                                       │
│    • The source (which Knowledge Package entry)                   │
│    • A reasoning string (for the AI to explain to the user)      │
│    • The target field path(s) in the ProjectProfile              │
│                                                                  │
│    The suggestion is NOT yet applied to the profile.             │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. USER REVIEW                                                    │
│                                                                  │
│    The suggestion is presented to the user — either by the AI    │
│    interview (natural language) or by the guided forms (pre-     │
│    populated form fields with a "Suggested" badge).             │
│                                                                  │
│    The user sees:                                                │
│    • What value is being suggested                               │
│    • Why (e.g., "Based on typical bakery projects")              │
│    • Options: Accept, Edit, or Skip                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. ACCEPTANCE                                                     │
│                                                                  │
│    a) ACCEPT: Value is written to the profile with               │
│       provenance.source = KNOWLEDGE, provenance.verification = UNVERIFIED. │
│                                                                  │
│    b) EDIT: User provides their own value. Written to profile    │
│       with provenance.source = USER, provenance.verification = UNVERIFIED. │
│                                                                  │
│    c) SKIP: Field remains source=null (MISSING). Interview continues. │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 6. STRUCTURED PROJECT PROFILE                                     │
│                                                                  │
│    The profile now contains the value (if accepted or edited).   │
│    The provenance metadata records how it arrived.                │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 7. VALIDATION ENGINE                                              │
│                                                                  │
│    Runs on the updated profile. Checks completeness,             │
│    validation rules, contradictions, and provenance.              │
│    Determines if the profile is ready for downstream engines.    │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 8. DETERMINISTIC ENGINES                                         │
│                                                                  │
│    Eligibility Engine, Financial Engine, DPR Engine, PDF Engine.  │
│    These engines receive the profile values. They do NOT know    │
│    and do NOT care whether a value was user-entered or           │
│    knowledge-suggested. The provenance model is invisible to     │
│    engines.                                                       │
└──────────────────────────────────────────────────────────────────┘
```

### 10.1 Inviolable rules

1. **Suggestions must never bypass confirmation.** A suggestion that is not explicitly accepted by the user is never written to the profile. The AI interview cannot silently apply a suggestion.

2. **The Knowledge Engine returns data, not decisions.** It returns matching items from the Knowledge Package. The interview (feature layer) decides what to present and how.

3. **AI-generated suggestions are prohibited.** The AI model must not invent machinery lists, cost estimates, or financial benchmarks. All suggestions originate from the Knowledge Package. The AI's role is to present them in natural language, not to generate them.

4. **Suggested values are provisional, not authoritative.** A `KNOWLEDGE`/`UNVERIFIED` value is written to the profile so the user can see and edit it, but it is **not** engine-ready. No field is engine-ready until verification=CONFIRMED (via the REVIEW_PENDING "Confirm Project" action; see Section 9.4). See Section 11 (state machine — the REVIEW_PENDING screen is the single confirmation point for all fields).

5. **The Review phase is the early safety net.** Phase 6 (Review) presents AI/OCR/KNOWLEDGE-sourced fields prominently so the user can catch issues early. But the mandatory confirmation point for ALL fields is the REVIEW_PENDING screen.

---

## 11. Project Profile State Machine

The interview phases (Section 4) describe *what* the interview does at each stage. The state machine describes *how the profile evolves* as a whole — including resume, edit, validation, and engine execution. This is the single source of truth for what transitions are legal and what each state means for the rest of the application.

### 11.1 States

```
EMPTY
  │
  ▼
PARTIAL
  │
  ▼
DISCOVERING
  │
  ▼
COMPLETE
  │
  ▼
REVIEW_PENDING
  │
  ▼
VALIDATED
  │
  ▼
ELIGIBILITY_READY
  │
  ▼
FINANCIAL_READY
  │
  ▼
DPR_READY
```

| State | Meaning | Who sets it | Who consumes it |
|-------|---------|-----------|----------------|
| `EMPTY` | Project created, no data collected. | App shell (on "New Project") | Interview / Guided Forms |
| `PARTIAL` | Some fields populated, but Phase 1 (Applicant Discovery) is not yet substantially complete. No eligibility pre-checks possible. | Interview orchestration | Interview (determines which phase to enter) |
| `DISCOVERING` | Applicant identity and category are known. Interview is in Phases 2–5. Business description, NIC code, and/or financial data may be partially collected. Activity-specific suggestions from the Knowledge Package may be present with source=KNOWLEDGE, verification=UNVERIFIED. | Interview orchestration | Interview, Knowledge Engine (for contextual suggestions) |
| `COMPLETE` | All interview phases finished. All mandatory fields have values (no MISSING mandatory fields). However, no fields are yet confirmed — all are verification=UNVERIFIED. The profile is *data-complete* but not yet *engine-ready*. | Interview orchestration (Phase 6 Review exit or Phase 7 exit) | Review UI (highlights AI/OCR/KNOWLEDGE-sourced fields), Validation Engine (pre-check) |
| `REVIEW_PENDING` | All mandatory fields have values and the Validation Engine's pre-check has passed (completeness ≥ threshold, no blocking errors, no contradictions). The profile is displayed as a **project summary** (machinery, costs, employees, loan, subsidy, working capital) and the user must explicitly press **"Confirm Project"** — this action stamps all fields with verification=CONFIRMED. This is the mandatory banking review step: the beneficiary's final acknowledgment that everything is correct. | Validation Engine (pre-check passes) → user action (Confirm Project) | User (project summary screen), Validation Engine (final gate) |
| `VALIDATED` | The user has pressed "Confirm Project" (all fields stamped verification=CONFIRMED) and the Validation Engine's final gate has passed (Zod, business rules, contradictions). All mandatory fields are now engine-ready (verification=CONFIRMED or VALIDATED). The profile is fully engine-ready. | User action (Confirm Project) + Validation Engine (final gate) | All downstream engines (gate is open) |
| `ELIGIBILITY_READY` | The Eligibility Engine has run and produced an `EligibilityResult`. This result is snapshotted in the database. The profile is unchanged. | Eligibility Engine (called by feature orchestration) | Financial Engine (may use eligibility context), DPR Engine |
| `FINANCIAL_READY` | The Financial Engine has run and produced a `FinancialResult`. This result is snapshotted in the database. | Financial Engine (called by feature orchestration) | DPR Engine (requires both eligibility + financials) |
| `DPR_READY` | The DPR Engine has assembled the document. The PDF Engine has rendered it. The user can view, share, or save the DPR. | DPR Engine + PDF Engine (called by feature orchestration) | User (view, share, save), Import/Export Engine |

### 11.2 Forward transitions

```
EMPTY ──────────[user starts interview or guided wizard]─────→ PARTIAL

PARTIAL ────────[applicant identity + category known]──────→ DISCOVERING

DISCOVERING ────[all interview phases complete]────────────→ COMPLETE

COMPLETE ───────[Validation Engine pre-check passes
                 (all mandatory fields have values, no errors)]──→ REVIEW_PENDING

REVIEW_PENDING ──[user presses "Confirm Project" +
                 Validation Engine final gate passes]─────────→ VALIDATED

VALIDATED ──────[Eligibility Engine runs]──────────────────→ ELIGIBILITY_READY

ELIGIBILITY_READY ──[Financial Engine runs]────────────────→ FINANCIAL_READY

FINANCIAL_READY ──[DPR + PDF Engine runs]──────────────────→ DPR_READY
```

### 11.3 Edit transitions (going backward)

When the user edits a previously-collected field, the profile may need to move backward:

```
DPR_READY ──────[user edits any input]─────────────────────→ REVIEW_PENDING
FINANCIAL_READY ──[user edits financial inputs]────────────→ REVIEW_PENDING
ELIGIBILITY_READY ──[user edits financial inputs]──────────→ REVIEW_PENDING
                 (eligibility may still be valid;
                  financial result is invalidated)

REVIEW_PENDING ──[user edits any field]────────────────────→ COMPLETE
                 (re-validation required;
                  downstream engine results are invalidated
                  but NOT deleted — they become stale snapshots)

VALIDATED ──────[user edits any field]─────────────────────→ REVIEW_PENDING
                 (re-confirmation required;
                  downstream engine results are invalidated
                  but NOT deleted — they become stale snapshots)

ANY pre-validation state ──[user edits a dependency root
                 (NIC code, sector, category)]────────────→ DISCOVERING
                 (dependents flagged for re-collection)
```

**Rules for edit transitions:**

1. **Edits invalidate forward, never backward.** Editing the NIC code (Phase 3 data) invalidates machinery and financials (Phase 4–5 data), but does not invalidate the applicant's name (Phase 1 data).
2. **Invalidated engine results are not deleted.** They become stale snapshots in the database, tagged with the `knowledgeVersion` and profile version that produced them. This preserves reproducibility and audit history.
3. **The user must explicitly regenerate.** After an edit, the app informs the user which downstream results are now stale and offers to re-run the affected engines. Already-generated DPRs are never silently rewritten.
4. **State moves forward one step at a time through the engine pipeline.** The user cannot jump from `DPR_READY` directly to re-running just the Financial Engine — the app walks through `REVIEW_PENDING` → `VALIDATED` → `ELIGIBILITY_READY` → `FINANCIAL_READY`, re-running each engine in sequence. This ensures every gate is re-evaluated.

### 11.4 Resume behavior

When the user opens an existing project:

1. Load the persisted profile from SQLite.
2. Determine the current state from the stored `status` column and the presence/absence of engine snapshots.
3. If state is `EMPTY` through `DISCOVERING`: resume the interview at the last active phase.
4. If state is `COMPLETE`: enter the Review phase (Phase 6) to confirm any non-engine-ready fields, then attempt the validation pre-check.
5. If state is `REVIEW_PENDING`: present the project summary screen. The user can edit (which moves state backward per §11.3) or press "Confirm Project" to proceed.
6. If state is `VALIDATED` or later: present the project dashboard showing engine results. The user can edit (which moves the state backward per §11.3) or view/export the DPR.
7. If the user's edit moves the state backward, re-run the interview/workflow from the appropriate point.

### 11.5 State machine and the validation gate

The state machine **is** the enforcement of Design Principle 14 ("Project Completion & Validation gates the engines").

- States `EMPTY` through `COMPLETE` are **pre-validation**. No engine may run.
- The transition `COMPLETE → REVIEW_PENDING` requires the Validation Engine's **pre-check** to pass — all mandatory fields must have values (no MISSING fields), completeness must meet the threshold, and no blocking errors or unresolved contradictions. Verification is NOT checked here — that is the purpose of REVIEW_PENDING.
- `REVIEW_PENDING` is the **user review and confirmation checkpoint**. The app displays a project summary (machinery, project cost, employees, loan amount, subsidy, working capital). When the user presses **"Confirm Project,"** all fields are stamped with verification=CONFIRMED. This creates a clean audit trail: the beneficiary has seen and approved the full project before any calculation runs.
- The transition `REVIEW_PENDING → VALIDATED` requires the Validation Engine's **final gate** to pass — Zod schema validation, business rules, and contradiction checks run against the now-confirmed profile. This is a lightweight check since data presence and completeness were already verified at the pre-check.
- States `VALIDATED` through `DPR_READY` are **post-validation**. Engines run sequentially, each producing a snapshot that the next engine consumes.

### 11.6 Persistence

The profile state is stored in the `project` table (doc 03) as the `status` column. The column holds the current state string (`EMPTY`, `PARTIAL`, `DISCOVERING`, `COMPLETE`, `REVIEW_PENDING`, `VALIDATED`, `ELIGIBILITY_READY`, `FINANCIAL_READY`, `DPR_READY`). Engine snapshots are stored in their respective tables (`project_financials`, `dpr_document`) keyed to the project.

The state column is the single source of truth for the UI (which screens to show), the interview (whether to resume or present results), and the feature orchestration (which engines to run or re-run).

### 11.6.1 Extensibility

The state machine is designed to accommodate future post-DPR states without breaking existing transitions. Potential additions (not for v1, but architecturally expected):

- **`BANK_SUBMITTED`** — The DPR has been submitted to a bank or financial institution.
- **`FINALIZED`** — The project is locked — no further edits permitted. The DPR is the authoritative version.

These would extend the pipeline after `DPR_READY`. Adding them would not change any existing transitions — they would add new forward transitions from `DPR_READY` and new edit transitions (e.g., `BANK_SUBMITTED → REVIEW_PENDING` if the bank requests changes).

The `status` column uses a free-text string (not an enum in SQLite), so new states can be added without a schema migration.

### 11.7 State machine and provenance interaction

The state machine and the provenance model (Section 9) interact at two critical points:

**1. The `COMPLETE → REVIEW_PENDING` transition (data gate):**

- A profile in `COMPLETE` state has all mandatory fields populated (no MISSING fields).
- The Validation Engine checks completeness, blocking errors, and contradictions.
- Verification is NOT a factor here — fields are expected to be UNVERIFIED at this point.
- If any mandatory field is MISSING, or if there are blocking errors/contradictions, the transition is **blocked**.

**2. The `REVIEW_PENDING → VALIDATED` transition (confirmation gate + final validation):**

- The user has pressed "Confirm Project," which stamps all fields with verification=CONFIRMED.
- The Validation Engine performs the **final gate** check: Zod validation, business rules, contradictions.
- On success, all field provenance entries have their `verification` stamped to `VALIDATED`.

This ensures the principle is enforced at the architectural level: **no value reaches a deterministic engine without user confirmation.** The REVIEW_PENDING screen is the single, non-bypassable confirmation point for all fields regardless of source.

---

## 12. Relationship to Existing Architecture

This document fills the gap between the user and the Validation Engine. It does not change any existing architectural decisions — it specifies what was previously left implicit.

### 12.1 What this document defines (new)

| Concept | Where it was before | Where it is now |
|---------|-------------------|-----------------|
| Structured Project Profile schema | Referenced everywhere, never specified | Canonical definition in Section 2 |
| AI reasoning pipeline | Implicitly described in doc 04 §4 | Full 8-stage pipeline in Section 3 |
| Interview phases | Not specified | 7-phase model in Section 4 |
| Knowledge-assisted interview | Briefly mentioned in AGENTS.md | Full specification in Section 5 |
| Activity discovery lifecycle | Partially in AGENTS.md §Knowledge Engine | Full lifecycle in Section 6 |
| Field dependency graph | Not specified | Defined in Section 7 |
| "I don't know" handling | Not specified | Full strategy in Section 8 |
| Confidence model | Referenced in doc 04 §5 and doc 15 §2 | Two-dimensional provenance model (Source × Verification) in Section 9 |
| Suggestion lifecycle | Not specified | Full lifecycle in Section 10 |
| Field ownership | Not specified | Defined in Section 2.3 |

### 12.2 What this document does NOT change

- Design Principles (principles 1–15) — unchanged
- Engine responsibilities (Financial, Eligibility, DPR, PDF, Validation, Knowledge) — unchanged
- Provider abstraction — unchanged
- Data model (SQLite schema in doc 03) — the profile schema in Section 2 is the *application-level* contract; the SQLite schema in doc 03 is the *persistence-level* contract. They map 1:1 but serve different readers.
- Folder structure (doc 02) — no new engine or folder is introduced. The interview orchestration lives in `features/ai/`, as already specified.
- Knowledge Package boundaries (doc 09, AGENTS.md) — unchanged. Suggestions come from Knowledge Package data, not from AI.
- Security and privacy (doc 13) — unchanged. PII is redacted before prompts; suggestions contain no PII.

### 12.3 Where each concern lives

| Concern | Owner | Document |
|---------|-------|----------|
| Structured Project Profile definition | This document | Section 2 |
| Interview reasoning pipeline | This document | Section 3 |
| Interview phases | This document | Section 4 |
| Knowledge-assisted interview | This document | Section 5 |
| Activity discovery | This document | Section 6 |
| Field dependencies | This document | Section 7 |
| "I don't know" handling | This document | Section 8 |
| Provenance model | This document | Section 9 |
| Suggestion lifecycle | This document | Section 10 |
| Field ownership | This document | Section 2.3 |
| Validation (gate) | Validation Engine | [04 §5](04-ai-architecture.md), [15 §2](15-application-workflows.md) |
| Eligibility determination | Eligibility Engine | [06](06-eligibility-engine.md) |
| Financial calculations | Financial Engine | [05](05-financial-engine.md) |
| DPR assembly | DPR Engine | [07](07-dpr-engine.md) |
| AI provider abstraction | Provider Manager | [04 §3](04-ai-architecture.md) |
| Knowledge Package data | Knowledge Package | [09](09-knowledge-package.md) |
| Offline behavior | System architecture | [01 §5](01-system-architecture.md) |
| Privacy & PII | Security architecture | [13](13-security-and-privacy.md) |
| Prompt templates | Knowledge Package | [09 §2](09-knowledge-package.md), [04 §9](04-ai-architecture.md) |

---

## 13. Success Criteria

This architecture document must answer these questions unambiguously:

1. **What exactly is a Structured Project Profile?**
   → Section 2. A typed, Zod-validated object with 13 top-level sections covering applicant, business, location, land, capacity, machinery, raw materials, employees, utilities, financials, working capital, market, attachments, validation metadata, provenance metadata, and completion metadata. Both the AI interview and guided forms produce an identical instance.

2. **How does the AI decide the next question?**
   → Section 3, Stages 4–7. The Validation Engine identifies missing fields and contradictions. The dependency graph determines which fields are askable. The phase model determines the current focus area. The question planner selects the highest-priority askable field.

3. **How are NIC activities discovered?**
   → Section 6. The Knowledge Engine searches the NIC code database using the beneficiary's business description. Candidates are presented for user confirmation. Once confirmed, NIC code, sector, sub-category, and activity type are fixed. PMEGP rules are then determined.

4. **How does the Knowledge Package assist beneficiaries?**
   → Section 5. When a beneficiary cannot answer a technical question, the interview queries the Knowledge Package for suggested values (machinery, costs, benchmarks). Suggestions are presented for explicit acceptance — never silently applied.

5. **How are suggestions handled?**
   → Section 10. Knowledge Package → Knowledge Engine → Suggestion → User Review → Acceptance → Profile → Validation → Engines. Suggestions never bypass confirmation. AI-generated suggestions are prohibited.

6. **How are unknown answers handled?**
   → Section 8. Uncertainty is detected → Knowledge Package provides suggestion → AI explains suggestion → User accepts, edits, or skips. "I don't know" is never an error and never blocks the conversation.

7. **How does provenance work?**
   → Section 9. Every field carries two orthogonal dimensions: Source (USER, AI, OCR, KNOWLEDGE, null) and Verification (UNVERIFIED, CONFIRMED, VALIDATED). Engine readiness is determined solely by verification — a field must be CONFIRMED or VALIDATED for engines to consume it. Source is for audit trails and DPR annotation, not for gate logic. The REVIEW_PENDING screen is the single mandatory confirmation point for all fields.

8. **How do interview phases work?**
   → Section 4. Seven sequential phases: Applicant Discovery → Business Discovery → Activity Resolution → Project Sizing → Financial Planning → Review → Validation Completion. Each phase has a clear objective and exit condition. Within a phase, question order is flexible; phase order is fixed by dependencies.

9. **How do deterministic engines receive clean, validated data?**
   → The Validation Engine (doc 04 §5, doc 15 §2) gates all downstream engines. Engines receive the Structured Project Profile only after validation passes. The profile is the single data contract — engines never see conversation messages, form state, or provenance metadata.