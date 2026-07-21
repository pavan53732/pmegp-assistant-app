// ─── AI Provider Abstraction ─────────────────────────────────────────────────
// The ONLY outbound network code in the entire application.
// Wraps z-ai-web-dev-sdk for the built-in provider, and falls back to a
// direct OpenAI-compatible fetch when the user has configured a custom
// AI provider via Settings.
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

/**
 * Connection details for a user-configured AI provider.
 * Sourced from the `AiProviderConfig` database model.
 */
export interface ProviderConnectionConfig {
  /** OpenAI-compatible base URL, e.g. "https://api.openai.com/v1" */
  baseUrl: string;
  /** Bearer API key for the provider. */
  apiKey: string;
  /** Model identifier, e.g. "gpt-4o", "claude-3-5-sonnet-20241022". */
  modelName: string;
}

const DEFAULT_CONFIG: ProviderConfig = {
  maxRetries: 3,
  maxHistoryLength: 30,
};

// ── SDK Singleton (built-in provider) ────────────────────────────────────────

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!_zai) {
    _zai = await ZAI.create();
  }
  return _zai;
}

// ── OpenAI-compatible fetch ──────────────────────────────────────────────────

/**
 * Call an OpenAI-compatible chat completions endpoint via direct `fetch`.
 * Used when the user has configured a custom AI provider with their own
 * base URL, API key, and model name.
 *
 * The response format must follow the standard OpenAI schema:
 *   { choices: [{ message: { content: "..." } }] }
 *
 * @param messages  - Conversation history in OpenAI format.
 * @param conn      - The user's provider connection configuration.
 */
async function callOpenAICompatible(
  messages: Array<{ role: string; content: string }>,
  conn: ProviderConnectionConfig
): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }> {
  // Ensure the base URL ends with /chat/completions
  let endpoint = conn.baseUrl.replace(/\/+$/, "");
  if (!endpoint.endsWith("/chat/completions")) {
    endpoint += "/chat/completions";
  }

  // Never log the API key (RULE #16)
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${conn.apiKey}`,
    },
    body: JSON.stringify({
      model: conn.modelName,
      messages,
      // Use the standard "system" role — OpenAI-compatible endpoints support it
    }),
  });

  if (!response.ok) {
    const status = response.status;
    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch {
      // ignore read failure
    }
    // Extract a helpful error message from the response body if possible
    let detail = `HTTP ${status}`;
    try {
      const parsed = JSON.parse(errorBody) as { error?: { message?: string } };
      if (parsed.error?.message) {
        detail += `: ${parsed.error.message}`;
      }
    } catch {
      // not JSON — use raw text snippet
      if (errorBody.length > 0) {
        detail += `: ${errorBody.slice(0, 200)}`;
      }
    }
    throw new Error(detail);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error("Empty response from AI provider");
  }

  return {
    content,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Send a chat completion request with conversation history.
 *
 * @param messages        - Full conversation history (system + user + assistant turns).
 *                          The system prompt should be the first message with role "system".
 * @param config          - Optional provider configuration overrides (retry, history limits).
 * @param connectionConfig - When provided, use the user's configured AI provider via a
 *                           direct OpenAI-compatible fetch instead of the built-in SDK.
 *                           This is how the Settings → AI Provider configuration flows
 *                           into the interview system.
 * @returns The AI response text, or an error.
 *
 * This is the ONLY function that makes an outbound network call.
 * All AI access in the application flows through this function.
 */
export async function getAIResponse(
  messages: ProviderMessage[],
  config: Partial<ProviderConfig> = {},
  connectionConfig?: ProviderConnectionConfig
): Promise<ProviderResponse> {
  const { maxRetries, maxHistoryLength } = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  // Trim history to max length (keep first message = system prompt)
  let trimmed = messages;
  if (trimmed.length > maxHistoryLength) {
    trimmed = [trimmed[0], ...trimmed.slice(-(maxHistoryLength - 1))];
  }

  // When a custom provider is configured, use direct fetch.
  // OpenAI-compatible endpoints natively support the "system" role,
  // so no role conversion is needed.
  if (connectionConfig) {
    const sdkMessages = trimmed.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await callOpenAICompatible(sdkMessages, connectionConfig);
        return {
          success: true,
          content: result.content,
          usage: result.usage,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(
          `[Provider] Custom provider attempt ${attempt}/${maxRetries} failed:`,
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

  // ── Built-in SDK path ──────────────────────────────────────────────────
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
        `[Provider] SDK attempt ${attempt}/${maxRetries} failed:`,
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