// ─── Pipeline Service ──────────────────────────────────────────────────────
// Pure orchestration service that executes engine pipeline steps.
// SERVER-ONLY — imports Node.js engines (including pdfkit).
// Client-safe constants and types are in ./pipeline-constants.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProjectStatus } from "@/shared/types/state-machine";
import { checkEligibility, type EligibilityResult } from "@/engines/eligibility-engine";
import { computeFinancials, type FinancialResult } from "@/engines/financial-engine";
import { generateDPR, type DprDocument } from "@/engines/dpr-engine";
import { generatePdf } from "@/engines/pdf-engine";

// Import client-safe types and constants (also re-export for API route convenience).
import type { PipelineStepResult } from "./pipeline-constants";
import { PIPELINE_STEPS, VALID_STEPS } from "./pipeline-constants";
export type { PipelineStepResult, PipelineStep, EngineOutputs } from "./pipeline-constants";
export { PIPELINE_STEPS, VALID_STEPS, getPipelineStepIndex, getNextPipelineStep } from "./pipeline-constants";

// ── Internal Constants ─────────────────────────────────────────────────────

/** Required status before each pipeline step can execute. */
const REQUIRED_STATUS: Record<string, ProjectStatus> = {
  eligibility: "VALIDATED",
  financial: "ELIGIBILITY_READY",
  dpr: "FINANCIAL_READY",
  pdf: "DPR_READY",
};

/** Status transition after a successful step execution. */
const NEXT_STATUS: Record<string, ProjectStatus> = {
  eligibility: "ELIGIBILITY_READY",
  financial: "FINANCIAL_READY",
  dpr: "DPR_READY",
  pdf: "DPR_READY",
};

// ── Internal engine result storage interface (with engine-typed fields) ──

/** Internal engine outputs with strongly-typed engine results. */
interface InternalEngineOutputs {
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
  engineOutputs: InternalEngineOutputs
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
function runPdfStep(engineOutputs: InternalEngineOutputs): {
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
  step: string,
  engineOutputs: Record<string, unknown> = {}
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
  if (!required || currentStatus !== required) {
    return {
      success: false,
      status: currentStatus,
      data: {},
      errors: [
        `Invalid status for step "${step}". Expected "${required ?? 'unknown'}", got "${currentStatus}".`,
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
      result = runDprStep(profile, engineOutputs as InternalEngineOutputs);
      break;
    case "pdf":
      result = runPdfStep(engineOutputs as InternalEngineOutputs);
      break;
    default:
      result = { data: {}, errors: [`Unhandled step: ${step}`], warnings: [] };
      break;
  }

  // ── Build response ──
  const hasErrors = result.errors.length > 0;
  const nextStatus = NEXT_STATUS[step];

  return {
    success: !hasErrors,
    status: (hasErrors ? currentStatus : nextStatus) as ProjectStatus,
    data: result.data,
    errors: result.errors,
    warnings: result.warnings,
  };
}


