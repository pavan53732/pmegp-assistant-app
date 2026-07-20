// ─── Client-Side Interview API ─────────────────────────────────────────────
// Thin wrapper over the interview API endpoints.
// UI components call these functions; they never import engines or stores.
// ───────────────────────────────────────────────────────────────────────────

import type { ChatMessage } from "@/features/ai/interview/types";
import type { InterviewState } from "@/features/ai/interview/types";
import type { ProjectProfile } from "@/shared/types/project-profile";

// ── Types ─────────────────────────────────────────────────────────────────

interface ApiSuccessResponse<T> {
  success: boolean;
  data: T;
}

interface ApiErrorResponse {
  success: boolean;
  error: { message: string; code: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Format integer rupees in Indian notation: ₹25,00,000 */
export function formatIndianCurrency(amount: number): string {
  if (amount == null || isNaN(amount)) return "—";
  const str = Math.abs(amount).toString();
  const digits = str.padStart(3, "0");
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${formatted}`;
}

/** Format a date in Indian locale (DD MMM YYYY). */
export function formatIndianDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── API Functions ──────────────────────────────────────────────────────────

export async function createProject(name: string): Promise<string> {
  const res = await fetch("/api/interview/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json() as ApiSuccessResponse<{ projectId: string }> | ApiErrorResponse;
  if (!data.success) {
    throw new Error((data as ApiErrorResponse).error?.message ?? "Failed to create project");
  }
  return (data as ApiSuccessResponse<{ projectId: string }>).data.projectId;
}

export async function sendChatMessage(
  projectId: string,
  message: string
): Promise<{ message: ChatMessage; profile: ProjectProfile; state: InterviewState }> {
  const res = await fetch("/api/interview/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, message }),
  });
  const data = await res.json() as ApiSuccessResponse<{ message: ChatMessage; profile: ProjectProfile; state: InterviewState }> | ApiErrorResponse;
  if (!data.success) {
    throw new Error((data as ApiErrorResponse).error?.message ?? "Failed to send message");
  }
  return (data as ApiSuccessResponse<{ message: ChatMessage; profile: ProjectProfile; state: InterviewState }>).data;
}

export async function fetchProjects(): Promise<
  { id: string; name: string; status: string; createdAt: string; updatedAt: string }[]
> {
  const res = await fetch("/api/projects");
  const data = await res.json();
  return data.projects ?? [];
}

export async function duplicateProject(id: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "POST",
  });
  const data = await res.json() as ApiSuccessResponse<{ id: string; name: string }> | ApiErrorResponse;
  if (!data.success) {
    throw new Error((data as ApiErrorResponse).error?.message ?? "Failed to duplicate project");
  }
  return (data as ApiSuccessResponse<{ id: string; name: string }>).data;
}

export async function exportProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
  const data = await res.json();
  const projectData = data.data ?? data;
  const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const name = projectData?.project?.name ?? projectData?.name ?? "project";
  a.href = url;
  a.download = `${name}-export.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}