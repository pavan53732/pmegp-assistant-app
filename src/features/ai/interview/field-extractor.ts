// ─── Field Extractor ──────────────────────────────────────────────────────
// Extracts structured ProjectProfile field values from user's free-text.
// Pure functions — no I/O, no AI calls (the orchestrator does the AI call).
//
// Handles both local pattern matching (for simple, unambiguous values)
// and provides prompt/response utilities for AI-assisted extraction.
// ───────────────────────────────────────────────────────────────────────────

import type { FieldExtraction } from "./types";

// ── Constants ──────────────────────────────────────────────────────────────

/** Hindi and English number word → digit mappings. */
const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  ek: 1, one: 1,
  do: 2, two: 2,
  teen: 3, three: 3,
  char: 4, four: 4,
  paanch: 5, panch: 5, five: 5,
  cheh: 6, six: 6,
  saat: 7, seven: 7,
  aath: 8, eight: 8,
  nau: 9, nine: 9,
  das: 10, ten: 10,
  egara: 11, eleven: 11,
  barah: 12, twelve: 12,
  terah: 13, thirteen: 13,
  chaudah: 14, fourteen: 14,
  pandrah: 15, fifteen: 15,
  solah: 16, sixteen: 16,
  satrah: 17, seventeen: 17,
  atharah: 18, eighteen: 18,
  unnees: 19, nineteen: 19,
  bees: 20, twenty: 20,
  ikkis: 21,
  bayees: 22,
  tees: 30, thirty: 30,
  chaalis: 40, forty: 40,
  pachas: 50, fifty: 50,
  sath: 60, sixty: 60,
  sattar: 70, seventy: 70,
  assi: 80, eighty: 80,
  nabbe: 90, ninety: 90,
  sau: 100, hundred: 100,
};

/** Known enum options keyed by field dot-path. */
const FIELD_ENUM_OPTIONS: Record<string, readonly string[]> = {
  "applicant.gender": ["MALE", "FEMALE", "OTHER"],
  "applicant.category": [
    "GEN", "SC", "ST", "OBC", "MINORITY", "EX_SERVICEMEN", "PH", "NER",
  ],
  "applicant.education": [
    "NONE", "BELOW_8TH", "8TH_PASS", "10TH_PASS", "12TH_PASS",
    "GRADUATE", "POST_GRADUATE", "PROFESSIONAL", "OTHER",
  ],
  "applicant.entityType": [
    "INDIVIDUAL", "SHG", "TRUST", "SOCIETY", "COOP",
    "PARTNERSHIP", "LLP", "PRIVATE_LIMITED",
  ],
  "business.activityType": ["MANUFACTURING", "SERVICE"],
  "business.sector": ["MANUFACTURING", "SERVICE"],
  "business.subCategory": ["MANUFACTURING", "SERVICE", "TRADING", "TRANSPORT"],
  "location.area": ["URBAN", "RURAL"],
  "location.industrialAreaType": [
    "INDUSTRIAL_ESTATE", "SEZ", "CLUSTER", "DAC", "OTHER",
  ],
  "land.status": ["OWN", "RENTED", "LEASED", "NONE", "FAMILY"],
  "land.buildingType": ["OWN", "RENTED", "CONSTRUCT"],
};

/**
 * Alias map: normalised user input → canonical enum value.
 * Only used when the mapped value is present in the options array.
 */
