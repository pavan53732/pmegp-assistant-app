// ─── Provenance Model ─────────────────────────────────────────────────────
// Source × Verification provenance for every field in the Structured
// Project Profile. See doc 16 §9.
// ───────────────────────────────────────────────────────────────────────────

export type ProvenanceSource = "USER" | "AI" | "OCR" | "KNOWLEDGE" | null;

export type VerificationStatus = "UNVERIFIED" | "CONFIRMED" | "VALIDATED";

export interface FieldProvenance {
  /** Where the value originated. null means the field has no value (MISSING). */
  source: ProvenanceSource;
  /** Whether the user has explicitly confirmed this value. */
  verification: VerificationStatus;
  /** ISO timestamp of user confirmation. */
  confirmedAt?: string;
  /** 0-1 confidence from AI/OCR extraction. */
  extractConfidence?: number;
  /** Knowledge Package entry reference (when source = "KNOWLEDGE"). */
  knowledgeSource?: string;
}

export interface ProvenanceMetadata {
  /** Per-field provenance keyed by dot-path (e.g. "applicant.name"). */
  perField: Record<string, FieldProvenance>;
  /** Aggregate provenance score 0-1. Weighted average of engine-ready fields. */
  aggregate: number;
}