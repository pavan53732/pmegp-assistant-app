// ─── POST /api/interview/chat ───────────────────────────────────────────────
// Processes a user message and returns the AI response.
//
// Request:  { projectId: string; message: string }
// Response: { success: boolean; message: ChatMessage; profile: ProjectProfile; state: InterviewState }
//
// Uses InterviewController (one instance per request) to process messages.
// ───────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { InterviewController } from "@/features/ai/interview/orchestrator";
import { getProjectRepository } from "@/database/project-repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, message } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { success: false, error: "projectId is required." },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "message is required." },
        { status: 400 }
      );
    }

    // Verify project exists
    const repo = getProjectRepository();
    const project = await repo.getById(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found." },
        { status: 404 }
      );
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

    return NextResponse.json({
      success: true,
      message: aiMessage,
      profile: updatedProfile,
      state,
    });
  } catch (err) {
    console.error("[/api/interview/chat] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}