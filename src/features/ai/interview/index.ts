// ─── AI Interview — Barrel Exports ────────────────────────────────────────────
// Public API for the AI Interview subsystem.
// See AGENT_CONTRACTS.md §12.
// ───────────────────────────────────────────────────────────────────────────────

// Orchestrator
export { InterviewController } from "./orchestrator";

// Types
export type {
  ChatMessage,
  InterviewState,
  ParsedUserIntent,
  FieldExtraction,
  QuestionPlan,
  PhaseConfig,
  FieldConfig,
  FieldGroupConfig,
  QuestionSuggestion,
  ReviewSummary,
  ReviewSection,
  ReviewFieldEntry,
  ResumeContext,
  UserIntentType,
} from "./types";

// ProviderMessage and ProviderResponse are defined in @/providers
// Re-exported here for convenience of consumers.
export type { ProviderMessage, ProviderResponse } from "@/providers";

// Question Planner
export { planNextQuestion, getNextPhase, getPhaseEntryMessage, PHASE_CONFIGS } from "./question-planner";

// Response Parser
export { parseUserIntent, isGreeting } from "./response-parser";

// Field Extractor
export {
  extractFieldsFromMessage,
  buildExtractionPrompt,
  parseAIExtractionResponse,
  extractFieldLocally,
} from "./field-extractor";

// Review Handler
export { generateReviewSummary, generateReviewText } from "./review-handler";

// Resume Handler
export {
  buildResumeContext,
  generateResumeMessage,
  generateProfileSummary,
} from "./resume-handler";