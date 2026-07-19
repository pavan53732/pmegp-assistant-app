// ─── Interview Types ──────────────────────────────────────────────────────
// Types for the AI interview phases and progress tracking.
// See doc 16 §4 and §2.1 (completion section).
// ───────────────────────────────────────────────────────────────────────────

/**
 * The 7 interview phases the AI-driven discovery progresses through.
 */
export type InterviewPhase =
  | "APPLICANT_DISCOVERY"
  | "BUSINESS_DISCOVERY"
  | "ACTIVITY_RESOLUTION"
  | "PROJECT_SIZING"
  | "FINANCIAL_PLANNING"
  | "REVIEW"
  | "VALIDATION_COMPLETION";

/**
 * Progress tracking for a single interview phase.
 */
export interface PhaseProgress {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "NEEDS_REVIEW";
  completedFields: number;
  totalFields: number;
}