// ─── Interview Store ───────────────────────────────────────────────────────
// Framework-agnostic store class for managing interview state.
// Uses EventBus, Repository, and Validation Engine.
// ───────────────────────────────────────────────────────────────────────────

import type { ProjectProfile } from "@/shared/types/project-profile";
import type { FieldProvenance } from "@/shared/types/provenance";
import type { InterviewPhase } from "@/shared/types/interview";
import type { ProjectStatus } from "@/shared/types/state-machine";
import type {
  AnyAppEvent,
  ProjectUpdatedEvent,
  ProjectConfirmedEvent,
  InterviewPhaseChangedEvent,
  ValidationCompletedEvent,
} from "@/shared/events/event-types";

import {
  setFieldValue,
  updateProvenance,
  stampAllConfirmed,
  computeDerivedFields,
} from "./field-updater";
import { getEventBus } from "@/shared/events/event-bus";
import { getProjectRepository } from "@/database/project-repository";
import { validateProject } from "@/engines/validation-engine";

// ── Store State ───────────────────────────────────────────────────────────

export interface InterviewStoreState {
  /** Currently loaded project ID. */
  projectId: string | null;
  /** The canonical project profile. */
  profile: ProjectProfile | null;
  /** High-level project status from the state machine. */
  projectStatus: ProjectStatus;
  /** Whether an async operation (load/save) is in flight. */
  isLoading: boolean;
  /** Last error, if any. */
  error: string | null;
}

// ── Dependency injection (connected when Milestone 1 is complete) ──────────

// ── Direct imports (Milestone 1 complete) ─────────────────────────────────

// All three dependencies are now available as direct imports.
// The DI setters and lazy loaders are kept for backward compatibility.

let _eventBus: ReturnType<typeof getEventBus> | null = null;
let _projectRepository: ReturnType<typeof getProjectRepository> | null = null;

function getOrLoadEventBus() {
  if (!_eventBus) _eventBus = getEventBus();
  return _eventBus;
}

function getOrLoadRepository() {
  if (!_projectRepository) _projectRepository = getProjectRepository();
  return _projectRepository;
}

// ── The Store ─────────────────────────────────────────────────────────────

type Listener = (state: InterviewStoreState) => void;

export class InterviewStore {
  private state: InterviewStoreState;
  private listeners: Set<Listener> = new Set();

