// ─── Pipeline Service ──────────────────────────────────────────────────────
// Pure orchestration service that executes engine pipeline steps.
// No UI, no I/O except through injected data.
// Each step validates the current status, runs the appropriate engine,
// and returns results with the next status transition.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProjectStatus } from "@/shared/types/state-machine";
import { checkEligibility, type EligibilityResult } from "@/engines/eligibility-engine";
import { computeFinancials, type FinancialResult } from "@/engines/financial-engine";
import { generateDPR, type DprDocument } from "@/engines/dpr-engine";
import { generatePdf } from "@/engines/pdf-engine";

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

/** Required status before each pipeline step can execute. */
const REQUIRED_STATUS: Record<PipelineStep, ProjectStatus> = {
  eligibility: "VALIDATED",
  financial: "ELIGIBILITY_READY",
  dpr: "FINANCIAL_READY",
  pdf: "DPR_READY",
};

/** Status transition after a successful step execution. */
const NEXT_STATUS: Record<PipelineStep, ProjectStatus> = {
  eligibility: "ELIGIBILITY_READY",
  financial: "FINANCIAL_READY",
  dpr: "DPR_READY",
  pdf: "DPR_READY",
};

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

// ── Internal engine result storage interface ───────────────────────────────

/** Stored engine outputs inside the profile's validation section (transient). */
export interface EngineOutputs {
  eligibilityResult?: EligibilityResult;
  financialResult?: FinancialResult;
  dprDocument?: DprDocument;
  pdfGenerated?: boolean;
  pdfBase64?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Convert an ArrayBuffer to a base-64 string. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

// ── Step Executors ─────────────────────────────────────────────────────────

/**
 * Run the eligibility engine against the project profile.
 * Checks: age 18-65, no prior subsidy, valid NIC code, project cost within
 * limits, category valid, entity type permitted, education qualification.
 */
function runEligibilityStep(profile: ProjectProfile): {
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
} {
  try {
    const result = checkEligibility(profile);
    return {
      data: { eligibilityResult: result as unknown as Record<string, unknown> },
      errors: result.blockers,
      warnings: result.warnings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Eligibility engine failed";
    return { data: {}, errors: [msg], warnings: [] };
  }
}

/**
 * Run the financial engine against the project profile.
 * Computes: totals, loan viability, EMI, DSCR, break-even, repayment schedule.
 */
function runFinancialStep(profile: ProjectProfile): {
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
} {
  try {
    const result = computeFinancials(profile);
    const warnings: string[] = [];

    // DSCR check — recommended > 1.25
    if (result.dscr < 1.25) {
      warnings.push(
        `DSCR is ${result.dscr.toFixed(2)}, below the recommended minimum of 1.25. ` +
          "The project may face difficulty servicing debt."
      );
    }

    // Break-even check — ideally < 70%
    if (result.breakEvenPercent > 70) {
      warnings.push(
        `Break-even is ${result.breakEvenPercent.toFixed(1)}%, above the safe threshold of 70%. ` +
          "Consider reducing fixed costs or increasing sales."
      );
    }

    // Negative net profit
    if (result.annualNetProfit < 0) {
      return {
        data: { financialResult: result as unknown as Record<string, unknown> },
        errors: [
          `Annual net profit is negative (${result.annualNetProfit}). Project is not financially viable.`,
        ],
        warnings: [],
      };
    }

    return {
      data: { financialResult: result as unknown as Record<string, unknown> },
      errors: [],
      warnings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Financial engine failed";
    return { data: {}, errors: [msg], warnings: [] };
  }
}

/**
 * Run the DPR engine to generate the Detailed Project Report.
 * Requires eligibility and financial results from prior steps.
 */
function runDprStep(
  profile: ProjectProfile,
  engineOutputs: EngineOutputs
): {
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
} {
  try {
    const eligibilityResult = engineOutputs.eligibilityResult;
    const financialResult = engineOutputs.financialResult;

    if (!eligibilityResult) {
      return {
        data: {},
        errors: ["Eligibility result not found. Run the eligibility step first."],
        warnings: [],
      };
    }
    if (!financialResult) {
      return {
        data: {},
        errors: ["Financial result not found. Run the financial step first."],
        warnings: [],
      };
    }

    const dpr = generateDPR(profile, financialResult, eligibilityResult);
    return {
      data: {
        dprDocument: dpr as unknown as Record<string, unknown>,
        dprSectionCount: dpr.sections.length,
        dprWordCount: dpr.wordCount,
      },
      errors: [],
      warnings: [],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DPR engine failed";
    return { data: {}, errors: [msg], warnings: [] };
  }
}

/**
 * Run the PDF engine to generate the printable document.
 * Requires the DPR document from the prior step.
 */
function runPdfStep(engineOutputs: EngineOutputs): {
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
} {
  try {
    const dprDocument = engineOutputs.dprDocument;

    if (!dprDocument) {
      return {
        data: {},
        errors: ["DPR document not found. Run the DPR step first."],
        warnings: [],
      };
    }

    const buffer = generatePdf(dprDocument);
    const base64 = arrayBufferToBase64(buffer);

    return {
      data: {
        pdfGenerated: true,
        pdfBase64: base64,
        pdfSizeBytes: buffer.byteLength,
      },
      errors: [],
      warnings: [],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF engine failed";
    return { data: {}, errors: [msg], warnings: [] };
  }
}

// ── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Execute a single pipeline step.
 *
 * Pure orchestration — validates the current status matches the step's
 * prerequisites, runs the appropriate engine, and returns the results
 * along with the next status.
 *
 * @param profile       - The current project profile.
 * @param currentStatus - The project's current status in the state machine.
 * @param step          - Which pipeline step to execute.
 * @param engineOutputs - Previously stored engine outputs (for DPR/PDF steps).
 * @returns A `PipelineStepResult` with the step outcome.
 */
export function executePipelineStep(
  profile: ProjectProfile,
  currentStatus: ProjectStatus,
  step: PipelineStep,
  engineOutputs: EngineOutputs = {}
): PipelineStepResult {
  // ── Validate step is recognized ──
  if (!VALID_STEPS.has(step)) {
    return {
      success: false,
      status: currentStatus,
      data: {},
      errors: [`Unknown pipeline step: "${step}". Valid steps: ${PIPELINE_STEPS.join(", ")}`],
      warnings: [],
    };
  }

  // ── Validate current status matches the step's prerequisite ──
  const required = REQUIRED_STATUS[step];
  if (currentStatus !== required) {
    return {
      success: false,
      status: currentStatus,
      data: {},
      errors: [
        `Invalid status for step "${step}". Expected "${required}", got "${currentStatus}".`,
      ],
      warnings: [],
    };
  }

  // ── Execute the appropriate engine ──
  let result: { data: Record<string, unknown>; errors: string[]; warnings: string[] };

  switch (step) {
    case "eligibility":
      result = runEligibilityStep(profile);
      break;
    case "financial":
      result = runFinancialStep(profile);
      break;
    case "dpr":
      result = runDprStep(profile, engineOutputs);
      break;
    case "pdf":
      result = runPdfStep(engineOutputs);
      break;
  }

  // ── Build response ──
  const hasErrors = result.errors.length > 0;

  return {
    success: !hasErrors,
    status: hasErrors ? currentStatus : NEXT_STATUS[step],
    data: result.data,
    errors: result.errors,
    warnings: result.warnings,
  };
}

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
