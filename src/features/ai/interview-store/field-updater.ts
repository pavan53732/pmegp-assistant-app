import type { ProjectProfile } from "@/shared/types/project-profile";
import type { FieldProvenance } from "@/shared/types/provenance";

/** Set a value at a dot-notation path. Returns a NEW profile (immutable). */
export function setFieldValue(profile: ProjectProfile, fieldPath: string, value: unknown): ProjectProfile {
  const newProfile = JSON.parse(JSON.stringify(profile)) as ProjectProfile;
  const parts = fieldPath.split(".");
  let current: Record<string, unknown> = newProfile as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
  return newProfile;
}

/** Get a value at a dot-notation path. */
export function getFieldValue(profile: ProjectProfile, fieldPath: string): unknown {
  const parts = fieldPath.split(".");
  let current: unknown = profile;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Update provenance for a field. Returns a NEW map (immutable). */
export function updateProvenance(
  map: Record<string, FieldProvenance>,
  fieldPath: string,
  source: "USER" | "AI" | "OCR" | "KNOWLEDGE" | null,
  verification: "UNVERIFIED" | "CONFIRMED" | "VALIDATED" = "UNVERIFIED"
): Record<string, FieldProvenance> {
  return {
    ...map,
    [fieldPath]: {
      source,
      verification,
      confirmedAt: verification === "CONFIRMED" ? new Date().toISOString() : undefined,
    },
  };
}

/** Stamp ALL fields with verification=CONFIRMED (for "Confirm Project" button). */
export function stampAllConfirmed(map: Record<string, FieldProvenance>): Record<string, FieldProvenance> {
  const now = new Date().toISOString();
  const result: Record<string, FieldProvenance> = {};
  for (const [field, p] of Object.entries(map)) {
    if (p.source !== null) result[field] = { ...p, verification: "CONFIRMED" as const, confirmedAt: now };
  }
  return result;
}

/** Stamp ALL fields with verification=VALIDATED. */
export function stampAllValidated(map: Record<string, FieldProvenance>): Record<string, FieldProvenance> {
  const result: Record<string, FieldProvenance> = {};
  for (const [field, p] of Object.entries(map)) {
    if (p.source !== null) result[field] = { ...p, verification: "VALIDATED" as const };
  }
  return result;
}

/** Compute derived fields. Currently: isWomen from gender. */
export function computeDerivedFields(profile: ProjectProfile): ProjectProfile {
  if (profile.applicant.gender === "FEMALE" && !profile.applicant.isWomen) {
    return { ...profile, applicant: { ...profile.applicant, isWomen: true } };
  }
  if (profile.applicant.gender !== "FEMALE" && profile.applicant.isWomen) {
    return { ...profile, applicant: { ...profile.applicant, isWomen: false } };
  }
  return profile;
}