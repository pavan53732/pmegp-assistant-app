// ─── Response Parser ──────────────────────────────────────────────────────
// Local, deterministic intent classifier for user messages in the AI interview.
// This module determines WHAT the user is trying to do — not field extraction
// (that is the Field Extractor's job, Agent C).
//
// Pure functions only. No I/O, no AI calls, no side effects.
// See AGENT_CONTRACTS.md §12 (Response Parser) for the subsystem contract.
// ───────────────────────────────────────────────────────────────────────────

import type { InterviewPhase } from "@/shared/types/interview";
import type { ParsedUserIntent } from "./types";

// ── Keyword Sets ─────────────────────────────────────────────────────────

const GREETING_KEYWORDS: readonly string[] = [
  "hi",
  "hello",
  "hey",
  "good morning",
  "good afternoon",
  "good evening",
  "bye",
  "goodbye",
  "thanks",
  "thank you",
  "thankyou",
  "namaste",
  "namaskar",
  "dhanyavad",
  "shukriya",
  "see you",
  "take care",
  "good night",
];

const HELP_KEYWORDS: readonly string[] = [
  "help",
  "what is pmegp",
  "how does this work",
  "guide",
  "guidance",
  "kya karna hai",
  "kaise karna hai",
  "process kya hai",
  "steps",
  "what are the steps",
  "how to apply",
  "information about pmegp",
  "batao kya karna hai",
];

const REVIEW_KEYWORDS: readonly string[] = [
  "show me",
  "summary",
  "review",
  "what did i say",
  "so far",
  "what have i entered",
  "show my details",
  "show my data",
  "mera data dikhao",
  "summary dikhao",
  "what did i fill",
  "show all",
  "show progress",
  "my answers",
];

const GO_BACK_KEYWORDS: readonly string[] = [
  "go back",
  "previous",
  "earlier",
  "wapas jao",
  "pichle",
  "peeche",
];

const CORRECTION_KEYWORDS: readonly string[] = [
  "wrong",
  "not that",
  "change",
  "correct",
  "actually",
  "i meant",
  "sorry that was wrong",
  "galat",
  "sahi nahi",
  "theek nahi",
  "edit",
  "update",
  "modify",
  "i want to change",
  "please change",
  "wo nahi",
  "nahi wo",
];

const CONFIRM_KEYWORDS: readonly string[] = [
  "yes",
  "correct",
  "right",
  "that's right",
  "confirm",
  "ok",
  "okay",
  "sure",
  "haan",
  "ha",
  "sahi hai",
  "theek hai",
  "bilkul",
  "yup",
  "yep",
  "done",
  "proceed",
  "continue",
  "move on",
  "looks good",
  "fine",
  "perfect",
  "great",
  "nice",
];

const SKIP_KEYWORDS: readonly string[] = [
  "skip",
  "next",
  "i don't know",
  "leave it",
  "not sure",
  "pata nahi",
  "malum nahi",
  "skip this",
  "move to next",
  "leave this",
  "chod do",
  "chodo",
  "skip karo",
  "i'll tell later",
  "later",
  "baad mein",
  "don't know",
  "no idea",
  "unknown",
];

const CLARIFICATION_SIGNALS: readonly string[] = [
  "what do you mean",
  "explain",
  "why",
  "how",
  "what is",
  "can you explain",
  "what do you mean by",
  "kya matlab",
  "matlab kya",
  "samjhao",
  "kya kehte ho",
  "i don't understand",
  "confused",
  "please explain",
  "what does that mean",
  "could you clarify",
  "can you clarify",
  "matlab",
];

/** Out-of-scope signals — topics completely unrelated to PMEGP/business. */
const OUT_OF_SCOPE_KEYWORDS: readonly string[] = [
  "weather",
  "cricket",
  "movie",
  "film",
  "song",
  "joke",
  "recipe",
  "food recipe",
  "news today",
  "stock market",
  "crypto",
  "bitcoin",
  "politics",
  "election",
];

// ── Phase keyword mapping ────────────────────────────────────────────────

