// ─── Pipeline API Route ──────────────────────────────────────────────────
// POST /api/projects/[id]/pipeline?step=<eligibility|financial|dpr|pdf>
//
// Executes a single engine pipeline step for a project.
// Each step: loads project → validates status → runs engine → saves results → updates status.
// ─────────────────────────────────────────────────────────────────────────────

import { getProjectRepository } from "@/database/project-repository";
import { apiError, apiSuccess } from "@/app/api/error-handler";
import {
  executePipelineStep,
  VALID_STEPS,
  type PipelineStep,
  type EngineOutputs,
} from "@/services/pipeline-service";
import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProjectStatus } from "@/shared/types/state-machine";

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Safely parse the pipeline outputs from a project profile.
 * Stored in a non-standard field that engines don't touch.
 */
function getEngineOutputs(profile: ProjectProfile): EngineOutputs {
  // Use a type-safe cast — pipelineOutputs is stored alongside the profile
  // but not part of the canonical ProjectProfile type.
  const extras = profile as ProjectProfile & {
    pipelineOutputs?: EngineOutputs;
  };
  return extras.pipelineOutputs ?? {};
}

/**
 * Merge new engine outputs into the existing profile's pipeline outputs.
 * Returns a new profile object (does not mutate the original).
 */
function mergeEngineOutputs(
  profile: ProjectProfile,
  newData: Record<string, unknown>
): ProjectProfile {
  const currentOutputs = getEngineOutputs(profile);
  const merged: EngineOutputs = { ...currentOutputs };

  if ("eligibilityResult" in newData) {
    merged.eligibilityResult = newData.eligibilityResult as EngineOutputs["eligibilityResult"];
  }
  if ("financialResult" in newData) {
    merged.financialResult = newData.financialResult as EngineOutputs["financialResult"];
  }
  if ("dprDocument" in newData) {
    merged.dprDocument = newData.dprDocument as EngineOutputs["dprDocument"];
  }
  if ("pdfGenerated" in newData) {
    merged.pdfGenerated = newData.pdfGenerated as boolean;
  }
  if ("pdfBase64" in newData) {
    merged.pdfBase64 = newData.pdfBase64 as string;
  }

  // Return the profile with the pipelineOutputs attached
  return { ...profile, pipelineOutputs: merged } as ProjectProfile & {
    pipelineOutputs: EngineOutputs;
  };
}

// ── Route Handler ─────────────────────────────────────────────────────────

/**
 * POST /api/projects/[id]/pipeline?step=<eligibility|financial|dpr|pdf>
 *
 * Executes a single pipeline step for a project.
 * Returns the step result including success, new status, data, errors, and warnings.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Validate project ID ──
  if (!id) {
    return apiError("Project ID is required", 400);
  }

  // ── Parse and validate step parameter ──
  const url = new URL(_request.url);
  const rawStep = url.searchParams.get("step");

  if (!rawStep) {
    return apiError(
      'Query parameter "step" is required. Valid steps: eligibility, financial, dpr, pdf',
      400
    );
  }

  if (!VALID_STEPS.has(rawStep)) {
    return apiError(
      `Invalid step "${rawStep}". Valid steps: eligibility, financial, dpr, pdf`,
      400
    );
  }

  const step = rawStep as PipelineStep;

  // ── Load project from DB ──
  let profile: ProjectProfile;
  let currentStatus: ProjectStatus;

  try {
    const repo = getProjectRepository();
    const project = await repo.getById(id);

    if (!project) {
      return apiError("Project not found", 404);
    }

    profile = project.profile;
    currentStatus = project.status;
  } catch {
    return apiError("Failed to load project from database");
  }

  // ── Execute the pipeline step ──
  try {
    const engineOutputs = getEngineOutputs(profile);

    const result = executePipelineStep(
      profile,
      currentStatus,
      step,
      engineOutputs
    );

    // ── Save results to the database ──
    if (result.success) {
      try {
        const repo = getProjectRepository();
        const updatedProfile = mergeEngineOutputs(profile, result.data);
        await repo.updateProfile(id, updatedProfile, result.status as ProjectStatus);
      } catch {
        // Engine ran successfully but DB save failed — report partial success
        return apiError(
          `Pipeline step "${step}" executed successfully but failed to save results to the database.`,
          500
        );
      }
    }

    return apiSuccess({
      success: result.success,
      status: result.status,
      data: result.data,
      errors: result.errors,
      warnings: result.warnings,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : `Pipeline step "${step}" failed with an unexpected error`;
    return apiError(message, 500);
  }
}