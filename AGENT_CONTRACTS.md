# Agent Contracts

**Version:** 1.0
**Status:** ENFORCED — Every coding agent MUST read this before writing code for any subsystem.
**Purpose:** Prevent merge conflicts and architectural drift by defining strict per-subsystem boundaries.

This document complements IMPLEMENTATION_RULES.md. Rules there apply globally; contracts here are subsystem-specific.

---

## How to Use This Document

1. Find your assigned subsystem below.
2. Read the **Owner**, **Public API**, **Allowed Imports**, **Forbidden Imports**, and **Event Contracts**.
3. You may ONLY access other subsystems through their listed Public API.
4. If you need something not in a Public API, file a request — do NOT reach across boundaries.

---

## 1. Shared Types (`src/shared/types/`)

### Owner
Foundation layer — owned by architecture, not any feature team.

### Public API
```typescript
// Re-exported from src/shared/types/index.ts
export type { ProjectProfile, Applicant, Business, Location, Land, Capacity,
  Machinery, MachineryItem, RawMaterials, RawMaterialItem, Employees,
  Utilities, Financials, WorkingCapitalDetail, Market, Attachments,
  Validation, ValidationError, Contradiction, Completion,
  Gender, ApplicantCategory, Education, EntityType, ActivityType, Sector,
  SubCategory, UrbanRural, LandStatus, BuildingType, InstalledCapacity,
  EmployeeGroup, AdministrativeStaff, WorkingCapitalMethod,
  AttachmentType, AttachmentStatus, AttachmentRef, ItemSource } from "./project-profile";

export type { FieldProvenance, ProvenanceMetadata, ProvenanceSource, VerificationStatus } from "./provenance";
export type { ProjectStatus } from "./state-machine";
export type { InterviewPhase, PhaseProgress } from "./interview";
```

### Allowed Imports
- Nothing internal (shared/ depends on nothing).

### Forbidden Imports
- `@/engines/*`, `@/features/*`, `@/database/*`, `@/providers/*`, `@/knowledge-package/*`
- `react`, `next`, `prisma`, `@/database/sqlite`

### Events Emitted
- None (types only).

### Events Consumed
- None.

### Rules
- All types here are **frozen contracts**. Do NOT modify signatures without architecture review.
- Money fields are ALWAYS `number` (integer rupees). Never `float`, never `string`.
- All enums use string literal union types. Never numeric enums.

---

## 2. Zod Schemas (`src/shared/types/schemas/`)

### Owner
Foundation layer — owned by architecture.

### Public API
```typescript
export { projectProfileSchema } from "./schemas/project-profile";
// Type: z.ZodType<ProjectProfile>
// Usage: projectProfileSchema.parse(unknownData) → ProjectProfile
```

### Allowed Imports
- `@/shared/types/*` (for type references in schema definitions)
- `zod`

### Forbidden Imports
- Everything else.

### Events
- None.

---

## 3. Knowledge Package (`src/knowledge-package/`)

### Owner
Knowledge Team (Milestone 2).

### Public API
```typescript
// From src/knowledge-package/index.ts
export function searchNicCodes(query: string): NicCodeEntry[];
export function getNicCode(code: string): NicCodeEntry | undefined;
export function getNicCodesByType(type: NicSector): NicCodeEntry[];
export function getMetadata(): NicCodeMetadata;
export function getTotalCount(): number;

// Types
export type { NicCodeEntry, NicSector, NicSubCategory, NicCodeMetadata } from "./types";
```

### Allowed Imports
- Nothing internal. This package is leaf-level.
- `zod` (for internal validation only, not re-exported).

### Forbidden Imports
- `@/engines/*`, `@/features/*`, `@/database/*`, `@/providers/*`, `@/database/sqlite`
- `react`, `next`, `prisma`
- `@/shared/types/*` (knowledge package is standalone data; it does NOT depend on app types)

### Events
- None. The knowledge package is synchronous and read-only at runtime.

### Data Files (bundled JSON)
- `data/nic_codes_manufacturing.json` — 4,238 entries
- `data/nic_codes_service_service.json` — 5,828 entries
- `data/nic_codes_service_trading.json` — 134 entries
- `data/nic_codes_service_transport.json` — 200 entries
- `data/nic_codes_metadata.json` — sector structure and file manifest

