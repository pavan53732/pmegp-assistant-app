// ─── AI Provider Abstraction ─────────────────────────────────────────────────
// The ONLY outbound network code in the entire application.
// Wraps z-ai-web-dev-sdk for use by the AI Interview subsystem.
//
// RULE #13: The only outbound network call is to the AI endpoint.
// RULE #16: PII masked before it enters any prompt. API key never logged.
//
// Backend only — never import from client-side code.
// ───────────────────────────────────────────────────────────────────────────────

import ZAI from "z-ai-web-dev-sdk";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProviderMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ProviderResponse {
  success: boolean;
  content: string | null;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface ProviderConfig {
  maxRetries: number;
  maxHistoryLength: number;
}

const DEFAULT_CONFIG: ProviderConfig = {
  maxRetries: 3,
  maxHistoryLength: 30,
};

// ── Singleton ──────────────────────────────────────────────────────────────

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!_zai) {
    _zai = await ZAI.create();
  }
  return _zai;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Send a chat completion request with conversation history.
 *
 * @param messages - Full conversation history (system + user + assistant turns).
 *   The system prompt should be the first message with role "system" (sent as "assistant" per SDK).
 * @param config - Optional configuration overrides.
 * @returns The AI response text, or an error.
 *
 * This is the ONLY function that makes an outbound network call.
 * All AI access in the application flows through this function.
 */
export async function getAIResponse(
  messages: ProviderMessage[],
  config: Partial<ProviderConfig> = {}
): Promise<ProviderResponse> {
  const { maxRetries, maxHistoryLength } = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  // Trim history to max length (keep first message = system prompt)
  let trimmed = messages;
  if (trimmed.length > maxHistoryLength) {
    trimmed = [trimmed[0], ...trimmed.slice(-(maxHistoryLength - 1))];
  }

  // Convert "system" role to "assistant" for the SDK (z-ai-web-dev-sdk convention)
  const sdkMessages = trimmed.map((m) => ({
    role: m.role === "system" ? ("assistant" as const) : (m.role as "user" | "assistant"),
    content: m.content,
  }));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const zai = await getZAI();

      const completion = await zai.chat.completions.create({
        messages: sdkMessages,
        thinking: { type: "disabled" },
      });

      const content = completion.choices?.[0]?.message?.content;

      if (!content || content.trim().length === 0) {
        throw new Error("Empty response from AI provider");
      }

      return {
        success: true,
        content,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[Provider] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * attempt)
        );
      }
    }
  }

  return {
    success: false,
    content: null,
    error: lastError?.message ?? "Unknown provider error",
  };
}