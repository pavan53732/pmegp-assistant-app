import type { ProjectProfile } from "../types/project-profile";
import type { ProjectStatus } from "../types/state-machine";

export interface AppEvent {
  type: string;
  timestamp: string;
  projectId: string;
}

// Project lifecycle
export interface ProjectCreatedEvent extends AppEvent {
  type: "PROJECT_CREATED";
  payload: { projectName: string };
}

export interface ProjectStateChangedEvent extends AppEvent {
  type: "PROJECT_STATE_CHANGED";
  payload: { previousState: ProjectStatus; newState: ProjectStatus; reason: string };
}

export interface ProjectDeletedEvent extends AppEvent {
  type: "PROJECT_DELETED";
  payload: Record<string, never>;
}

// Profile updates
export interface ProjectUpdatedEvent extends AppEvent {
  type: "PROJECT_UPDATED";
  payload: { profile: ProjectProfile; changedFields: string[]; source: "USER" | "AI" | "KNOWLEDGE" | "OCR" };
}

export interface ProjectConfirmedEvent extends AppEvent {
  type: "PROJECT_CONFIRMED";
  payload: { confirmedProfile: ProjectProfile };
}

// Validation
export interface ValidationCompletedEvent extends AppEvent {
  type: "VALIDATION_COMPLETED";
  payload: {
    completeness: number;
    missingFields: string[];
    errors: Array<{ fieldPath: string; code: string; message: string }>;
    contradictions: Array<{ fields: string[]; description: string }>;
    canEnterReview: boolean;
    canValidate: boolean;
    gate: "DATA" | "CONFIRMATION";
  };
}

// Engine execution
export type EngineType = "validation" | "eligibility" | "financial" | "dpr" | "pdf" | "knowledge" | "ocr";

export interface EngineStartedEvent extends AppEvent {
  type: "ENGINE_STARTED";
  payload: { engine: EngineType };
}

export interface EngineCompletedEvent extends AppEvent {
  type: "ENGINE_COMPLETED";
  payload: { engine: EngineType; success: boolean; result: unknown; durationMs: number };
}

export interface EngineFailedEvent extends AppEvent {
  type: "ENGINE_FAILED";
  payload: { engine: EngineType; error: string };
}

// Interview
export interface InterviewPhaseChangedEvent extends AppEvent {
  type: "INTERVIEW_PHASE_CHANGED";
  payload: { previousPhase: string; newPhase: string };
}

export interface AiMessageEvent extends AppEvent {
  type: "AI_MESSAGE";
  payload: { message: string; phase: string; targetField?: string };
}

export interface SuggestionPresentedEvent extends AppEvent {
  type: "SUGGESTION_PRESENTED";
  payload: { fieldPath: string; suggestedValue: unknown; source: "KNOWLEDGE"; reasoning: string };
}

// Persistence
export interface ProjectPersistedEvent extends AppEvent {
  type: "PROJECT_PERSISTED";
  payload: { state: ProjectStatus };
}

// Union type
export type AnyAppEvent =
  | ProjectCreatedEvent
  | ProjectStateChangedEvent
  | ProjectDeletedEvent
  | ProjectUpdatedEvent
  | ProjectConfirmedEvent
  | ValidationCompletedEvent
  | EngineStartedEvent
  | EngineCompletedEvent
  | EngineFailedEvent
  | InterviewPhaseChangedEvent
  | AiMessageEvent
  | SuggestionPresentedEvent
  | ProjectPersistedEvent;

export interface EventTypeMap {
  "PROJECT_CREATED": ProjectCreatedEvent;
  "PROJECT_STATE_CHANGED": ProjectStateChangedEvent;
  "PROJECT_DELETED": ProjectDeletedEvent;
  "PROJECT_UPDATED": ProjectUpdatedEvent;
  "PROJECT_CONFIRMED": ProjectConfirmedEvent;
  "VALIDATION_COMPLETED": ValidationCompletedEvent;
  "ENGINE_STARTED": EngineStartedEvent;
  "ENGINE_COMPLETED": EngineCompletedEvent;
  "ENGINE_FAILED": EngineFailedEvent;
  "INTERVIEW_PHASE_CHANGED": InterviewPhaseChangedEvent;
  "AI_MESSAGE": AiMessageEvent;
  "SUGGESTION_PRESENTED": SuggestionPresentedEvent;
  "PROJECT_PERSISTED": ProjectPersistedEvent;
}

export type EventHandler<T extends AnyAppEvent = AnyAppEvent> = (event: T) => void;