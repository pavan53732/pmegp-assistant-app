// ─── Client-Side Interview API ─────────────────────────────────────────────
// Thin wrapper over the interview API endpoints.
// UI components call these functions; they never import engines or stores.
// ───────────────────────────────────────────────────────────────────────────

import type { ChatMessage } from "@/features/ai/interview/types";
import type { InterviewState } from "@/features/ai/interview/types";
import type { ProjectProfile } from "@/shared/types/project-profile";

// ── Types ─────────────────────────────────────────────────────────────────

interface CreateProjectResponse {
  success: boolean;
  projectId?: string;
  error?: string;
}

interface ChatResponse {
  success: boolean;
  message?: ChatMessage;
  profile?: ProjectProfile;
  state?: InterviewState;
  error?: string;
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
  const data: CreateProjectResponse = await res.json();
  if (!data.success || !data.projectId) {
    throw new Error(data.error ?? "Failed to create project");
  }
  return data.projectId;
}

export async function sendChatMessage(
  projectId: string,
  message: string
): Promise<ChatResponse> {
  const res = await fetch("/api/interview/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, message }),
  });
  const data: ChatResponse = await res.json();
  if (!data.success) {
    throw new Error(data.error ?? "Failed to send message");
  }
  return data;
}

export async function fetchProjects(): Promise<
  { id: string; name: string; status: string; createdAt: string; updatedAt: string }[]
> {
  const res = await fetch("/api/projects");
  const data = await res.json();
  return data.projects ?? [];
}