const ENUM_ALIASES: Record<string, string> = {
  // ── Gender ──
  male: "MALE",
  m: "MALE",
  female: "FEMALE",
  f: "FEMALE",
  transgender: "OTHER",
  trans: "OTHER",

  // ── Category ──
  general: "GEN",
  open: "GEN",
  unreserved: "GEN",
  "ex-servicemen": "EX_SERVICEMEN",
  "ex servicemen": "EX_SERVICEMEN",
  "ex-serviceman": "EX_SERVICEMEN",
  "ex serviceman": "EX_SERVICEMEN",
  exservice: "EX_SERVICEMEN",
  "physically handicapped": "PH",
  handicapped: "PH",
  disabled: "PH",
  "differently abled": "PH",
  "differently-abled": "PH",
  pwd: "PH",
  "north eastern": "NER",
  northeast: "NER",
  "north-eastern": "NER",
  "north east": "NER",

  // ── Education ──
  illiterate: "NONE",
  "no education": "NONE",
  uneducated: "NONE",
  "below 8th": "BELOW_8TH",
  "less than 8th": "BELOW_8TH",
  "8th pass": "8TH_PASS",
  eighth: "8TH_PASS",
  "10th pass": "10TH_PASS",
  tenth: "10TH_PASS",
  matric: "10TH_PASS",
  matriculation: "10TH_PASS",
  ssc: "10TH_PASS",
  "12th pass": "12TH_PASS",
  twelfth: "12TH_PASS",
  intermediate: "12TH_PASS",
  hsc: "12TH_PASS",
  puc: "12TH_PASS",
  graduate: "GRADUATE",
  graduation: "GRADUATE",
  bachelor: "GRADUATE",
  ba: "GRADUATE",
  bsc: "GRADUATE",
  bcom: "GRADUATE",
  "b tech": "GRADUATE",
  btech: "GRADUATE",
  be: "GRADUATE",
  "post graduate": "POST_GRADUATE",
  "post-graduate": "POST_GRADUATE",
  postgraduate: "POST_GRADUATE",
  pg: "POST_GRADUATE",
  masters: "POST_GRADUATE",
  ma: "POST_GRADUATE",
  msc: "POST_GRADUATE",
  mcom: "POST_GRADUATE",
  "m tech": "POST_GRADUATE",
  mtech: "POST_GRADUATE",
  me: "POST_GRADUATE",
  mba: "POST_GRADUATE",
  professional: "PROFESSIONAL",
  engineering: "PROFESSIONAL",
  medical: "PROFESSIONAL",
  law: "PROFESSIONAL",
  ca: "PROFESSIONAL",
  "chartered accountant": "PROFESSIONAL",
  doctor: "PROFESSIONAL",

  // ── Entity Type ──
  individual: "INDIVIDUAL",
  proprietor: "INDIVIDUAL",
  sole: "INDIVIDUAL",
  "self help group": "SHG",
  "self-help group": "SHG",
  cooperative: "COOP",
  "co-op": "COOP",
  "cooperative society": "COOP",
  "pvt ltd": "PRIVATE_LIMITED",
  "pvt. ltd.": "PRIVATE_LIMITED",
  "pvt limited": "PRIVATE_LIMITED",
  "private limited": "PRIVATE_LIMITED",
  "private ltd": "PRIVATE_LIMITED",
  "pvt. limited": "PRIVATE_LIMITED",

  // ── Urban / Rural ──
  urban: "URBAN",
  city: "URBAN",
  town: "URBAN",
  municipal: "URBAN",
  rural: "RURAL",
  village: "RURAL",
  panchayat: "RURAL",
  gram: "RURAL",

  // ── Land Status ──
  owned: "OWN",
  "self owned": "OWN",
  "my own": "OWN",
  "on rent": "RENTED",
  "taking on rent": "RENTED",
  "no land": "NONE",
  "don't have land": "NONE",
  "no land available": "NONE",
  "family land": "FAMILY",
  ancestral: "FAMILY",
  "father's": "FAMILY",
  "to be constructed": "CONSTRUCT",
  "new construction": "CONSTRUCT",

  // ── Activity / Sector / SubCategory ──
  manufacturing: "MANUFACTURING",
  production: "MANUFACTURING",
  factory: "MANUFACTURING",
  service: "SERVICE",
  services: "SERVICE",
  trading: "TRADING",
  trade: "TRADING",
  shop: "TRADING",
  retail: "TRADING",
  transport: "TRANSPORT",
  transportation: "TRANSPORT",
  logistics: "TRANSPORT",

  // ── Industrial Area Type ──
  "industrial estate": "INDUSTRIAL_ESTATE",
  "industrial area": "INDUSTRIAL_ESTATE",
  "special economic zone": "SEZ",
  sez: "SEZ",
  cluster: "CLUSTER",
  "industrial cluster": "CLUSTER",
  "district agro industrial": "DAC",
  "district agro": "DAC",
};

// ── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Convert a dot-path like "applicant.entityType" to a human-readable label.
 */
function fieldPathToLabel(fieldPath: string): string {
  const lastSegment = fieldPath.split(".").pop()!;
  return lastSegment
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Replace Hindi / English number words with digit characters.
 * Longer words are matched first to avoid partial replacements.
 */
function replaceNumberWords(text: string): string {
  let result = text;
  const entries = Object.entries(NUMBER_WORDS).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [word, num] of entries) {
    result = result.replace(new RegExp(`\\b${word}\\b`, "gi"), String(num));
  }
  return result;
}

