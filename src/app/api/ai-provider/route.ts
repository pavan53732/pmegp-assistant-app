import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/app/api/error-handler";

/** Mask API key: show only the last 4 characters. */
function maskApiKey(key: string): string {
  if (key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}

// ─── GET: List all AI provider configs ─────────────────────────────────────
export async function GET() {
  try {
    const providers = await db.aiProviderConfig.findMany({
      orderBy: { createdAt: "desc" },
    });

    const safe = providers.map((p) => ({
      id: p.id,
      baseUrl: p.baseUrl,
      modelName: p.modelName,
      isActive: p.isActive,
      createdAt: p.createdAt,
      apiKeyMasked: maskApiKey(p.apiKey),
    }));

    return apiSuccess(safe);
  } catch {
    return apiError("Failed to fetch AI providers");
  }
}

// ─── POST: Create a new provider config ────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { baseUrl, modelName, apiKey, isActive } = body as {
      baseUrl?: string;
      modelName?: string;
      apiKey?: string;
      isActive?: boolean;
    };

    // Validate required fields
    if (!baseUrl || typeof baseUrl !== "string" || !baseUrl.trim()) {
      return apiError("Base URL is required", 400);
    }
    if (!modelName || typeof modelName !== "string" || !modelName.trim()) {
      return apiError("Model name is required", 400);
    }
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return apiError("API key is required", 400);
    }

    const trimmedBaseUrl = baseUrl.trim();
    const trimmedModel = modelName.trim();
    const trimmedKey = apiKey.trim();
    const shouldBeActive = isActive !== false; // default true

    // Check if another provider is already active
    if (shouldBeActive) {
      const existingActive = await db.aiProviderConfig.findFirst({
        where: { isActive: true },
      });
      if (existingActive) {
        return apiError(
          "Another provider is already active. Deactivate it first, or set this provider as inactive.",
          409
        );
      }
    }

    const provider = await db.aiProviderConfig.create({
      data: {
        baseUrl: trimmedBaseUrl,
        modelName: trimmedModel,
        apiKey: trimmedKey,
        isActive: shouldBeActive,
      },
    });

    return apiSuccess(
      {
        id: provider.id,
        baseUrl: provider.baseUrl,
        modelName: provider.modelName,
        isActive: provider.isActive,
        createdAt: provider.createdAt,
        apiKeyMasked: maskApiKey(provider.apiKey),
      },
      201
    );
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return apiError("A provider with this configuration already exists", 409);
    }
    return apiError("Failed to create AI provider");
  }
}

// ─── PATCH: Update a provider config ───────────────────────────────────────
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, baseUrl, modelName, apiKey, isActive } = body as {
      id?: string;
      baseUrl?: string;
      modelName?: string;
      apiKey?: string;
      isActive?: boolean;
    };

    if (!id || typeof id !== "string" || !id.trim()) {
      return apiError("Provider ID is required", 400);
    }

    // Build update data dynamically
    const data: Record<string, unknown> = {};
    if (baseUrl !== undefined) {
      if (typeof baseUrl !== "string" || !baseUrl.trim()) {
        return apiError("Base URL cannot be empty", 400);
      }
      data.baseUrl = baseUrl.trim();
    }
    if (modelName !== undefined) {
      if (typeof modelName !== "string" || !modelName.trim()) {
        return apiError("Model name cannot be empty", 400);
      }
      data.modelName = modelName.trim();
    }
    if (apiKey !== undefined) {
      if (typeof apiKey !== "string" || !apiKey.trim()) {
        return apiError("API key cannot be empty", 400);
      }
      data.apiKey = apiKey.trim();
    }
    if (isActive !== undefined) {
      data.isActive = Boolean(isActive);
    }

    // If setting this provider as active, deactivate all others first
    if (data.isActive === true) {
      await db.aiProviderConfig.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }

    const provider = await db.aiProviderConfig.update({
      where: { id },
      data,
    });

    return apiSuccess({
      id: provider.id,
      baseUrl: provider.baseUrl,
      modelName: provider.modelName,
      isActive: provider.isActive,
      createdAt: provider.createdAt,
      apiKeyMasked: maskApiKey(provider.apiKey),
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return apiError("Provider not found", 404);
    }
    return apiError("Failed to update AI provider");
  }
}