const PHASE_KEYWORDS: Record<InterviewPhase, string[]> = {
  APPLICANT_DISCOVERY: [
    "applicant",
    "personal",
    "name",
    "my details",
    "my information",
    "meri details",
    "personal details",
    "about me",
  ],
  BUSINESS_DISCOVERY: [
    "business",
    "enterprise",
    "entity",
    "company",
    "firm",
    "partnership",
    "vyapar",
    "business details",
    "business info",
  ],
  ACTIVITY_RESOLUTION: [
    "activity",
    "nic code",
    "nic",
    "industry",
    "type of business",
    "kaam",
    "activity type",
    "business activity",
    "what business",
  ],
  PROJECT_SIZING: [
    "project size",
    "capacity",
    "machinery",
    "equipment",
    "land",
    "building",
    "project cost",
    "size",
    "investment",
  ],
  FINANCIAL_PLANNING: [
    "financial",
    "loan",
    "subsidy",
    "own contribution",
    "margin money",
    "repayment",
    "finance",
    "paisa",
    "rupee",
    "amount",
    "funding",
  ],
  REVIEW: [
    "review",
    "check",
    "verify",
    "summary",
  ],
  VALIDATION_COMPLETION: [
    "validation",
    "complete",
    "submit",
    "finish",
    "final",
    "done",
  ],
};

// ── Known field names for correction detection ───────────────────────────

const KNOWN_FIELDS: readonly string[] = [
  "name",
  "address",
  "phone",
  "mobile",
  "email",
  "category",
  "caste",
  "gender",
  "dob",
  "date of birth",
  "qualification",
  "experience",
  "business name",
  "business address",
  "constitution",
  "nic code",
  "activity",
  "project cost",
  "loan amount",
  "subsidy",
  "own contribution",
  "margin money",
  "land",
  "building",
  "machinery",
  "raw material",
  "employees",
  "location",
  "district",
  "state",
  "pincode",
  "pin code",
  "rural",
  "urban",
  "area",
  "capacity",
  "turnover",
  "net profit",
  "repayment",
  "bank",
  "account",
];

// ── Helpers ──────────────────────────────────────────────────────────────

/** Case-insensitive check whether `needle` appears in `haystack`. */
function contains(haystack: string, needle: string): boolean {
  return haystack.includes(needle);
}

/** Normalise a string for matching: lowercase, collapse whitespace, strip trailing punctuation. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, " ")
    .replace(/[.!?,;:]+$/, "")
    .trim();
}

/**
 * Check if any keyword from a set appears in the normalised message.
 * Returns the first matching keyword (lowercased) or undefined.
 */
function findKeyword(text: string, keywords: readonly string[]): string | undefined {
  const normalised = normalise(text);
  for (const kw of keywords) {
    if (contains(normalised, kw)) {
      return kw;
    }
  }
  return undefined;
}

/**
 * Count how many keywords from a set appear in the normalised message.
 */
function countKeywordHits(text: string, keywords: readonly string[]): number {
  const normalised = normalise(text);
  let count = 0;
  for (const kw of keywords) {
    if (contains(normalised, kw)) count++;
  }
  return count;
}

/** Heuristic: does the message look like a question? */
function isQuestionLike(text: string): boolean {
  const t = text.trim();
  if (t.endsWith("?")) return true;
  if (t.startsWith("what") || t.startsWith("how") || t.startsWith("why") || t.startsWith("when") || t.startsWith("where") || t.startsWith("who") || t.startsWith("which") || t.startsWith("can") || t.startsWith("is") || t.startsWith("are") || t.startsWith("do") || t.startsWith("does")) {
    return true;
  }
  return false;
}