### Rules
- All data is loaded synchronously (bundled, not fetched).
- Singleton cache — data loaded once on first call.
- NEVER modify data at runtime.
- Adding new data files requires updating `loader.ts` and `types.ts`.

---

## 4. Event Bus (`src/shared/events/`)

### Owner
Foundation layer — owned by architecture.

### Public API
```typescript
// From src/shared/events/index.ts
export class EventBus {
  on<K extends keyof EventTypeMap>(eventType: K, handler: EventHandler<EventTypeMap[K]>): () => void;
  onAny(handler: EventHandler): () => void;
  emit(event: AnyAppEvent): void;
  off(eventType: string): void;
  clear(): void;
  getHistory(): readonly AnyAppEvent[];
  listenerCount(eventType?: string): number;
}

export function getEventBus(): EventBus;
```

### 13 Event Types (from event-types.ts)
| Event Type | Payload | Emitted By |
|---|---|---|
| `PROJECT_CREATED` | `{ projectName: string }` | Interview Store |
| `PROJECT_STATE_CHANGED` | `{ previousState, newState, reason }` | Interview Store |
| `PROJECT_DELETED` | `{}` | Repository (caller) |
| `PROJECT_UPDATED` | `{ profile, changedFields, source }` | Interview Store |
| `PROJECT_CONFIRMED` | `{ confirmedProfile }` | Interview Store |
| `VALIDATION_COMPLETED` | `{ completeness, missingFields, errors, contradictions, canEnterReview, canValidate, gate }` | Interview Store |
| `ENGINE_STARTED` | `{ engine: EngineType }` | Any engine runner |
| `ENGINE_COMPLETED` | `{ engine, success, result, durationMs }` | Any engine runner |
| `ENGINE_FAILED` | `{ engine, error }` | Any engine runner |
| `INTERVIEW_PHASE_CHANGED` | `{ previousPhase, newPhase }` | Interview Store |
| `AI_MESSAGE` | `{ message, phase, targetField? }` | AI Interview (M3) |
| `SUGGESTION_PRESENTED` | `{ fieldPath, suggestedValue, source, reasoning }` | Knowledge Engine (M2) |
| `PROJECT_PERSISTED` | `{ state: ProjectStatus }` | Interview Store |

### Allowed Imports
- `@/shared/types/*` (for type references in event payloads)

### Forbidden Imports
- `@/engines/*`, `@/features/*`, `@/database/*`, `@/providers/*`, `@/database/sqlite`
- `react`, `next`, `prisma`

### Rules
- Adding a new event type requires updating `event-types.ts` AND this document.
- EventBus is a singleton. Use `getEventBus()`, never instantiate directly.
- Handler errors are caught and logged — they never break other handlers.

---

## 5. Database / Repository (`src/database/`)

### Owner
Infrastructure Team (Milestone 9 for hardening).

