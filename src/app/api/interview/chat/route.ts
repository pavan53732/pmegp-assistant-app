// ─── POST /api/interview/chat ───────────────────────────────────────────────
// Processes a user message and returns the AI response.
//
// Request:  { projectId: string; message: string }
// Query:    ?stream=true  → returns SSE stream instead of JSON
// Response (default): { success: boolean; data: { message, profile, state } }
// Response (stream=true): SSE events:
//   event: chunk     data: { content: "..." }
//   event: message   data: { message, profile, state }
//   event: error     data: { message: "..." }
//   event: done      data: {}
//
// Uses InterviewController (one instance per request) to process messages.
// ───────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { InterviewController } from "@/features/ai/interview/orchestrator";
import { getProjectRepository } from "@/database/project-repository";
import { apiError, apiSuccess } from "@/app/api/error-handler";
import type { ChatMessage } from "@/features/ai/interview/types";

export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  const isStreaming = url.searchParams.get("stream") === "true";

  try {
    const body = await request.json();
    const { projectId, message } = body;

    if (!projectId || typeof projectId !== "string") {
      return apiError("projectId is required.", 400);
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return apiError("message is required.", 400);
    }

    // Verify project exists
    const repo = getProjectRepository();
    const project = await repo.getById(projectId);
    if (!project) {
      return apiError("Project not found.", 404);
    }

    // Create a controller per request (server-side, stateless)
    const controller = new InterviewController(projectId);

    // Start the interview if this is the first interaction
    if (project.profile.completion.interactionCount === 0) {
      await controller.startNewInterview();
    }

    // Build the user message that will be saved to history
    const userMsgForHistory: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "USER",
      content: message.trim(),
      timestamp: new Date().toISOString(),
      phase: controller.getState().currentPhase,
    };

    // Process the user's message
    const aiMessage = await controller.processUserMessage(message.trim());

    // Get the updated profile and state
    const updatedProfile = controller.getProfile();
    const state = controller.getState();

    // Persist the profile through the repository
    if (updatedProfile) {
      await repo.updateProfile(projectId, updatedProfile);
    }

    // Persist chat history (user message + AI message)
    await repo.appendChatMessages(projectId, [userMsgForHistory, aiMessage]);

    // ── Streaming response ──────────────────────────────────────────────
    if (isStreaming) {
      const text = aiMessage.content ?? "";
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Stream the AI text in small chunks for a word-by-word effect
            // Split by word boundaries, sending each word + trailing space
            const words = text.split(/(\s+)/);
            let sent = 0;

            for (let i = 0; i < words.length; i++) {
              const word = words[i];
              if (!word) continue;

              sent += word.length;

              const chunk = JSON.stringify({ content: word });
              controller.enqueue(
                encoder.encode(`event: chunk\ndata: ${chunk}\n\n`)
              );

              // Small delay between words for visual effect (5-15ms)
              if (word.trim().length > 0) {
                await new Promise((r) => setTimeout(r, 8 + Math.random() * 10));
              }
            }

            // Send the full message metadata so the client can finalize
            const metadata = JSON.stringify({
              message: aiMessage,
              profile: updatedProfile,
              state,
            });
            controller.enqueue(
              encoder.encode(`event: message\ndata: ${metadata}\n\n`)
            );

            controller.enqueue(
              encoder.encode(`event: done\ndata: {}\n\n`)
            );
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Stream error";
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ message: errorMsg })}\n\n`)
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // ── Non-streaming response (backward compatible) ────────────────────
    return apiSuccess({
      message: aiMessage,
      profile: updatedProfile,
      state,
    });
  } catch (err) {
    console.error("[/api/interview/chat] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    // For streaming requests, send error as SSE
    if (isStreaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`
            )
          );
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    return apiError(errorMessage, 500);
  }
}