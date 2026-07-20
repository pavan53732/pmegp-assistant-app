// ─── GET /api/interview/history?projectId=xxx ──────────────────────────────
// Returns the stored chat message history for a project.
// ───────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { getProjectRepository } from "@/database/project-repository";
import { apiError, apiSuccess } from "@/app/api/error-handler";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!projectId || typeof projectId !== "string") {
    return apiError("projectId is required.", 400);
  }

  try {
    const repo = getProjectRepository();
    const messages = await repo.getChatHistory(projectId);
    return apiSuccess({ messages });
  } catch (err) {
    console.error("[/api/interview/history] Error:", err);
    return apiError("Failed to fetch chat history.", 500);
  }
}