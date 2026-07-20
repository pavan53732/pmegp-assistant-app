import { db } from "@/lib/db";
import { getProjectRepository } from "@/database/project-repository";
import { apiError, apiSuccess } from "@/app/api/error-handler";

// ── GET: Fetch a single project ──────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return apiError("Project ID is required", 400);
  }

  try {
    const repo = getProjectRepository();
    const project = await repo.getById(id);
    if (!project) {
      return apiError("Project not found", 404);
    }
    return apiSuccess(project);
  } catch {
    return apiError("Failed to fetch project");
  }
}

// ── POST: Duplicate a project ──────────────────────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return apiError("Project ID is required", 400);
  }

  try {
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return apiError("Project not found", 404);
    }

    const newName = `${existing.name} (Copy)`;

    const duplicated = await db.project.create({
      data: {
        name: newName,
        profileData: existing.profileData,
        provenanceData: existing.provenanceData,
        completionData: existing.completionData,
        status: "EMPTY",
      },
    });

    return apiSuccess({ id: duplicated.id, name: duplicated.name });
  } catch {
    return apiError("Failed to duplicate project");
  }
}

// ── PATCH: Rename a project ─────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return apiError("Project ID is required", 400);
  }

  try {
    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name || typeof name !== "string" || !name.trim()) {
      return apiError("Project name is required", 400);
    }

    await db.project.update({ where: { id }, data: { name: name.trim() } });
    return apiSuccess({ renamed: true, name: name.trim() });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return apiError("Project not found", 404);
    }
    return apiError("Failed to rename project");
  }
}

// ── DELETE: Remove a project ────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return apiError("Project ID is required", 400);
  }

  try {
    const repo = getProjectRepository();
    await repo.delete(id);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return apiError("Project not found", 404);
    }
    return apiError("Failed to delete project");
  }
}
