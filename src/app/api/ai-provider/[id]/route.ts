import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/app/api/error-handler";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return apiError("Provider ID is required", 400);
  }

  try {
    await db.aiProviderConfig.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return apiError("Provider not found", 404);
    }
    return apiError("Failed to delete AI provider");
  }
}