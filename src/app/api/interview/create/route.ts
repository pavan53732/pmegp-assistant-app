// ─── POST /api/interview/create ─────────────────────────────────────────────
// Creates a new project and returns the project ID.
// The client can then start the interview via /api/interview/chat.
//
// Request:  { name: string }
// Response: { success: true, data: { projectId: string } }
// ───────────────────────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { getProjectRepository } from "@/database/project-repository";
import { apiError, apiSuccess } from "@/app/api/error-handler";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return apiError("Project name is required.", 400);
    }

    const repo = getProjectRepository();
    const project = await repo.create(name.trim());

    return apiSuccess({ projectId: project.id });
  } catch (err) {
    console.error("[/api/interview/create] Error:", err);
    return apiError("Failed to create project.", 500);
  }
}