// ── 3. Enum Matcher ────────────────────────────────────────────────────────

/**
 * Match user text against known enum values.
 * Case-insensitive, handles partial matches.
 *
 * Matching priority:
 * 1. Alias map lookup (exact normalised text)
 * 2. Case-insensitive exact match against option string
 * 3. Case-insensitive match with underscore → space normalisation
 * 4. Normalised text is a substring of an option (input ≥ 3 chars)
 * 5. Option is a substring of normalised text (option ≥ 3 chars)
 * 6. All significant words (≥ 3 chars) of the input appear in an option
 */
export function matchEnumValue(
  text: string,
  options: readonly string[],
): string | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;

  // 1. Alias map — only accept if the aliased value is in the options
  if (normalized in ENUM_ALIASES) {
    const aliased = ENUM_ALIASES[normalized];
    if (options.includes(aliased)) {
      return aliased;
    }
  }

  // 2. Exact case-insensitive match
  for (const opt of options) {
    if (opt.toLowerCase() === normalized) {
      return opt;
    }
  }

  // 3. Match with underscore → space normalisation
  for (const opt of options) {
    const optNorm = opt.toLowerCase().replace(/_/g, " ");
    if (optNorm === normalized) {
      return opt;
    }
  }

  // 4. Normalised text is contained in an option label
  if (normalized.length >= 3) {
    for (const opt of options) {
      const optNorm = opt.toLowerCase().replace(/_/g, " ");
      if (optNorm.includes(normalized)) {
        return opt;
      }
    }
  }

  // 5. Short option is contained in the normalised text
  for (const opt of options) {
    const optNorm = opt.toLowerCase().replace(/_/g, " ");
    if (optNorm.length >= 3 && normalized.includes(optNorm)) {
      return opt;
    }
  }

  // 6. All significant words appear in an option
  const significantWords = normalized.split(/\s+/).filter((w) => w.length >= 3);
  if (significantWords.length >= 2) {
    for (const opt of options) {
      const optNorm = opt.toLowerCase().replace(/_/g, " ");
      if (significantWords.every((w) => optNorm.includes(w))) {
        return opt;
      }
    }
  }

  return null;
}

// ── 2. Currency Parser ─────────────────────────────────────────────────────

/**
 * Parse Indian currency notation from free text.
 * Handles: "5 lakh", "500000", "₹25,00,000", "25 lakhs", "2.5 crore"
 * Also handles Hindi-English mix: "paanch lakh", "do crore".
 * Returns integer rupees, or null if nothing parseable.
 */
export function parseIndianCurrency(text: string): number | null {
  // Step 1 — replace Hindi / English number words with digits
  let processed = replaceNumberWords(text);

  // Step 2 — strip currency symbols and prefixes
  processed = processed.replace(/[₹]/g, " ");
  processed = processed.replace(/\b(?:rs\.?|rupees?|inr)\b/gi, " ");

  // Step 3 — crore pattern (highest magnitude first)
  const croreMatch = processed.match(
    /(\d+(?:\.\d+)?)\s*(?:crore|crores|karod|karo?r)/i,
  );
  if (croreMatch) {
    const num = parseFloat(croreMatch[1]);
    if (!isNaN(num) && num >= 0) {
      return Math.round(num * 1_00_00_000);
    }
  }

  // Step 4 — lakh pattern
  const lakhMatch = processed.match(
    /(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)/i,
  );
  if (lakhMatch) {
    const num = parseFloat(lakhMatch[1]);
    if (!isNaN(num) && num >= 0) {
      return Math.round(num * 1_00_000);
    }
  }

  // Step 5 — plain number (Indian comma format: 1,23,45,678)
  const plainMatch = processed.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (plainMatch) {
    const numStr = plainMatch[1].replace(/,/g, "");
    const num = parseFloat(numStr);
    if (!isNaN(num) && num >= 0) {
      return Math.round(num);
    }
  }

  return null;
}

// ── 4. Age Extractor ───────────────────────────────────────────────────────

/**
 * Extract age from text like "I am 35", "my age is 28 years", "35 years old".
 * Returns the age clamped to 0–100, or null if no age pattern is found.
 */
