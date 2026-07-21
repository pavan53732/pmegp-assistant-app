// ─── AI Provider Abstraction ─────────────────────────────────────────────────
// The ONLY outbound network code in the entire application.
//
// In the Capacitor Android app there is no built-in AI provider and no backend.
// The user configures their own OpenAI-compatible provider (base URL + API key
// + model) in Settings; the API key is stored in Secure Storage (Android
// Keystore). This module issues a direct `fetch` to that endpoint and nothing
// else.
//
// Invariants:
//   - RULE #13: the only outbound network call is to the user's AI endpoint.
//   - RULE #16: PII masked before it enters any prompt; API key never logged.
//   - No z-ai-web-dev-sdk (server-only SDK removed for the Capacitor build).
// ───────────────────────────────────────────────────────────────────────────────

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
 * Sourced from the `ai_provider_config` SQLite table (base URL + model) and
 * Secure Storage (API key).
 */
export interface ProviderConnectionConfig {
  /** OpenAI-compatible base URL, e.g. "https://api.openai.com/v1" */
  baseUrl: string;
  /** Bearer API key for the provider. NEVER logged, NEVER persisted to SQLite. */
  apiKey: string;
  /** Model identifier, e.g. "gpt-4o", "claude-3-5-sonnet-20241022". */
  modelName: string;
}

const DEFAULT_CONFIG: ProviderConfig = {
  maxRetries: 3,
  maxHistoryLength: 30,
};

// ── OpenAI-compatible fetch ──────────────────────────────────────────────────

/**
 * Call an OpenAI-compatible chat completions endpoint via direct `fetch`.
 *
 * The response format must follow the standard OpenAI schema:
 *   { choices: [{ message: { content: "..." } }] }
 */
async function callOpenAICompatible(
  messages: Array<{ role: string; content: string }>,
  conn: ProviderConnectionConfig
): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }> {
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
    let detail = `HTTP ${status}`;
    try {
      const parsed = JSON.parse(errorBody) as { error?: { message?: string } };
      if (parsed.error?.message) {
        detail += `: ${parsed.error.message}`;
      }
    } catch {
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
 * Send a chat completion request with conversation history to the user's
 * configured AI provider. This is the ONLY function that makes an outbound
 * network call. All AI access in the application flows through it.
 *
 * @param messages        - Full conversation history (system prompt first).
 * @param connectionConfig - The user's provider config (required — there is no
 *                           built-in provider in the Capacitor app).
 * @param config          - Optional provider configuration overrides.
 */
export async function getAIResponse(
  messages: ProviderMessage[],
  connectionConfig: ProviderConnectionConfig,
  config: Partial<ProviderConfig> = {}
): Promise<ProviderResponse> {
  const { maxRetries, maxHistoryLength } = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  // Trim history to max length (keep first message = system prompt)
  let trimmed = messages;
  if (trimmed.length > maxHistoryLength) {
    trimmed = [trimmed[0], ...trimmed.slice(-(maxHistoryLength - 1))];
  }

  const sdkMessages = trimmed.map((m) => ({ role: m.role, content: m.content }));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await callOpenAICompatible(sdkMessages, connectionConfig);
      return { success: true, content: result.content, usage: result.usage };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[Provider] attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  return {
    success: false,
    content: null,
    error: lastError?.message ?? "Unknown provider error",
  };
}
