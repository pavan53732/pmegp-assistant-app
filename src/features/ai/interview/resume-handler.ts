// ─── Resume Handler ──────────────────────────────────────────────────────────
// Handles resuming an interrupted interview. Determines where to continue
// from and builds context for the AI. Pure functions only — no I/O, no AI calls.
// ───────────────────────────────────────────────────────────────────────────────

import type { ProjectProfile, EntityType } from "@/shared/types/project-profile";
import type { InterviewPhase, PhaseProgress } from "@/shared/types/interview";
import type { ResumeContext, ChatMessage } from "./types";

// ── Phase Ordering ───────────────────────────────────────────────────────────

/**
 * Canonical ordering of interview phases.
 * The interview progresses top-to-bottom.
 */
const PHASE_ORDER: InterviewPhase[] = [
  "APPLICANT_DISCOVERY",
  "BUSINESS_DISCOVERY",
  "ACTIVITY_RESOLUTION",
  "PROJECT_SIZING",
  "FINANCIAL_PLANNING",
  "REVIEW",
  "VALIDATION_COMPLETION",
];

/** Human-readable phase labels for messages. */
const PHASE_LABELS: Record<InterviewPhase, string> = {
  APPLICANT_DISCOVERY: "Applicant Information",
  BUSINESS_DISCOVERY: "Business Details",
  ACTIVITY_RESOLUTION: "Activity Classification",
  PROJECT_SIZING: "Project Sizing & Details",
  FINANCIAL_PLANNING: "Financial Planning",
  REVIEW: "Review",
  VALIDATION_COMPLETION: "Validation & Completion",
};

// ── Enum label maps (subset needed for profile summary) ──────────────────────

const ENTITY_TYPE_SHORT: Record<EntityType, string> = {
  INDIVIDUAL: "Individual",
  SHG: "SHG",
  TRUST: "Trust",
  SOCIETY: "Society",
  COOP: "Cooperative",
  PARTNERSHIP: "Partnership",
  LLP: "LLP",
  PRIVATE_LIMITED: "Pvt Ltd",
};

// ── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Navigate into a nested object using a dot-path.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/**
 * Check whether a value is considered "empty".
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "number") return false;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Format a number in Indian currency notation: ₹25,00,000.
 */
function formatIndianCurrency(amount: number): string {
  if (amount === 0) return "₹0";
  const isNegative = amount < 0;
  const abs = Math.round(Math.abs(amount));
  const str = abs.toString();

  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);

  let result = lastThree;
  let remaining = rest;
  while (remaining.length > 2) {
    result = remaining.slice(-2) + "," + result;
    remaining = remaining.slice(0, -2);
  }
  if (remaining.length > 0) {
    result = remaining + "," + result;
  }

  return (isNegative ? "-₹" : "₹") + result;
}

/**
 * Safely get a non-empty string value, or undefined.
 */