/** Heuristic: does the message look like it contains data/information (not just a command)? */
function appearsDataful(text: string): boolean {
  // Very short messages are rarely dataful answers
  if (text.trim().length < 3) return false;
  // Contains numbers (potential monetary values, quantities)
  if (/\d/.test(text)) return true;
  // Reasonably long — likely a sentence with information
  if (text.trim().split(/\s+/).length >= 4) return true;
  return false;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Check if a message appears to be a greeting or pleasantries.
 */
export function isGreeting(message: string): boolean {
  const normalised = normalise(message);
  // If the message is purely a greeting keyword (possibly with "sir"/"ji"), it's a greeting
  for (const kw of GREETING_KEYWORDS) {
    if (normalised === kw || normalised === `${kw} sir` || normalised === `${kw} ji`) {
      return true;
    }
  }
  // If the entire message (minus honorifics) is a greeting
  const stripped = normalised
    .replace(/\bsir\b/g, "")
    .replace(/\bji\b/g, "")
    .replace(/\bplease\b/g, "")
    .trim();
  for (const kw of GREETING_KEYWORDS) {
    if (stripped === kw) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a message is asking to go back to a specific phase.
 * Returns the target InterviewPhase or null.
 */
export function extractTargetPhase(message: string): InterviewPhase | null {
  const normalisedMsg = normalise(message);

  for (const [phase, keywords] of Object.entries(PHASE_KEYWORDS)) {
    for (const kw of keywords) {
      // Match patterns like "go back to [phase]", "change my [field]", "[phase] wapas"
      if (
        contains(normalisedMsg, kw) &&
        (contains(normalisedMsg, "go back") ||
          contains(normalisedMsg, "previous") ||
          contains(normalisedMsg, "earlier") ||
          contains(normalisedMsg, "change my") ||
          contains(normalisedMsg, "wapas") ||
          contains(normalisedMsg, "pichle"))
      ) {
        return phase as InterviewPhase;
      }
    }
  }

  // Direct phase name mentions with back-navigation intent
  for (const [phase, keywords] of Object.entries(PHASE_KEYWORDS)) {
    for (const kw of keywords) {
      if (
        contains(normalisedMsg, `back to ${kw}`) ||
        contains(normalisedMsg, `previous ${kw}`) ||
        contains(normalisedMsg, `change ${kw}`)
      ) {
        return phase as InterviewPhase;
      }
    }
  }

  return null;
}

/**
 * Extract which fields the user wants to correct.
 */
export function extractCorrectionFields(message: string): string[] {
  const normalisedMsg = normalise(message);
  const found: string[] = [];

  // Sort known fields by length descending so longer matches take priority
  const sorted = [...KNOWN_FIELDS].sort((a, b) => b.length - a.length);

  for (const field of sorted) {
    if (contains(normalisedMsg, field)) {
      found.push(field);
    }
  }

  return found;
}

// ── Intent Classification ────────────────────────────────────────────────

/**
 * Parse a user's free-text message into a structured intent classification.
 *
 * This is a LOCAL, deterministic parser. It uses keyword matching and simple
 * heuristics — no AI calls. The orchestrator may optionally send ambiguous
 * cases (low confidence) to an AI for re-classification.
 *
 * @param message - The user's raw message text.
 * @param currentPhase - The interview phase the conversation is currently in.
 * @param conversationHistory - Recent messages for limited context (e.g. last assistant question).
 */
export function parseUserIntent(
  message: string,
  _currentPhase: InterviewPhase,
  conversationHistory: { content: string; role: string }[]
): ParsedUserIntent {
  const rawText = message;
  const trimmed = rawText.trim();

  // Empty or whitespace-only → default to ANSWER (will be handled upstream)
  if (trimmed.length === 0) {
    return { type: "ANSWER", rawText, confidence: 0.3 };
  }

  // ── 1. Greeting ──────────────────────────────────────────────────────
  if (isGreeting(trimmed)) {
    return { type: "GREETING", rawText, confidence: 0.95 };
  }

  // ── 2. Help ─────────────────────────────────────────────────────────
  const helpKw = findKeyword(trimmed, HELP_KEYWORDS);
  if (helpKw) {
    return {
      type: "HELP",
      subject: helpKw,
      rawText,
      confidence: 0.85,
    };
  }

  // ── 3. Review Request ───────────────────────────────────────────────
  const reviewKw = findKeyword(trimmed, REVIEW_KEYWORDS);
  if (reviewKw) {
    return {
      type: "REVIEW_REQUEST",
      subject: reviewKw,
      rawText,
      confidence: 0.9,
    };
  }

  // ── 4. Go Back ──────────────────────────────────────────────────────
  const goBackKw = findKeyword(trimmed, GO_BACK_KEYWORDS);
  if (goBackKw) {
    const targetPhase = extractTargetPhase(trimmed);
    return {
      type: "GO_BACK",
      targetPhase: targetPhase ?? undefined,
      rawText,
      confidence: targetPhase ? 0.85 : 0.75,
    };
  }

  // ── 5. Correction ───────────────────────────────────────────────────
  const correctionKw = findKeyword(trimmed, CORRECTION_KEYWORDS);
  if (correctionKw) {
    const correctionFields = extractCorrectionFields(trimmed);
    return {
      type: "CORRECTION",
      correctionFields: correctionFields.length > 0 ? correctionFields : undefined,
      subject: correctionKw,
      rawText,
      confidence: 0.85,
    };
  }

  // ── 6. Confirm ─────────────────────────────────────────────────────
  // Confirm must be checked carefully — "correct" can also mean CORRECTION intent.
  // We only match confirm if NO correction signals are present and the message
  // is short / simple affirmation.
  const normalised = normalise(trimmed);
  const hasConfirmKw = CONFIRM_KEYWORDS.some((kw) => contains(normalised, kw));
  const hasCorrectionSignal = CORRECTION_KEYWORDS.some((kw) => contains(normalised, kw));

  if (hasConfirmKw && !hasCorrectionSignal) {
    // High confidence if the message is short and is a simple affirmation
    const wordCount = trimmed.split(/\s+/).length;
    const isSimpleAffirmation = wordCount <= 5;

    // But "correct" alone is ambiguous — could be confirming or correcting.
    // Disambiguate: "that is correct" / "yes correct" → CONFIRM; "correct it" / "correct the name" → CORRECTION
    if (contains(normalised, "correct it") || contains(normalised, "correct the") || contains(normalised, "please correct")) {
      // This is actually a correction intent — fall through (already handled above via CORRECTION_KEYWORDS)
    } else if (isSimpleAffirmation) {
      return { type: "CONFIRM", rawText, confidence: 0.9 };
    } else if (wordCount <= 10) {
      return { type: "CONFIRM", rawText, confidence: 0.7 };
    }
    // Longer messages with confirm keywords but no simple affirmation pattern →
    // might be "yes, my name is Rahul" — treat as ANSWER with note
  }

  // ── 7. Skip ─────────────────────────────────────────────────────────
  const skipKw = findKeyword(trimmed, SKIP_KEYWORDS);
  if (skipKw) {
    // But "I don't know, my friend said it's around 5 lakhs" — part answer, part skip.
    // If the message is long and contains numbers, it might be an answer with a skip prefix.
    if (appearsDataful(trimmed) && trimmed.split(/\s+/).length > 6) {
      // Ambiguous: could be "I don't know exactly but maybe 50000"
      return { type: "ANSWER", rawText, confidence: 0.5, subject: "uncertain_answer" };
    }
    return {
      type: "SKIP",
      subject: skipKw,
      rawText,
      confidence: 0.85,
    };
  }

  // ── 8. Clarification ───────────────────────────────────────────────
  const clarificationKw = findKeyword(trimmed, CLARIFICATION_SIGNALS);
  const isQuestion = isQuestionLike(trimmed);
  if (clarificationKw || isQuestion) {
    // Questions can be CLARIFICATION or OUT_OF_SCOPE depending on topic
    const outOfScopeKw = findKeyword(trimmed, OUT_OF_SCOPE_KEYWORDS);
    if (outOfScopeKw) {
      return {
        type: "OUT_OF_SCOPE",
        subject: outOfScopeKw,
        rawText,
        confidence: 0.75,
      };
    }
    return {
      type: "CLARIFICATION",
      subject: clarificationKw,
      rawText,
      confidence: clarificationKw ? 0.8 : 0.6,
    };
  }

  // ── 9. Out of Scope ────────────────────────────────────────────────
  const outOfScopeKw = findKeyword(trimmed, OUT_OF_SCOPE_KEYWORDS);
  if (outOfScopeKw) {
    return {
      type: "OUT_OF_SCOPE",
      subject: outOfScopeKw,
      rawText,
      confidence: 0.7,
    };
  }

  // ── 10. Default: ANSWER ────────────────────────────────────────────
  // If nothing else matched, assume the user is providing information.
  // Use context from conversation history to boost confidence.
  const lastAssistantMsg = [...conversationHistory]
    .reverse()
    .find((m) => m.role === "ASSISTANT");
  const hasPendingQuestion = lastAssistantMsg !== undefined && isQuestionLike(lastAssistantMsg.content);

  // If there was a pending question and the user gave a substantive response, high confidence
  if (hasPendingQuestion && appearsDataful(trimmed)) {
    return { type: "ANSWER", rawText, confidence: 0.85 };
  }

  // Short responses without clear signals — moderate confidence
  if (trimmed.split(/\s+/).length <= 2) {
    return { type: "ANSWER", rawText, confidence: 0.5 };
  }

  // Longer responses default to answer with reasonable confidence
  return { type: "ANSWER", rawText, confidence: 0.7 };
}