export function extractAge(text: string): number | null {
  const processed = replaceNumberWords(text);

  const patterns: RegExp[] = [
    /(?:i\s+am|my\s+age\s+(?:is)?|age\s*(?:is)?|aged?)\s+(\d{1,3})/i,
    /(\d{1,3})\s*(?:years?\s*old|yrs?\s*old)/i,
    /(\d{1,3})\s*(?:years?|yrs?)\s*(?:of\s+age)?/i,
  ];

  for (const pattern of patterns) {
    const match = processed.match(pattern);
    if (match) {
      const age = parseInt(match[1], 10);
      if (!isNaN(age) && age >= 0 && age <= 100) {
        return age;
      }
    }
  }

  return null;
}

// ── 1. Local Extraction ────────────────────────────────────────────────────

/**
 * Try to extract a field value locally using pattern matching.
 * Returns null if the value is ambiguous and needs AI extraction.
 *
 * - TEXT: always returns null (needs AI for contextual understanding).
 * - ENUM: matches against known enum values via alias map + fuzzy matching.
 * - BOOLEAN: matches yes/no/done/not yet / Hindi haan/nahi.
 * - NUMBER: for `applicant.age` uses dedicated extractor; otherwise extracts
 *   a single unambiguous number from the text.
 * - CURRENCY: parses Indian currency notation (lakh, crore, ₹).
 * - DATE: always returns null (needs AI for contextual understanding).
 */
export function extractFieldLocally(
  fieldPath: string,
  message: string,
  fieldType: "TEXT" | "NUMBER" | "ENUM" | "BOOLEAN" | "CURRENCY" | "DATE",
): FieldExtraction | null {
  const label = fieldPathToLabel(fieldPath);

  switch (fieldType) {
    // ── TEXT — always deferred to AI ──
    case "TEXT":
      return null;

    // ── ENUM ──
    case "ENUM": {
      const options = FIELD_ENUM_OPTIONS[fieldPath];
      if (!options) return null;
      const value = matchEnumValue(message, options);
      if (value === null) return null;
      return {
        fieldPath,
        value,
        confidence: 1.0,
        source: "USER",
        label,
        reasoning: `Local enum match: "${message.trim()}" → "${value}"`,
      };
    }

    // ── BOOLEAN ──
    case "BOOLEAN": {
      const lower = message.toLowerCase().trim();

      const truePatterns = [
        /\byes\b/i,
        /\btrue\b/i,
        /\bdone\b/i,
        /\bcompleted\b/i,
        /\bha(?:n|a)\b/i, // Hindi "haan"
      ];
      const falsePatterns = [
        /\bno\b/i,
        /\bfalse\b/i,
        /\bnot\s+yet\b/i,
        /\bnot\s+done\b/i,
        /\bnot\s+completed\b/i,
        /\bnever\b/i,
        /\bnahi\b/i, // Hindi "nahi"
      ];

      const hasTrue = truePatterns.some((p) => p.test(lower));
      const hasFalse = falsePatterns.some((p) => p.test(lower));

      if (hasTrue && !hasFalse) {
        return {
          fieldPath,
          value: true,
          confidence: 1.0,
          source: "USER",
          label,
          reasoning: `Local boolean match: "${message.trim()}" → true`,
        };
      }
      if (hasFalse && !hasTrue) {
        return {
          fieldPath,
          value: false,
          confidence: 1.0,
          source: "USER",
          label,
          reasoning: `Local boolean match: "${message.trim()}" → false`,
        };
      }
      return null; // Ambiguous — both or neither signal present
    }

    // ── NUMBER ──
    case "NUMBER": {
      // Use dedicated age extractor for the applicant.age field
      if (fieldPath === "applicant.age") {
        const age = extractAge(message);
        if (age === null) return null;
        return {
          fieldPath,
          value: age,
          confidence: 1.0,
          source: "USER",
          label,
          reasoning: `Local number match: "${message.trim()}" → ${age}`,
        };
      }

      // Generic: extract a single unambiguous number
      const numbers = message.match(/\d+/g);
      if (numbers && numbers.length === 1) {
        const num = parseInt(numbers[0], 10);
        if (!isNaN(num) && num >= 0) {
          return {
            fieldPath,
            value: num,
            confidence: 1.0,
            source: "USER",
            label,
            reasoning: `Local number match: "${message.trim()}" → ${num}`,
          };
        }
      }
      return null; // Multiple numbers or none — ambiguous
    }

    // ── CURRENCY ──
    case "CURRENCY": {
      const amount = parseIndianCurrency(message);
      if (amount === null) return null;
      return {
        fieldPath,
        value: amount,
        confidence: 1.0,
        source: "USER",
        label,
        reasoning: `Local currency match: "${message.trim()}" → ₹${amount.toLocaleString("en-IN")}`,
      };
    }

    // ── DATE — always deferred to AI ──
    case "DATE":
      return null;
  }
}

