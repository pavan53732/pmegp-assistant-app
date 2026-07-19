// ─── Project Profile State Machine ────────────────────────────────────────
// See doc 16 §11. The 9 states a project progresses through.
// ───────────────────────────────────────────────────────────────────────────

/**
 * The 9 states a project profile progresses through.
 *
 * Forward:  EMPTY → PARTIAL → DISCOVERING → COMPLETE → REVIEW_PENDING
 *          → VALIDATED → ELIGIBILITY_READY → FINANCIAL_READY → DPR_READY
 *
 * Edit transitions go backward (see doc 16 §11.3).
 */
export type ProjectStatus =
  | "EMPTY"
  | "PARTIAL"
  | "DISCOVERING"
  | "COMPLETE"
  | "REVIEW_PENDING"
  | "VALIDATED"
  | "ELIGIBILITY_READY"
  | "FINANCIAL_READY"
  | "DPR_READY";

/**
 * The source that populated a line item (machinery, raw material, etc.).
 */
export type ItemSource = "USER" | "AI" | "KNOWLEDGE" | "OCR";