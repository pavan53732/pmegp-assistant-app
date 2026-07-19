// ─── POST /api/interview/chat ───────────────────────────────────────────────
// Processes a user message and returns the AI response.
//
// Request:  { projectId: string; message: string }
// Response: { success: boolean; data: { message, profile, state } }
//
// Uses InterviewController (one instance per request) to process messages.
// ───────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { InterviewController } from "@/features/ai/interview/orchestrator";
import { getProjectRepository } from "@/database/project-repository";
import { apiError, apiSuccess } from "@/app/api/error-handler";

export async function POST(request: NextRequest) {
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

    // Process the user's message
    const aiMessage = await controller.processUserMessage(message.trim());

    // Get the updated profile and state
    const updatedProfile = controller.getProfile();
    const state = controller.getState();

    // Persist the profile through the repository
    if (updatedProfile) {
      await repo.updateProfile(projectId, updatedProfile);
    }

    return apiSuccess({
      message: aiMessage,
      profile: updatedProfile,
      state,
    });
  } catch (err) {
    console.error("[/api/interview/chat] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return apiError(errorMessage, 500);
  }
}