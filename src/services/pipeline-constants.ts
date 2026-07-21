// ─── Pipeline Constants & Types (Client-Safe) ──────────────────────────────
// Pure constants, types, and utility functions for the pipeline.
// This file has NO Node.js / engine dependencies and can be safely
// imported from client components.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectStatus } from "@/shared/types/state-machine";

// ── Public Types ───────────────────────────────────────────────────────────

/** Result returned by a single pipeline step execution. */
export interface PipelineStepResult {
  /** Whether the step completed successfully. */
  success: boolean;
  /** The new project status after this step. */
  status: ProjectStatus;
  /** Step-specific output data. */
  data: Record<string, unknown>;
  /** Error messages (empty on success). */
  errors: string[];
  /** Warning messages (non-blocking issues). */
  warnings: string[];
}

/** Valid pipeline step identifiers. */
export type PipelineStep = "eligibility" | "financial" | "dpr" | "pdf";

/** Stored engine outputs inside the profile's pipeline outputs (transient). */
export interface EngineOutputs {
  eligibilityResult?: Record<string, unknown>;
  financialResult?: Record<string, unknown>;
  dprDocument?: Record<string, unknown>;
  pdfGenerated?: boolean;
  pdfBase64?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Ordered list of all pipeline steps. */
export const PIPELINE_STEPS: PipelineStep[] = [
  "eligibility",
  "financial",
  "dpr",
  "pdf",
];

/** Map from status to the step index (0-based) for determining progress. */
export const STATUS_TO_STEP_INDEX: Record<string, number> = {
  VALIDATED: 0,
  ELIGIBILITY_READY: 1,
  FINANCIAL_READY: 2,
  DPR_READY: 3,
};

/** Valid step parameter values. */
export const VALID_STEPS = new Set<string>(PIPELINE_STEPS);

// ── Utility Functions ──────────────────────────────────────────────────────

/**
 * Determine the current pipeline step index from a project status.
 * Returns 0 if the project is at VALIDATED (ready for eligibility step),
 * 1 for ELIGIBILITY_READY, 2 for FINANCIAL_READY, 3 for DPR_READY.
 * Returns -1 for statuses outside the pipeline.
 */
export function getPipelineStepIndex(status: string): number {
  return STATUS_TO_STEP_INDEX[status] ?? -1;
}

/**
 * Get the pipeline step that should run next for a given status.
 * Returns null if all steps are complete or status is not in the pipeline.
 */
export function getNextPipelineStep(status: string): PipelineStep | null {
  const idx = getPipelineStepIndex(status);
  if (idx < 0 || idx >= PIPELINE_STEPS.length) {
    return null;
  }
  return PIPELINE_STEPS[idx];
}