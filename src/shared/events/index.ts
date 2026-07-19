// ─── Event Bus — Public API ────────────────────────────────────────────────

export type {
  AppEvent,
  ProjectCreatedEvent,
  ProjectStateChangedEvent,
  ProjectDeletedEvent,
  ProjectUpdatedEvent,
  ProjectConfirmedEvent,
  ValidationCompletedEvent,
  EngineType,
  EngineStartedEvent,
  EngineCompletedEvent,
  EngineFailedEvent,
  InterviewPhaseChangedEvent,
  AiMessageEvent,
  SuggestionPresentedEvent,
  ProjectPersistedEvent,
  AnyAppEvent,
  EventTypeMap,
  EventHandler,
} from "./event-types";

export { EventBus, getEventBus } from "./event-bus";