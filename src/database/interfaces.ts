import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProjectStatus } from "@/shared/types/state-machine";

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
}