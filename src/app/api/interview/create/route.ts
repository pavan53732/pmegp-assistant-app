// ─── POST /api/interview/create ─────────────────────────────────────────────
// Creates a new project and returns the project ID.
// The client can then start the interview via /api/interview/chat.
//
// Request:  { name: string }
// Response: { projectId: string }
// ───────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getProjectRepository } from "@/database/project-repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Project name is required." },
        { status: 400 }
      );
    }

    const repo = getProjectRepository();
    const project = await repo.create(name.trim());

    return NextResponse.json({
      success: true,
      projectId: project.id,
    });
  } catch (err) {
    console.error("[/api/interview/create] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create project." },
      { status: 500 }
    );
  }
}