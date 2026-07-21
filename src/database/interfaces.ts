import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProjectStatus } from "@/shared/types/state-machine";

/**
 * Opaque chat-message record persisted by the repository.
 *
 * The database layer must NOT import from `features/` (architecture boundary,
 * doc 02). Chat history is stored as a JSON array; the repository treats each
 * message as an opaque record. The features layer casts to its richer
 * `ChatMessage` type when reading.
 */
export interface ChatMessageRecord {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  [key: string]: unknown;
}

/** Lightweight project summary for list views. */
export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  businessName: string;
  businessDescription: string;
  nicCode: string | null;
  totalProjectCost: number;
  completeness: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The ONLY way to persist and retrieve project data.
 * See IMPLEMENTATION_RULES.md rules 6 and 8.
 */
export interface IProjectRepository {
  create(name: string): Promise<ProjectSummary>;
  getById(id: string): Promise<(ProjectSummary & { profile: ProjectProfile }) | null>;
  list(): Promise<ProjectSummary[]>;
  updateProfile(id: string, profile: ProjectProfile, status?: ProjectStatus): Promise<void>;
  updateStatus(id: string, status: ProjectStatus): Promise<void>;
  delete(id: string): Promise<void>;
  /** Fetch the chat message history for a project. */
  getChatHistory(id: string): Promise<ChatMessageRecord[]>;
  /** Append messages to the chat history for a project. */
  appendChatMessages(id: string, messages: ChatMessageRecord[]): Promise<void>;
}
