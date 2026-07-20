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

/** Callback invoked for each streamed text chunk. */
export type StreamChunkCallback = (chunk: string) => void;

/** Result of a completed streaming request. */
export interface StreamResult {
  message: ChatMessage;
  profile: ProjectProfile;
  state: InterviewState;
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

/**
 * Stream a chat message via SSE.
 *
 * Calls `onChunk` with each text fragment as it arrives, then resolves with
 * the full metadata (message object, profile, state) once the stream completes.
 *
 * The `signal` from an AbortController can be passed to cancel mid-stream.
 *
 * Falls back to non-streaming if the SSE connection fails.
 */
export async function streamChatMessage(
  projectId: string,
  message: string,
  onChunk: StreamChunkCallback,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const res = await fetch("/api/interview/chat?stream=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, message }),
    signal,
  });

  // If the response is not a stream (e.g. server returned JSON error),
  // fall back to non-streaming mode
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    // Try parsing as JSON error
    try {
      const data = await res.json() as ApiErrorResponse;
      if (!data.success) {
        throw new Error(data.error?.message ?? "Stream request failed");
      }
    } catch (err) {
      if (err instanceof Error && err.message !== "Stream request failed") {
        // JSON parse failed, re-throw as a generic error
        throw new Error("Failed to initiate streaming. Retrying with standard mode...");
      }
      throw err;
    }
    // If we somehow got a success JSON response, return it
    // (This shouldn't normally happen with stream=true)
    throw new Error("Unexpected non-stream response");
  }

  return new Promise<StreamResult>((resolve, reject) => {
    const reader = res.body?.getReader();
    if (!reader) {
      reject(new Error("No response body"));
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let result: StreamResult | null = null;

    function processLines() {
      // Split buffer by double newlines (SSE message boundary)
      const parts = buffer.split("\n\n");
      // Keep the last potentially incomplete part in the buffer
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n");
        let eventType = "";
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6);
          }
        }

        if (!eventType || !eventData) continue;

        try {
          const parsed = JSON.parse(eventData);

          switch (eventType) {
            case "chunk": {
              const content = (parsed as { content: string }).content;
              fullContent += content;
              onChunk(fullContent); // Send cumulative content so far
              break;
            }
            case "message": {
              result = parsed as unknown as StreamResult;
              break;
            }
            case "error": {
              const errMsg = (parsed as { message: string }).message;
              // If we have some content, resolve with partial result
              if (result) {
                resolve(result);
              } else {
                reject(new Error(errMsg));
              }
              return;
            }
            case "done": {
              if (result) {
                resolve(result);
              } else {
                // Edge case: no message event was received
                reject(new Error("Stream completed without message data"));
              }
              return;
            }
          }
        } catch {
          // Ignore malformed JSON in SSE events
        }
      }
    }

    async function read() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          processLines();
        }

        // Process any remaining data in the buffer
        if (buffer.trim()) {
          processLines();
        }

        // If we haven't resolved yet, resolve with what we have
        if (result) {
          resolve(result);
        } else if (fullContent) {
          // We got content but no message metadata — construct a minimal result
          reject(new Error("Stream ended without complete message metadata"));
        } else {
          reject(new Error("Stream ended unexpectedly"));
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled via stop button — resolve with empty/partial data
          // The caller should handle this gracefully
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Stream aborted"));
          }
        } else {
          reject(err);
        }
      }
    }

    read();
  });
}

export async function fetchProjects(): Promise<
  { id: string; name: string; status: string; createdAt: string; updatedAt: string }[]
> {
  const res = await fetch("/api/projects");
  const data = await res.json();
  return data.projects ?? [];
}

export async function fetchChatHistory(
  projectId: string
): Promise<ChatMessage[]> {
  const res = await fetch(
    `/api/interview/history?projectId=${encodeURIComponent(projectId)}`
  );
  const data = await res.json() as ApiSuccessResponse<{ messages: ChatMessage[] }> | ApiErrorResponse;
  if (!data.success) {
    throw new Error((data as ApiErrorResponse).error?.message ?? "Failed to fetch chat history");
  }
  return (data as ApiSuccessResponse<{ messages: ChatMessage[] }>).data.messages;
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