function strVal(profile: ProjectProfile, path: string): string | undefined {
  const v = getNestedValue(profile, path);
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Safely get a number value, or undefined (only if truthy for non-zero context).
 */
function numVal(profile: ProjectProfile, path: string): number | undefined {
  const v = getNestedValue(profile, path);
  return typeof v === "number" ? v : undefined;
}

// ── Exported Functions ───────────────────────────────────────────────────────

/**
 * Get all completed phases from the profile's phase progress.
 */
export function getCompletedPhases(profile: ProjectProfile): InterviewPhase[] {
  const completed: InterviewPhase[] = [];
  const progress = profile.completion?.phaseProgress;

  if (!progress) return completed;

  for (const phase of PHASE_ORDER) {
    const pp: PhaseProgress | undefined = progress[phase];
    if (pp && pp.status === "COMPLETED") {
      completed.push(phase);
    }
  }

  return completed;
}

/**
 * Determine the next phase to continue from.
 * If the currentPhase is COMPLETED, returns the next non-completed phase.
 * If the currentPhase is IN_PROGRESS or NOT_STARTED, returns it.
 */
function determineNextPhase(profile: ProjectProfile): InterviewPhase {
  const progress = profile.completion?.phaseProgress;
  const currentPhase = profile.completion?.currentPhase;

  if (!progress || !currentPhase) {
    return "APPLICANT_DISCOVERY";
  }

  const currentProgress = progress[currentPhase];

  // If the current phase is COMPLETED, find the next non-completed one
  if (currentProgress && currentProgress.status === "COMPLETED") {
    const currentIndex = PHASE_ORDER.indexOf(currentPhase);
    for (let i = currentIndex + 1; i < PHASE_ORDER.length; i++) {
      const nextPhase = PHASE_ORDER[i];
      const nextProgress = progress[nextPhase];
      if (!nextProgress || nextProgress.status !== "COMPLETED") {
        return nextPhase;
      }
    }
    // All phases completed — return the last one
    return "VALIDATION_COMPLETION";
  }

  // Phase is IN_PROGRESS or NOT_STARTED — continue here
  return currentPhase;
}

/**
 * Generate a concise summary of collected fields for AI context.
 * This is injected into the system prompt so the AI knows
 * what's already been discussed.
 */
export function generateProfileSummary(profile: ProjectProfile): string {
  const lines: string[] = [];
  lines.push("Collected so far:");

  // Applicant
  const appParts: string[] = [];
  const name = strVal(profile, "applicant.name");
  const age = numVal(profile, "applicant.age");
  const gender = strVal(profile, "applicant.gender");
  const category = strVal(profile, "applicant.category");
  const education = strVal(profile, "applicant.education");
  const entityType = strVal(profile, "applicant.entityType");

  if (name) appParts.push(name);
  if (age) appParts.push(String(age));
  if (gender) appParts.push(gender);
  if (category) appParts.push(category);
  if (education) appParts.push(education);
  if (entityType) {
    const shortType =
      ENTITY_TYPE_SHORT[entityType as EntityType] ?? entityType;
    appParts.push(shortType);
  }

  if (appParts.length > 0) {
    lines.push(`- Applicant: ${appParts.join(", ")}`);
  }

  // Business
  const bizParts: string[] = [];
  const bizName = strVal(profile, "business.name");
  const bizDesc = strVal(profile, "business.description");
  if (bizName) bizParts.push(bizName);
  if (bizDesc) bizParts.push(bizDesc.toLowerCase());
  if (bizParts.length > 0) {
    lines.push(`- Business: ${bizParts.join(", ")}`);
  }

  // Location
  const locParts: string[] = [];
  const district = strVal(profile, "location.district");
  const state = strVal(profile, "location.state");
  const area = strVal(profile, "location.area");
  if (district) locParts.push(district);
  if (state) locParts.push(state);
  if (area) locParts.push(area);
  if (locParts.length > 0) {
    lines.push(`- Location: ${locParts.join(", ")}`);
  }

  // Activity
  const actParts: string[] = [];
  const nicCode = strVal(profile, "business.nicCode");
  const nicDesc = strVal(profile, "business.nicDescription");
  const activityType = strVal(profile, "business.activityType");
  if (nicCode) actParts.push(`NIC ${nicCode}`);
  if (nicDesc) actParts.push(`(${nicDesc})`);
  if (activityType) actParts.push(activityType);
  if (actParts.length > 0) {
    lines.push(`- Activity: ${actParts.join(" ")}`);
  }

  // Land & Building (brief)
  const landStatus = strVal(profile, "land.status");
  if (landStatus) {
    const landArea = numVal(profile, "land.areaSqFt");
    const areaStr = landArea ? `, ${landArea} sq ft` : "";
    lines.push(`- Land: ${landStatus}${areaStr}`);
  }

  // Capacity (brief)
  const capVal = numVal(profile, "capacity.installedCapacity.value");
  const capUnit = strVal(profile, "capacity.installedCapacity.unit");
  if (capVal && capUnit) {
    lines.push(`- Capacity: ${capVal} ${capUnit}`);
  }

  // Machinery summary
  const machineCost = numVal(profile, "machinery.totalCost");
  const machineCount = (profile.machinery?.items ?? []).length;
  if (machineCount > 0) {
    const costStr = machineCost ? ` (${formatIndianCurrency(machineCost)})` : "";
    lines.push(`- Machinery: ${machineCount} item${machineCount > 1 ? "s" : ""}${costStr}`);
  }

  // Raw Materials summary
  const rawCost = numVal(profile, "rawMaterials.totalMonthlyCost");
  const rawCount = (profile.rawMaterials?.items ?? []).length;
  if (rawCount > 0) {
    const costStr = rawCost ? ` (${formatIndianCurrency(rawCost)}/month)` : "";
    lines.push(`- Raw Materials: ${rawCount} item${rawCount > 1 ? "s" : ""}${costStr}`);
  }

  // Employees summary
  const totalEmp = numVal(profile, "employees.totalEmployment");
  if (totalEmp !== undefined && totalEmp > 0) {
    lines.push(`- Employment: ${totalEmp} persons`);
  }

  // Financials summary
  const totalProjectCost = numVal(profile, "financials.totalProjectCost");
  if (totalProjectCost !== undefined && totalProjectCost > 0) {
    lines.push(`- Project Cost: ${formatIndianCurrency(totalProjectCost)}`);
  }

  // Determine remaining phases
  const completed = getCompletedPhases(profile);
  const nextPhase = determineNextPhase(profile);
  const remainingPhases: string[] = [];

  for (const phase of PHASE_ORDER) {
    if (phase === "REVIEW" || phase === "VALIDATION_COMPLETION") continue;
    if (!completed.includes(phase)) {
      remainingPhases.push(PHASE_LABELS[phase]);
    }
  }

  // If we're in REVIEW or VALIDATION, those aren't "remaining data phases"
  if (nextPhase === "REVIEW" || nextPhase === "VALIDATION_COMPLETION") {
    lines.push("Remaining: Review & Validation");
  } else if (remainingPhases.length > 0) {
    lines.push(`Remaining: ${remainingPhases.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Analyze a loaded project and determine the resume context.
 * Returns what phase to continue from and a summary of progress.
 */
export function buildResumeContext(
  profile: ProjectProfile,
  conversationHistory: ChatMessage[],
): ResumeContext {
  const completedPhases = getCompletedPhases(profile);
  const nextPhase = determineNextPhase(profile);
  const summary = generateProfileSummary(profile);

  // Find the last interaction timestamp
  let lastInteractionAt = profile.completion?.lastUpdatedAt ?? new Date().toISOString();
  if (conversationHistory.length > 0) {
    const lastMsg = conversationHistory[conversationHistory.length - 1];
    if (lastMsg.timestamp > lastInteractionAt) {
      lastInteractionAt = lastMsg.timestamp;
    }
  }

  // Determine the last active phase (the one the user was last in)
  const lastPhase = profile.completion?.currentPhase ?? "APPLICANT_DISCOVERY";

  // Find the last USER message to understand context
  const lastUserMessage = [...conversationHistory]
    .reverse()
    .find((m) => m.role === "USER");

  return {
    // projectId is not available from profile or history alone;
    // the caller must set this after receiving the context.
    projectId: "",
    profile,
    lastPhase,
    lastInteractionAt,
    conversationHistory,
    completedPhases,
    nextPhase,
    summary,
  };
}

/**
 * Generate a resume message — what the AI says when the user
 * returns to an in-progress interview.
 */
export function generateResumeMessage(context: ResumeContext): string {
  const lines: string[] = [];

  // Greeting
  lines.push("Welcome back! 👋");

  // Check if anything was completed at all
  const hasProgress = context.completedPhases.length > 0;

  if (!hasProgress) {
    lines.push("");
    lines.push("It looks like we're just getting started. Let's begin with some basic information about you.");
    lines.push("");
    lines.push("Could you please tell me your **full name**?");
    return lines.join("\n");
  }

  // Summarize what was done
  lines.push("");
  lines.push("Here's where we left off:");

  // Show completed phases briefly
  const completedLabels = context.completedPhases
    .filter((p) => p !== "REVIEW" && p !== "VALIDATION_COMPLETION")
    .map((p) => PHASE_LABELS[p]);

  if (completedLabels.length > 0) {
    lines.push(`✅ Completed: ${completedLabels.join(", ")}`);
  }

  // Show current/next phase
  const isReview = context.nextPhase === "REVIEW";
  const isValidation = context.nextPhase === "VALIDATION_COMPLETION";

  if (isReview) {
    lines.push("");
    lines.push("All information has been collected! Let's review everything before we proceed.");
    lines.push("");
    lines.push("Type **\"review\"** to see the full summary, or let me know if you'd like to change anything.");
  } else if (isValidation) {
    lines.push("");
    lines.push("Great — the review is complete! Let's validate your project details and check eligibility.");
  } else {
    lines.push(`🔄 Next: **${PHASE_LABELS[context.nextPhase]}**`);
    lines.push("");

    // Contextual prompt based on next phase
    switch (context.nextPhase) {
      case "APPLICANT_DISCOVERY":
        lines.push(
          "Let's continue with your personal details. What's your full name?",
        );
        break;
      case "BUSINESS_DISCOVERY":
        lines.push(
          "Now, let's talk about the business you want to set up. What's the proposed name of your unit?",
        );
        break;
      case "ACTIVITY_RESOLUTION":
        lines.push(
          "Let's classify your business activity. What exactly will you be manufacturing or providing as a service?",
        );
        break;
      case "PROJECT_SIZING":
        lines.push(
          "Now let's work out the project details — location, machinery, raw materials, and staffing. Where is your proposed unit located (state and district)?",
        );
        break;
      case "FINANCIAL_PLANNING":
        lines.push(
          "Finally, let's plan the finances. What's your estimated total project cost?",
        );
        break;
      default:
        lines.push("Let's continue. Could you tell me a bit more?");
    }
  }

  return lines.join("\n");
}