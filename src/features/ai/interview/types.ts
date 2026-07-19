// ─── AI Interview Types ────────────────────────────────────────────────────
// Types for the AI-driven interview subsystem (Milestone 3).
// This module defines the contracts between the 6 interview sub-components:
//   Question Planner, Response Parser, Field Extractor,
//   Review Handler, Resume Handler, Conversation Orchestrator.
//
// See AGENT_CONTRACTS.md §12 for the full subsystem contract.
// ───────────────────────────────────────────────────────────────────────────────

import type { InterviewPhase } from "@/shared/types/interview";
import type { ProjectProfile } from "@/shared/types/project-profile";

// ── Chat Message ───────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  timestamp: string; // ISO
  phase: InterviewPhase;
  /** Which dot-path field this message targets (for ASSISTANT questions). */
  targetField?: string;
  /** Structured field extractions from this message (if any). */
  extractions?: FieldExtraction[];
}

// ── Field Extraction (from Response Parser / Field Extractor) ──────────────

export interface FieldExtraction {
  /** Dot-path into ProjectProfile, e.g. "applicant.name". */
  fieldPath: string;
  /** The extracted value — typed but stored as unknown for generic handling. */
  value: unknown;
  /** How confident the extraction is (0-1). Only AI/OCR extractions have < 1. */
  confidence: number;
  /** Source of this extraction. */
  source: "USER" | "AI" | "KNOWLEDGE";
  /** Human-readable label for the field. */
  label: string;
  /** Why this value was extracted (reasoning for AI extractions). */
  reasoning?: string;
}

// ── Parsed User Intent (from Response Parser) ──────────────────────────────

export type UserIntentType =
  | "ANSWER"
  | "CORRECTION"
  | "CLARIFICATION"
  | "SKIP"
  | "GO_BACK"
  | "REVIEW_REQUEST"
  | "CONFIRM"
  | "HELP"
  | "OUT_OF_SCOPE"
  | "GREETING";

export interface ParsedUserIntent {
  type: UserIntentType;
  /** The primary subject the user is talking about. */
  subject?: string;
  /** Fields the user explicitly wants to correct. */
  correctionFields?: string[];
  /** Which phase the user wants to go back to. */
  targetPhase?: InterviewPhase;
  /** The raw text for fallback display. */
  rawText: string;
  /** Confidence in the intent classification (0-1). */
  confidence: number;
}

// ── Question Planning (from Question Planner) ──────────────────────────────

export interface QuestionPlan {
  /** The question text to display to the user. */
  question: string;
  /** Which field(s) this question is trying to fill. */
  targetFields: string[];
  /** The current interview phase. */
  phase: InterviewPhase;
  /** Suggested options the user can choose from (for structured questions). */
  suggestions?: QuestionSuggestion[];
  /** Hint text to help the user answer. */
  hint?: string;
  /** Whether this is the first question in the phase. */
  isPhaseStart: boolean;
  /** Whether the phase is complete after this question is answered. */
  completesPhase: boolean;
}

export interface QuestionSuggestion {
  label: string;
  value: string;
  description?: string;
}

// ── Phase Configuration ────────────────────────────────────────────────────

export interface PhaseConfig {
  phase: InterviewPhase;
  label: string;
  description: string;
  /** Ordered list of field groups to collect in this phase. */
  fieldGroups: FieldGroupConfig[];
  /** System prompt additions for this phase. */
  systemPromptAddendum: string;
  /** Whether this phase can be skipped entirely (all fields optional). */
  canSkip: boolean;
}

export interface FieldGroupConfig {
  label: string;
  fields: FieldConfig[];
}

export interface FieldConfig {
  dotPath: string;
  label: string;
  type: "TEXT" | "NUMBER" | "ENUM" | "BOOLEAN" | "CURRENCY" | "DATE";
  required: boolean;
  enumOptions?: { label: string; value: string }[];
  hint?: string;
  validationHint?: string;
  /** Minimum value for NUMBER/CURRENCY fields. */
  min?: number;
  /** Maximum value for NUMBER/CURRENCY fields. */
  max?: number;
}

// ── Review (from Review Handler) ──────────────────────────────────────────

export interface ReviewSection {
  phase: InterviewPhase;
  label: string;
  fields: ReviewFieldEntry[];
}

export interface ReviewFieldEntry {
  dotPath: string;
  label: string;
  value: string; // Display-formatted value
  source: string;
  verification: string;
  needsAttention: boolean;
  reason?: string;
}

export interface ReviewSummary {
  sections: ReviewSection[];
  completeness: number;
  errors: string[];
  warnings: string[];
  canConfirm: boolean;
}

// ── Resume (from Resume Handler) ───────────────────────────────────────────

export interface ResumeContext {
  projectId: string;
  profile: ProjectProfile;
  lastPhase: InterviewPhase;
  lastInteractionAt: string;
  conversationHistory: ChatMessage[];
  /** Which phases have been completed. */
  completedPhases: InterviewPhase[];
  /** The next phase to continue from. */
  nextPhase: InterviewPhase;
  /** A summary of what was discussed so far (for context injection). */
  summary: string;
}

// ── Orchestrator State ────────────────────────────────────────────────────

export interface InterviewState {
  projectId: string;
  messages: ChatMessage[];
  currentPhase: InterviewPhase;
  isPaused: boolean;
  isComplete: boolean;
  error: string | null;
  startedAt: string;
  lastActivityAt: string;
  interactionCount: number;
}