### Public API
```typescript
// From src/database/interfaces.ts
export interface IProjectRepository {
  create(name: string): Promise<ProjectSummary>;
  getById(id: string): Promise<(ProjectSummary & { profile: ProjectProfile }) | null>;
  list(): Promise<ProjectSummary[]>;
  updateProfile(id: string, profile: ProjectProfile, status?: ProjectStatus): Promise<void>;
  updateStatus(id: string, status: ProjectStatus): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  businessName: string;
  businessDescription: string;
  nicCode: string | null;
  totalProjectCost: number;
  completeness: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Allowed Imports
- `@/shared/types/*` (ProjectProfile, ProjectStatus)
- `@/database/sqlite` (Capacitor SQLite client — ONLY within `src/database/`)

### Forbidden Imports
- `@/engines/*`, `@/features/*`, `@/providers/*`
- `react`, `next`
- Any direct `import { db } from '@/database/sqlite'` OUTSIDE `src/database/` is a RULE #8 violation.

### Events Consumed
- `PROJECT_DELETED` (to clean up)

### Events Emitted
- `PROJECT_PERSISTED` (after successful save)

### Rules
- ALL database access MUST go through `IProjectRepository`.
- `ProjectProfile` is serialized as JSON in the `profileData` column.
- Repository is the ONLY module that imports `@/database/sqlite`.

---

## 6. Validation Engine (`src/engines/validation-engine/`)

### Owner
Engine Team A (complete — owned contract).

### Public API
```typescript
export interface ValidationResult {
  completeness: number;             // 0-100
  missingFields: string[];          // dot-paths
  nonEngineReadyMandatoryFields: string[]; // dot-paths
  errors: ValidationError[];
  contradictions: Contradiction[];
  canEnterReview: boolean;          // DATA GATE
  canValidate: boolean;             // CONFIRMATION GATE
  aggregateProvenance: number;      // 0-1
}

export function validateProject(profile: ProjectProfile): ValidationResult;
```

### Allowed Imports
- `@/shared/types/project-profile` (ProjectProfile, ValidationError, Contradiction)
- `@/shared/types/provenance` (FieldProvenance)
- `@/knowledge-package/*` (for NIC code validity check)

### Forbidden Imports
- `@/engines/*` (sibling engines)
- `@/features/*`, `@/database/*`, `@/providers/*`, `@/database/sqlite`
- `react`, `next`, `prisma`, `ai` / any AI SDK

### Events Emitted
- None (pure function). The caller (Interview Store) emits `VALIDATION_COMPLETED`.

### Events Consumed
- None.

### Rules
- Pure function: `(profile: ProjectProfile) => ValidationResult`.
- NO mutations. NO I/O. NO side effects.
- Owns ONLY `validation.*` fields in ProjectProfile.
- Two-phase gating: `canEnterReview` (data gate) → `canValidate` (confirmation gate).

---

## 7. Eligibility Engine (`src/engines/eligibility-engine/`)

### Owner
Engine Team A (complete — owned contract).

### Public API
```typescript
export interface EligibilityCheck {
  criterionId: string;
  label: string;
  passed: boolean;
  actual?: string | number;
  required?: string | number;
  reason: string;
}

export interface EligibilityResult {
  eligible: boolean;
  checks: EligibilityCheck[];
  blockers: string[];
  warnings: string[];
}

export function checkEligibility(profile: ProjectProfile): EligibilityResult;
```

### Allowed Imports
- `@/shared/types/project-profile` (ProjectProfile, Education, EntityType)

### Forbidden Imports
- `@/engines/*`, `@/features/*`, `@/database/*`, `@/providers/*`, `@/database/sqlite`
- `react`, `next`, `prisma`, `ai` / any AI SDK
- `@/knowledge-package/*` (eligibility rules are self-contained)

### Events Emitted
- None. Caller emits `ENGINE_COMPLETED`.

### Events Consumed
- None.

### Rules
- Pure function. Same input → same output.
- 7 hard checks: age min/max, negative list, cost ceiling, prior assistance, entity type, education.
- Returns ALL checks (passing + failing) for UI rendering.
- Never blocks on external data.

---

## 8. Financial Engine (`src/engines/financial-engine/`)

### Owner
Engine Team A (complete — owned contract).

### Public API
```typescript
export interface LoanScheduleEntry {
  month: number;
  openingBalance: number;
  emi: number;
  interest: number;
  principal: number;
  closingBalance: number;
}

export interface FinancialResult {
  // Means of Finance
  totalProjectCost: number;
  ownContribution: number;
  ownContributionPercent: number;
  bankFinance: number;
  subsidyRate: number;
  subsidyAmount: number;
  bankTermLoan: number;
  bankWorkingCapital: number;

  // Loan
  emi: number;
  loanTenureMonths: number;
  repaymentMoratoriumMonths: number;
  totalInterest: number;
  totalRepayment: number;

  // Profitability
  monthlyOperatingCosts: number;
  annualRevenue: number;
  annualExpenditure: number;
  annualNetProfit: number;

  // Ratios
  annualDepreciation: number;
  dscr: number;           // float
  breakEvenPercent: number; // float

  // Repayment schedule
  loanSchedule: LoanScheduleEntry[];
}

export function computeFinancials(profile: ProjectProfile): FinancialResult;
```

### Allowed Imports
- `@/shared/types/project-profile` (ProjectProfile)

### Forbidden Imports
- `@/engines/*`, `@/features/*`, `@/database/*`, `@/providers/*`, `@/database/sqlite`
- `react`, `next`, `prisma`, `ai` / any AI SDK
- `@/knowledge-package/*`

### Events Emitted
- None. Caller emits `ENGINE_COMPLETED`.

### Events Consumed
- None.

### Rules
- Pure function. "AI never calculates."
- All rupee values are integers (`Math.round`). DSCR and break-even are floats.
- Subsidy rates: General Urban 15%, General Rural 25%, Special Urban 25%, Special Rural 35%.
- Depreciation: straight-line, 10 years, 0 salvage.
- DSCR minimum threshold: 1.5.

---

## 9. Knowledge Engine (`src/engines/knowledge-engine/`)

### Owner
Knowledge Team (Milestone 2 — IN PROGRESS).

### Public API (Planned)
```typescript
export interface ActivitySuggestion {
  nicCode: string;
  description: string;
  sector: NicSector;
  subCategory: NicSubCategory;
  matchScore: number;  // 0-1 relevance
  matchReason: string;
}

export interface MachinerySuggestion {
  name: string;
  specification?: string;
  typicalQuantity: number;
  estimatedUnitCost: number;
  estimatedUnitCostRange: [number, number]; // [min, max] in rupees
  isEssential: boolean;
  category: string; // e.g. "PRIMARY", "AUXILIARY", "ANCILLARY"
}

export interface RawMaterialSuggestion {
  name: string;
  specification?: string;
  typicalMonthlyQuantity: number;
  unit: string;
  estimatedUnitRate: number;
  estimatedUnitRateRange: [number, number]; // [min, max] in rupees
}

export interface EmployeeSuggestion {
  role: string;
  category: "SKILLED" | "UNSKILLED" | "ADMINISTRATIVE";
  typicalCount: { min: number; max: number };
  estimatedMonthlyWage: number;
  estimatedMonthlyWageRange: [number, number]; // [min, max] in rupees
}

export interface UtilitySuggestion {
  type: string; // e.g. "POWER", "WATER", "RENT"
  description: string;
  estimatedMonthlyCost: number;
  estimatedMonthlyCostRange: [number, number]; // [min, max] in rupees
}

export interface CapacitySuggestion {
  unit: string;           // e.g. "kg/month", "units/month"
  typicalRange: { min: number; max: number };
  capacityUtilPercent: number; // typical 60-80
}

export interface MarketSuggestion {
  targetMarket: string;
  sellingPricePerUnit?: number;
  sellingPriceUnit?: string;
  competitionLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface ProjectSizeSuggestion {
  totalProjectCostRange: [number, number]; // [min, max] in rupees
  subsidyRate: number;
  bankFinancePercent: number;
  ownContributionPercent: number;
  recommendedCeiling: number; // ₹25L or ₹50L based on category
}

// ── Main API ──
export function resolveActivity(query: string): ActivitySuggestion[];
export function suggestMachinery(nicCode: string): MachinerySuggestion[];
export function suggestRawMaterials(nicCode: string): RawMaterialSuggestion[];
export function suggestEmployees(nicCode: string, projectScale?: "SMALL" | "MEDIUM" | "LARGE"): EmployeeSuggestion[];
export function suggestUtilities(nicCode: string): UtilitySuggestion[];
export function suggestCapacity(nicCode: string): CapacitySuggestion;
export function suggestMarket(nicCode: string, location?: { state: string; district: string }): MarketSuggestion[];
export function suggestProjectSize(activityType: ActivityType, category: ApplicantCategory, area: UrbanRural): ProjectSizeSuggestion;
```

### Allowed Imports
- `@/knowledge-package/*` (NIC codes, rule data)
- `@/shared/types/project-profile` (ActivityType, ApplicantCategory, UrbanRural)
- `@/shared/types/provenance` (for knowledgeSource references)

### Forbidden Imports
- `@/engines/*` (sibling engines)
- `@/features/*`, `@/database/*`, `@/providers/*`, `@/database/sqlite`
- `react`, `next`, `prisma`, `ai` / any AI SDK

### Events Emitted
- `SUGGESTION_PRESENTED` — when a suggestion is generated (via caller).

### Events Consumed
- None (pure functions, called by Interview Store or AI Interview).

### Rules
- Pure functions. NO I/O. NO AI calls.
- ALL suggestions come from bundled data (Knowledge Package). AI-generated suggestions are PROHIBITED.
- The Interview Store MUST access Knowledge Engine, NEVER raw JSON files.
- Synonym expansion for activity search (e.g., "tailoring" → "sewing", "stitching", "garment making").
- Results include estimated cost ranges in INR (integer rupees).
- Ranking: match score + relevance + PMEGP scheme alignment.

---

## 10. DPR Engine (`src/engines/dpr-engine/`)

### Owner
DPR Team (Milestone 6 — STUB).

### Public API (Planned)
```typescript
export interface DprSection {
  id: string;
  title: string;
  content: string;        // Markdown or structured text
  tables?: DprTable[];
  order: number;
}

export interface DprTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

export interface DprDocument {
  sections: DprSection[];
  financialResult: FinancialResult;
  eligibilityResult: EligibilityResult;
  generatedAt: string; // ISO timestamp
  wordCount: number;
}

export function generateDPR(profile: ProjectProfile, financial: FinancialResult, eligibility: EligibilityResult): DprDocument;
```

### Allowed Imports
- `@/shared/types/*` (ProjectProfile)
- `@/engines/financial-engine` (FinancialResult)
- `@/engines/eligibility-engine` (EligibilityResult)

### Forbidden Imports
- `@/features/*`, `@/database/*`, `@/providers/*`, `@/database/sqlite`
- `react`, `next`, `prisma`, `ai` / any AI SDK

### Events Emitted
- None. Caller emits `ENGINE_COMPLETED`.

### Events Consumed
- None.

### Rules
- Pure function. NO I/O.
- Sections: Executive Summary, About the Promoter, Project Description, Market Potential,
  Technical Aspects (Machinery, Raw Materials, Utilities), Capacity, Means of Finance,
  Profitability, Repayment Schedule, Employment Generation, Risk Analysis,
  Implementation Schedule, Annexures.

---

## 11. Interview Store (`src/features/ai/interview-store/`)

### Owner
AI Interview Team (Milestone 3).

### Public API
```typescript
export interface InterviewStoreState {
  projectId: string | null;
  profile: ProjectProfile | null;
  projectStatus: ProjectStatus;
  isLoading: boolean;
  error: string | null;
}

export class InterviewStore {
  getState(): InterviewStoreState;
  getProfile(): ProjectProfile | null;
  loadProject(id: string): Promise<void>;
  updateField(fieldPath: string, value: unknown, source: "USER" | "AI" | "OCR" | "KNOWLEDGE" | null): void;
  confirmProject(): void;
  setPhase(phase: InterviewPhase): void;
  subscribe(listener: (state: InterviewStoreState) => void): () => void;
}

export const interviewStore: InterviewStore; // singleton
```

### Internal Helpers (field-updater.ts)
```typescript
export function setFieldValue(profile: ProjectProfile, fieldPath: string, value: unknown): ProjectProfile;
export function getFieldValue(profile: ProjectProfile, fieldPath: string): unknown;
export function updateProvenance(map: Record<string, FieldProvenance>, fieldPath: string, source: ...): Record<string, FieldProvenance>;
export function stampAllConfirmed(map: Record<string, FieldProvenance>): Record<string, FieldProvenance>;
export function stampAllValidated(map: Record<string, FieldProvenance>): Record<string, FieldProvenance>;
export function computeDerivedFields(profile: ProjectProfile): ProjectProfile;
```

### Allowed Imports
- `@/shared/types/*`, `@/shared/events/*`
- `@/engines/validation-engine` (validateProject)
- `@/database/project-repository` (getProjectRepository)

### Forbidden Imports
- `react` (framework-agnostic)
- `next`, `prisma`, `@/database/sqlite`
- `@/engines/eligibility-engine`, `@/engines/financial-engine` (not called from store)
- `@/providers/*` (AI access is NOT in the store)

### Events Emitted
- `PROJECT_UPDATED`, `PROJECT_CONFIRMED`, `INTERVIEW_PHASE_CHANGED`, `VALIDATION_COMPLETED`, `PROJECT_PERSISTED`

### Events Consumed
- None (store is the event producer, not consumer).

### Rules
- Interview state lives HERE, never in React component state (RULE #12).
- Every field update triggers: set field → set provenance → compute derived → validate → persist → emit.
- Persistence is fire-and-forget (non-blocking).
- `confirmProject()` stamps all fields CONFIRMED and transitions to REVIEW_PENDING.

---

## 12. AI Interview (`src/features/ai/interview/`)

### Owner
AI Interview Team (Milestone 3 — NOT YET STARTED).

### Public API (Planned)
```typescript
// Conversation controller
export class InterviewController {
  startNewInterview(projectId: string): void;
  processUserMessage(message: string): Promise<string>; // returns AI response
  getCurrentMessages(): ChatMessage[];
  getActivePhase(): InterviewPhase;
  pause(): void;
  resume(): void;
  endInterview(): void;
}

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  timestamp: string;
  phase: InterviewPhase;
  targetField?: string;
}
```

### Allowed Imports
- `@/shared/types/*`, `@/shared/events/*`
- `@/features/ai/interview-store/*` (InterviewStore)
- `@/engines/knowledge-engine/*` (for suggestions)
- `@/providers/*` (AI/LLM provider)

### Forbidden Imports
- `react`, `next` (framework-agnostic controller)
- `@/engines/validation-engine`, `@/engines/eligibility-engine`, `@/engines/financial-engine`
- `@/database/*`, `@/database/sqlite`

### Events Emitted
- `AI_MESSAGE`, `SUGGESTION_PRESENTED`, `INTERVIEW_PHASE_CHANGED`

### Events Consumed
- `PROJECT_UPDATED` (to react to profile changes)
- `VALIDATION_COMPLETED` (to know when data gate is passed)

### Rules
- AI is the interviewer and writer, NEVER the calculator.
- AI must use Knowledge Engine for suggestions — never invent NIC codes or machinery.
- Conversation controller manages the 7-phase interview flow.
- Response parser extracts structured field values from free-text AI responses.

---

## 13. OCR Engine (`src/engines/ocr-engine/`)

### Owner
OCR Team (Milestone 5 — NOT YET STARTED).

### Public API (Planned)
```typescript
export interface OcrResult {
  success: boolean;
  extractedFields: Record<string, string>;
  confidence: number; // 0-1
  rawText: string;
}

export function extractFromDocument(fileBuffer: ArrayBuffer, fileType: string): Promise<OcrResult>;
export function mapOcrToProfile(ocrResult: OcrResult, documentType: AttachmentType): Partial<ProjectProfile>;
```

### Allowed Imports
- `@/shared/types/*` (ProjectProfile, AttachmentType)

### Forbidden Imports
- `react`, `next`, `prisma`, `@/database/sqlite`
- `@/engines/*` (sibling engines)
- `@/features/*`, `@/database/*`, `@/providers/*`

### Events Emitted
- None. Caller emits `ENGINE_COMPLETED`.

### Events Consumed
- None.

### Rules
- PII extracted by OCR must be masked before logging.
- OCR results are always `source: "OCR"` with `verification: "UNVERIFIED"`.

---

## 14. PDF Engine (`src/engines/pdf-engine/`)

### Owner
PDF Team (Milestone 7 — NOT YET STARTED).

### Public API (Planned)
```typescript
export function generatePdf(dpr: DprDocument): ArrayBuffer;
export function printDpr(dpr: DprDocument): void;
```

### Allowed Imports
- `@/engines/dpr-engine` (DprDocument)

### Forbidden Imports
- `react`, `next`, `prisma`, `@/database/sqlite`
- `@/engines/*` (except dpr-engine)
- `@/features/*`, `@/database/*`, `@/providers/*`

### Events Emitted
- None. Caller emits `ENGINE_COMPLETED`.

---

## 15. UI Layer (`src/app/`, `src/components/`)

### Owner
UI Team (Milestone 4 — NOT YET STARTED beyond landing page).

### Allowed Imports
- `react`, `next`, `next/navigation`
- `@/components/ui/*` (shadcn/ui)
- `@/shared/types/*`, `@/shared/events/*`
- `@/features/ai/interview-store/*` (for state reading + dispatching)
- `@/engines/knowledge-engine/*` (for search/suggestion UI)
- `@/lib/utils` (cn helper)

### Forbidden Imports
- `@/database/sqlite`, `prisma` (UI never touches database directly)
- `@/database/*` (UI uses store, not repository)
- `@/engines/validation-engine`, `@/engines/eligibility-engine`, `@/engines/financial-engine`
  (UI displays engine results; it does NOT call engines directly)

### Events Consumed
- `PROJECT_UPDATED`, `VALIDATION_COMPLETED`, `INTERVIEW_PHASE_CHANGED`, `AI_MESSAGE`,
  `SUGGESTION_PRESENTED`, `ENGINE_STARTED`, `ENGINE_COMPLETED`, `ENGINE_FAILED`

### Events Emitted
- None (UI emits store actions, not events).

### Rules
- UI displays values; it does NOT compute them (RULE #9).
- Interview state is read from Interview Store, never held in component state (RULE #12).
- All screens are responsive (mobile-first, min 44px touch targets).
- Sticky footer with `mt-auto` and `min-h-screen flex flex-col`.

---

## 16. Providers (`src/providers/`)

### Owner
Infrastructure Team.

### Public API
```typescript
// AI provider abstraction (planned)
export function getAIResponse(systemPrompt: string, userMessage: string, history: ChatMessage[]): Promise<string>;
```

### Allowed Imports
- `ai` / AI SDK (z-ai-web-dev-sdk on backend only)

### Forbidden Imports
- `@/engines/*`, `@/features/*`, `@/database/*`, `@/database/sqlite`

### Rules
- The ONLY outbound network call is to the AI endpoint.
- API key stored encrypted, never logged (RULE #13).

---

## Import Boundary Matrix

| Module → | shared/types | shared/events | knowledge-pkg | engines/* | database | features/* | providers | UI |
|---|---|---|---|---|---|---|---|---|
| **shared/types** | -- | -- | -- | -- | -- | -- | -- | -- |
| **shared/events** | types only | -- | -- | -- | -- | -- | -- | -- |
| **knowledge-pkg** | -- | -- | -- | -- | -- | -- | -- | -- |
| **engines/valid** | project-profile | -- | knowledge-pkg | -- | -- | -- | -- | -- |
| **engines/eligib** | project-profile | -- | -- | -- | -- | -- | -- | -- |
| **engines/fin** | project-profile | -- | -- | -- | -- | -- | -- | -- |
| **engines/know** | project-profile | -- | knowledge-pkg | -- | -- | -- | -- | -- |
| **engines/dpr** | project-profile | -- | -- | fin, eligib | -- | -- | -- | -- |
| **engines/ocr** | project-profile | -- | -- | -- | -- | -- | -- | -- |
| **engines/pdf** | -- | -- | -- | dpr | -- | -- | -- | -- |
| **database** | types | events | -- | -- | db only | -- | -- | -- |
| **features/store** | types, events | events | -- | valid | repo | -- | -- | -- |
| **features/interview** | types, events | events | -- | know | -- | store | providers | -- |
| **providers** | -- | -- | -- | -- | -- | -- | -- | -- |
| **UI** | types, events | events | -- | know (search) | -- | store | -- | -- |

**Legend:** `--` = not allowed. Cell value = specific allowed import.

---

## Milestone Readiness Checklist

Before marking a milestone as "ready for merge":

- [ ] `bun run lint` passes with zero errors
- [ ] All new files have correct imports per this document
- [ ] No forbidden imports detected (check with `rg` across src/)
- [ ] Event types used match the EventTypeMap
- [ ] Money fields are integers (no `toFixed`, no `parseFloat` for currency)
- [ ] No direct `@/database/sqlite` outside `src/database/`
- [ ] No engine imports from `@/features/*` or `@/providers/*`
- [ ] Knowledge Package files are read-only at runtime
- [ ] PII is masked in any log or prompt