// ── 5. AI Extraction Prompt Builder ───────────────────────────────────────

/**
 * Build a prompt for AI-assisted field extraction.
 * The orchestrator will send this to the AI provider.
 * Returns the user prompt (system prompt is handled by orchestrator).
 */
export function buildExtractionPrompt(
  message: string,
  targetFields: Array<{
    dotPath: string;
    label: string;
    type: string;
    enumOptions?: string[];
  }>,
  phaseContext: string,
): string {
  const fieldDescriptions = targetFields
    .map((f) => {
      let desc = `- "${f.dotPath}" (${f.label}, type: ${f.type})`;
      if (f.enumOptions && f.enumOptions.length > 0) {
        desc += ` — allowed values: [${f.enumOptions.join(", ")}]`;
      }
      return desc;
    })
    .join("\n");

  return [
    `Current interview phase context: ${phaseContext}`,
    "",
    "The user said:",
    `"${message}"`,
    "",
    "Extract values for the following fields from the user's message:",
    fieldDescriptions,
    "",
    "Rules:",
    "- Return a JSON object with field dot-paths as keys and extracted values as values.",
    '- For ENUM fields, use the exact enum value (e.g., "MALE", not "male").',
    "- For CURRENCY fields, return the value as an integer (whole rupees).",
    "- For BOOLEAN fields, return true or false (JSON booleans).",
    "- For NUMBER fields, return a number.",
    '- For DATE fields, return an ISO date string (YYYY-MM-DD).',
    '- For TEXT fields, return the extracted text string.',
    "- If a field's value cannot be determined from the message, omit it from the JSON.",
    "- Return ONLY the JSON object, no other text.",
    "- Do not invent or guess values that are not clearly stated or strongly implied.",
  ].join("\n");
}

// ── 6. AI Response Parser ─────────────────────────────────────────────────

/**
 * Parse the AI's extraction response into FieldExtraction objects.
 * The AI is expected to return JSON: { "fieldPath": "value", ... }
 *
 * Confidence is set to 0.0 as a placeholder — the orchestrator assigns
 * the actual confidence based on AI provider metadata.
 */
export function parseAIExtractionResponse(
  aiResponse: string,
  expectedFields: string[],
): FieldExtraction[] {
  const results: FieldExtraction[] = [];

  let jsonStr = aiResponse.trim();

  // Strip markdown code fences if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Locate the JSON object in the text
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return results;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    for (const [fieldPath, value] of Object.entries(parsed)) {
      // Only include fields that were expected
      if (!expectedFields.includes(fieldPath)) continue;

      // Skip null / undefined
      if (value === null || value === undefined) continue;

      const label = fieldPathToLabel(fieldPath);

      results.push({
        fieldPath,
        value,
        confidence: 0.0, // placeholder — orchestrator sets real confidence
        source: "AI",
        label,
      });
    }
  } catch {
    // JSON parse failure — return empty; orchestrator handles the error path.
  }

  return results;
}

// ── 7. Batch Extractor ─────────────────────────────────────────────────────

/**
 * Try to extract multiple fields from a single message.
 * First attempts local extraction for each field.
 * Returns successfully extracted fields and the list that need AI.
 *
 * @param message  The user's free-text message.
 * @param targetFields  Fields to try extracting, with type and optional enum options.
 * @param source  Provenance source tag (defaults to "USER").
 */
export function extractFieldsFromMessage(
  message: string,
  targetFields: Array<{
    dotPath: string;
    label: string;
    type: "TEXT" | "NUMBER" | "ENUM" | "BOOLEAN" | "CURRENCY" | "DATE";
    enumOptions?: string[];
  }>,
  source: "USER" | "AI" = "USER",
): {
  extracted: FieldExtraction[];
  needsAI: string[]; // dot-paths that need AI extraction
} {
  const extracted: FieldExtraction[] = [];
  const needsAI: string[] = [];

  for (const field of targetFields) {
    const result = extractFieldLocally(field.dotPath, message, field.type);

    if (result !== null) {
      // Respect caller-specified source
      result.source = source;
      // Prefer the richer label from the caller when available
      if (field.label) {
        result.label = field.label;
      }
      extracted.push(result);
    } else {
      needsAI.push(field.dotPath);
    }
  }

  return { extracted, needsAI };
}