  constructor(initialState?: Partial<InterviewStoreState>) {
    this.state = {
      projectId: null,
      profile: null,
      projectStatus: "EMPTY" as ProjectStatus,
      isLoading: false,
      error: null,
      ...initialState,
    };
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Returns a snapshot of the full state. */
  getState(): InterviewStoreState {
    return { ...this.state };
  }

  /** Returns the current ProjectProfile, or null if none is loaded. */
  getProfile(): ProjectProfile | null {
    return this.state.profile;
  }

  /** Load a project from the repository by ID. */
  async loadProject(id: string): Promise<void> {
    this.setState({ isLoading: true, error: null, projectId: id });

    try {
      let profile: ProjectProfile | null = null;
      const repo = getOrLoadRepository();

      if (repo) {
        const result = await repo.getById(id);
        if (result) {
          profile = result.profile;
        }
      }

      this.setState({
        profile: profile ?? null,
        projectStatus: profile ? this.inferStatus(profile) : "EMPTY",
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({ isLoading: false, error: message });
    }
  }

  /**
   * Update a single field by dot-path, set its provenance, recompute
   * derived fields, and run validation.
   */
  updateField(
    fieldPath: string,
    value: unknown,
    source: "USER" | "AI" | "OCR" | "KNOWLEDGE" | null
  ): void {
    const profile = this.state.profile;
    if (!profile) {
      this.setState({ error: "Cannot update field: no project loaded." });
      return;
    }

    // 1. Set the field value (immutable)
    let updatedProfile = setFieldValue(profile, fieldPath, value);

    // 2. Update provenance
    const newProvenanceMap = updateProvenance(
      updatedProfile.provenance.perField,
      fieldPath,
      source
    );
    updatedProfile = {
      ...updatedProfile,
      provenance: {
        ...updatedProfile.provenance,
        perField: newProvenanceMap,
      },
    };

    // 3. Compute derived fields (e.g. isWomen from gender)
    updatedProfile = computeDerivedFields(updatedProfile);

    // 4. Update completion timestamp & interaction count
    const completion = {
      ...updatedProfile.completion,
      lastUpdatedAt: new Date().toISOString(),
      interactionCount: updatedProfile.completion.interactionCount + 1,
    };
    updatedProfile = { ...updatedProfile, completion };

    // 5. Run validation
    const validation = this.runValidation(updatedProfile);
    updatedProfile = { ...updatedProfile, validation };

    // 6. Infer project status
    const projectStatus = this.inferStatus(updatedProfile);

    this.setState({ profile: updatedProfile, projectStatus, error: null });

    // Emit typed events
    if (source === "USER" || source === "AI" || source === "OCR" || source === "KNOWLEDGE") {
      this.emitTypedEvent<ProjectUpdatedEvent>({
        type: "PROJECT_UPDATED",
        projectId: this.state.projectId ?? "",
        timestamp: new Date().toISOString(),
        payload: {
          profile: updatedProfile,
          changedFields: [fieldPath],
          source: source,
        },
      });

      this.emitTypedEvent<ValidationCompletedEvent>({
        type: "VALIDATION_COMPLETED",
        projectId: this.state.projectId ?? "",
        timestamp: new Date().toISOString(),
        payload: {
          completeness: validation.completeness,
          missingFields: validation.missingFields,
          errors: validation.errors,
          contradictions: validation.contradictions,
          canEnterReview: validation.missingFields.length === 0,
          canValidate: validation.errors.length === 0 && validation.missingFields.length === 0,
          gate: "DATA",
        },
      });
    }

    // Persist (fire-and-forget)
    this.persist(updatedProfile, projectStatus);
  }

  /**
   * Confirm the entire project: stamp all provenance CONFIRMED,
   * run final validation, and transition to REVIEW_PENDING.
   */
  confirmProject(): void {
    const profile = this.state.profile;
    if (!profile) {
      this.setState({ error: "Cannot confirm: no project loaded." });
      return;
    }

    // 1. Stamp all fields CONFIRMED
    const confirmedProvenance = stampAllConfirmed(profile.provenance.perField);
    let updatedProfile: ProjectProfile = {
      ...profile,
      provenance: { ...profile.provenance, perField: confirmedProvenance },
    };

    // 2. Final validation
    const validation = this.runValidation(updatedProfile);
    updatedProfile = { ...updatedProfile, validation };

    // 3. Transition to REVIEW_PENDING (or VALIDATED if no errors)
    const projectStatus: ProjectStatus =
      validation.errors.length === 0 && validation.missingFields.length === 0
        ? "VALIDATED"
        : "REVIEW_PENDING";

    // 4. Update completion
    updatedProfile = {
      ...updatedProfile,
      completion: {
        ...updatedProfile.completion,
        lastUpdatedAt: new Date().toISOString(),
      },
    };

    this.setState({ profile: updatedProfile, projectStatus, error: null });

    // Emit typed event
    this.emitTypedEvent<ProjectConfirmedEvent>({
      type: "PROJECT_CONFIRMED",
      projectId: this.state.projectId ?? "",
      timestamp: new Date().toISOString(),
      payload: { confirmedProfile: updatedProfile },
    });

    // Persist
    this.persist(updatedProfile, projectStatus);
  }

  /**
   * Set the active interview phase and update phase progress.
   */
  setPhase(phase: InterviewPhase): void {
    const profile = this.state.profile;
    if (!profile) {
      this.setState({ error: "Cannot set phase: no project loaded." });
      return;
    }

    const previousPhase = profile.completion.currentPhase;
    const currentPhaseProgress = { ...profile.completion.phaseProgress };

    // Mark the new phase as IN_PROGRESS if not yet started
    if (currentPhaseProgress[phase]?.status === "NOT_STARTED") {
      currentPhaseProgress[phase] = {
        ...currentPhaseProgress[phase],
        status: "IN_PROGRESS",
      };
    }

    const updatedProfile: ProjectProfile = {
      ...profile,
      completion: {
        ...profile.completion,
        currentPhase: phase,
        phaseProgress: currentPhaseProgress,
        lastUpdatedAt: new Date().toISOString(),
      },
    };

    this.setState({ profile: updatedProfile, error: null });

    // Emit typed event
    this.emitTypedEvent<InterviewPhaseChangedEvent>({
      type: "INTERVIEW_PHASE_CHANGED",
      projectId: this.state.projectId ?? "",
      timestamp: new Date().toISOString(),
      payload: { previousPhase, newPhase: phase },
    });

    this.persist(updatedProfile);
  }

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private setState(partial: Partial<InterviewStoreState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const snapshot = this.getState();
    const listenersArr = Array.from(this.listeners);
    for (const listener of listenersArr) {
      try {
        listener(snapshot);
      } catch {
        // Listener errors must not break the store.
      }
    }
  }

  /**
   * Emit a typed event through the EventBus.
   */
  private emitTypedEvent<T extends AnyAppEvent>(event: T): void {
    const bus = getOrLoadEventBus();
    if (bus) {
      bus.emit(event);
    }
  }

  private runValidation(profile: ProjectProfile): ProjectProfile["validation"] {
    // Milestone 1 is complete — use the real Validation Engine.
    const result = validateProject(profile);
    return {
      completeness: result.completeness,
      missingFields: result.missingFields,
      errors: result.errors,
      contradictions: result.contradictions,
    };
  }

  /**
   * Infer ProjectStatus from the profile's current state.
   */
  private inferStatus(profile: ProjectProfile): ProjectStatus {
    const { completeness, missingFields, errors } = profile.validation;
    const perFieldEntries = Object.entries(profile.provenance.perField);
    const hasSourceFields = perFieldEntries.some(
      ([, p]) => (p as FieldProvenance).source !== null
    );

    if (!hasSourceFields) return "EMPTY";
    if (completeness === 0) return "EMPTY";
    if (missingFields.length > 0 && completeness < 50) return "PARTIAL";
    if (missingFields.length > 0) return "DISCOVERING";
    if (errors.length > 0) return "COMPLETE";
    if (perFieldEntries.some(
      ([, p]) => {
        const prov = p as FieldProvenance;
        return prov.verification === "CONFIRMED" || prov.verification === "VALIDATED";
      }
    )) {
      return "VALIDATED";
    }
    return "COMPLETE";
  }

  /**
   * Persist the profile to the repository (fire-and-forget).
   */
  private async persist(profile: ProjectProfile, status?: ProjectStatus): Promise<void> {
    const id = this.state.projectId;
    if (!id) return;

    const repo = getOrLoadRepository();
    if (!repo) return;

    try {
      await repo.updateProfile(id, profile, status);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[InterviewStore] Persist error:", message);
    }
  }
}

// ── Singleton (convenient for non-React consumers) ────────────────────────

export const interviewStore = new InterviewStore();