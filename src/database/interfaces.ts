import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProjectStatus } from "@/shared/types/state-machine";
import type { ChatMessage } from "@/features/ai/interview/types";

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
  getChatHistory(id: string): Promise<ChatMessage[]>;
  /** Append messages to the chat history for a project. */
  appendChatMessages(id: string, messages: ChatMessage[]): Promise<void>;
}