// ─── Guided Forms — Barrel Exports ───────────────────────────────────────
// Public API for the Guided Forms fallback wizard (Design Principle 7:
// AI-first with fallback). See `GuidedFormsWizard.tsx` for the invariant
// that this path produces a ProjectProfile identical to the AI interview.
// ───────────────────────────────────────────────────────────────────────────

export { GuidedFormsWizard } from "./GuidedFormsWizard";
export type { GuidedFormsWizardProps } from "./GuidedFormsWizard";

// Pure helpers (safe to import from anywhere — no React, no I/O).
export {
  PHASE_ORDER,
  PHASE_CONFIGS,
  DATA_PHASES,
  getFieldValue,
  setFieldValue,
  buildInitialProfile,
  getPhaseFields,
  getPhaseDotPaths,
  isDataPhase,
  isPhaseComplete,
  profileToFormData,
  formDataToProfile,
  stampFieldProvenance,
  stampPhaseProvenance,
  invalidateDownstreamPhases,
} from "./field-utils";
export type { FlatFormData } from "./field-utils";
