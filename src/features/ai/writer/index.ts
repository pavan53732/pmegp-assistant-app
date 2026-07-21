// ─── AI Writer Engine ───────────────────────────────────────────────────────
// Generates DPR narrative prose from the deterministic financial + eligibility
// engines. The AI is the writer — NEVER the calculator.
//
// RULE #5: AI is the writer, NEVER the calculator. Every figure the AI quotes
// MUST originate from the deterministic engines — never invented.
//
// The number-injection guard verifies the AI's output against a token map of
// computed figures. Any number that doesn't match a token value triggers a
// regenerate-and-retry cycle (max 3 retries per section) before throwing.
//
// Boundary: imports only from @/engines/*, @/providers, @/shared/*.
// Never imports @/database/*.
// ─────────────────────────────────────────────────────────────────────────────

import type { FinancialResult } from "@/engines/financial-engine";
import type { EligibilityResult } from "@/engines/eligibility-engine";
import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProviderConnectionConfig, ProviderMessage } from "@/providers";
import { getAIResponse } from "@/providers";

// ── Public types ───────────────────────────────────────────────────────────

export interface WriterInput {
  financials: FinancialResult;
  eligibility: EligibilityResult;
  profile: ProjectProfile;
  templateId: string;
}

export interface WriterOutput {
  /** sectionId -> narrative prose (tokens already substituted with values). */
  sections: Record<string, string>;
  /** sectionId -> provenance tag, e.g. "AI:template:pmegp-manufacturing-v1". */
  provenance: Record<string, string>;
}

export interface VerificationResult {
  ok: boolean;
  /** Raw matched substrings from the prose that failed the guard. */
  mismatches: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

/** The full ordered list of DPR sections the writer must produce. */
export const SECTION_IDS = [
  "executive_summary",
  "project_concept",
  "market_analysis",
  "technical_feasibility",
  "financial_viability",
  "implementation_schedule",
  "risk_mitigation",
] as const;

/** Maximum number of regeneration attempts per failing section. */
const MAX_RETRIES = 3;

// ── Indian Rupee formatting (integer math) ─────────────────────────────────

/**
 * Format a whole-rupee number using Indian comma grouping with a "Rs. " prefix.
 *
 *   formatINR(1234567)  → "Rs. 12,34,567"
 *   formatINR(50000)    → "Rs. 50,000"
 *   formatINR(999)      → "Rs. 999"
 *   formatINR(-500000)  → "-Rs. 5,00,000"
 *
 * Implementation uses only integer math: the input is rounded to the nearest
 * whole rupee, then the digit string is grouped right-to-left (3, then 2s).
 */
export function formatINR(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n)).toString();
  if (abs.length <= 3) {
    return `${sign}Rs. ${abs}`;
  }
  const lastThree = abs.slice(-3);
  const rest = abs.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  return `${sign}Rs. ${grouped}`;
}

// ── Token map ──────────────────────────────────────────────────────────────

/**
 * Build the map of placeholder tokens → formatted values from the computed
 * financials and eligibility result. These are the ONLY numerical values the
 * AI is permitted to use in its prose.
 *
 * Token values are pre-formatted so the prose can carry them through verbatim.
 */
export function buildTokenMap(
  financials: FinancialResult,
  eligibility: EligibilityResult,
): Record<string, string> {
  return {
    "{{TOTAL_PROJECT_COST}}": formatINR(financials.totalProjectCost),
    "{{SUBSIDY_AMOUNT}}": formatINR(financials.subsidyAmount),
    "{{EMI}}": formatINR(financials.emi),
    // DSCR is a ratio — render to 2 decimal places (e.g. "1.45").
    "{{DSCR}}": financials.dscr.toFixed(2),
    // Break-even is a percentage — render to 2 decimals with "%" suffix.
    "{{BREAK_EVEN}}": `${financials.breakEvenPercent.toFixed(2)}%`,
    "{{OWN_CONTRIBUTION}}": formatINR(financials.ownContribution),
    "{{BANK_TERM_LOAN}}": formatINR(financials.bankTermLoan),
    "{{ANNUAL_REVENUE}}": formatINR(financials.annualRevenue),
    "{{ANNUAL_NET_PROFIT}}": formatINR(financials.annualNetProfit),
    // Tenure is a plain integer month count (e.g. "60") — no commas needed.
    "{{LOAN_TENURE_MONTHS}}": `${financials.loanTenureMonths}`,
    "{{TOTAL_INTEREST}}": formatINR(financials.totalInterest),
    "{{TOTAL_REPAYMENT}}": formatINR(financials.totalRepayment),
    "{{ELIGIBLE}}": eligibility.eligible ? "eligible" : "not eligible",
  };
}

// ── Number-injection guard ─────────────────────────────────────────────────

/** Strip everything except digits and the decimal point. */
function normalizeDigits(s: string): string {
  return s.replace(/[^\d.]/g, "");
}

/**
 * Generate the set of acceptable digit-string representations for a single
 * token value.
 *
 *   "65.30" → {"65.30", "65.3"}
 *   "65.00" → {"65.00", "65.0", "65"}
 *   "1.45"  → {"1.45"}
 *   "60"    → {"60"}
 *   "1234567" (from "Rs. 12,34,567") → {"1234567"}
 */
function digitForms(value: string): string[] {
  const forms = new Set<string>();
  const digits = normalizeDigits(value);
  if (digits === "" || digits === ".") return [];
  forms.add(digits);
  if (digits.includes(".")) {
    // Strip trailing zeros after the decimal point: "65.30" → "65.3"; "65.00" → "65".
    const stripped = digits.replace(/0+$/, "").replace(/\.$/, "");
    if (stripped !== "" && stripped !== digits) forms.add(stripped);
    // When the value is mathematically an integer (e.g. "65.00"), also accept "65".
    const parsed = parseFloat(digits);
    if (!isNaN(parsed) && Number.isInteger(parsed)) {
      forms.add(`${parsed}`);
    }
  }
  return Array.from(forms);
}

/** Build the full allowed-set of digit strings from a token map. */
function buildAllowedSet(tokens: Record<string, string>): Set<string> {
  const allowed = new Set<string>();
  for (const value of Object.values(tokens)) {
    for (const form of digitForms(value)) {
      allowed.add(form);
    }
  }
  return allowed;
}

/**
 * Single combined regex that matches every numeric form we care about,
 * ordered so the most-specific match wins at each position:
 *   1. Rupee amounts   — "Rs. 12,34,567", "Rs.1234567", "Rs 12,34,567"
 *   2. Percentages     — "65.30%"
 *   3. Multipliers     — "1.45x"
 *   4. Standalone nos. — "60", "1.45", "12,34,567"
 *
 * A single combined regex (rather than four separate .match() passes) avoids
 * double-counting "65" and "30" inside "65.30%".
 */
const NUMERIC_REGEX_SOURCE =
  "Rs\\.?\\s?[\\d,]+(?:\\.\\d+)?|[\\d.]+%|[\\d.]+x|[\\d][\\d,]*(?:\\.\\d+)?";

/** Extract every number-looking token from a piece of prose (deduped, in order). */
function extractNumbers(prose: string): string[] {
  const re = new RegExp(NUMERIC_REGEX_SOURCE, "g");
  const matches = prose.match(re) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

/**
 * Verify that every number in the prose matches one of the token values.
 *
 * The guard normalises each matched number to its digit string (e.g.
 * "Rs. 12,34,567" → "1234567", "65.30%" → "65.30") and checks membership in
 * the allowed set derived from the token map (with equivalent representations
 * like "65.30" / "65.3" / "65" all accepted when the value is integral).
 *
 * @returns `ok=true` when no mismatches; otherwise `ok=false` and the list of
 *          offending raw substrings (useful for the retry prompt).
 */
export function verifyNumbers(
  prose: string,
  tokens: Record<string, string>,
): VerificationResult {
  const allowed = buildAllowedSet(tokens);
  const mismatches: string[] = [];
  for (const raw of extractNumbers(prose)) {
    const normalized = normalizeDigits(raw);
    if (normalized === "" || normalized === ".") continue;
    if (!allowed.has(normalized)) {
      mismatches.push(raw);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

// ── Section parsing ────────────────────────────────────────────────────────

/**
 * Parse a multi-section AI response into a map of sectionId → prose.
 *
 * Recognises delimiters of the form `===SECTION: <id>===`. The preamble before
 * the first delimiter (if any) is discarded.
 */
export function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = content.split(/===SECTION:\s*([\w-]+)\s*===/);
  // parts[0] = preamble; parts[1]=id, parts[2]=prose, parts[3]=id, parts[4]=prose...
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const id = parts[i].trim();
    const prose = (parts[i + 1] ?? "").trim();
    if (id) sections[id] = prose;
  }
  return sections;
}

// ── Prompt builders ────────────────────────────────────────────────────────

function renderTokenTable(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([token, value]) => `${token} = ${value}`)
    .join("\n");
}

function buildSystemPrompt(tokens: Record<string, string>): string {
  return [
    "You are a PMEGP Detailed Project Report (DPR) writer. You produce professional narrative prose for Indian government subsidy project reports.",
    "",
    "CRITICAL RULE — NUMBER INJECTION GUARD:",
    "The table below contains EVERY numerical value you are permitted to use. You must either (a) write the placeholder token exactly as shown (e.g. {{TOTAL_PROJECT_COST}}), or (b) write the corresponding value verbatim (e.g. Rs. 12,34,567).",
    "You MUST NOT invent, calculate, estimate, round, or otherwise introduce ANY number that is not in this table. This applies to ALL digits in your output: ages, years, dates, counts, list numbers, section numbers, page numbers, percentages, ratios, rupee amounts, multipliers — every single digit.",
    "If a number is not in the table, you may refer to it in WORDS only (e.g. \"two paragraphs\", \"several months\", \"a few years\"). Do not use digits to express it.",
    "",
    "ALLOWED NUMERICAL VALUES (use these and ONLY these):",
    renderTokenTable(tokens),
    "",
    "OUTPUT FORMAT:",
    "Write each section delimited exactly as:",
    "===SECTION: <section_id>===",
    "<prose here>",
    "",
    "Then a blank line, then the next ===SECTION: ...=== marker. Write every section in the order requested.",
    "Do not add any heading text inside the prose. Do not number list items — use flowing prose paragraphs or un-numbered bullet phrases instead.",
    "Each section should be 2-3 paragraphs of polished, factual, professional DPR narrative.",
  ].join("\n");
}

function buildUserPrompt(profile: ProjectProfile): string {
  const p = profile;
  const lines: string[] = [
    "PROJECT PROFILE CONTEXT — use this for narrative substance. Do NOT quote any numbers from this profile directly in your prose; every figure must come from the token table above. Where the profile contains numbers (capacity, wages, areas), paraphrase them in WORDS only.",
    `- Business name: ${p.business.name}`,
    `- Business description: ${p.business.description}`,
    `- Activity type: ${p.business.activityType}`,
    `- Sector: ${p.business.sector}`,
    `- NIC code: ${p.business.nicCode ?? "not specified"}`,
    `- NIC description: ${p.business.nicDescription ?? "not specified"}`,
    `- Location: ${[p.location.village, p.location.mandal, p.location.district, p.location.state].filter(Boolean).join(", ")} (${p.location.area})`,
    `- Industrial area: ${p.location.industrialAreaName ?? "not specified"}`,
    `- Installed capacity: ${p.capacity.installedCapacity.value} ${p.capacity.installedCapacity.unit} (PARAPHRASE IN WORDS — do not quote this number)`,
    `- Target market: ${p.market.targetMarket ?? "not specified"}`,
    `- Marketing strategy: ${p.market.marketingStrategy ?? "not specified"}`,
    `- Raw materials: ${(p.rawMaterials.items ?? []).map((i) => i.name).join(", ") || "not specified"}`,
    `- Machinery: ${(p.machinery.items ?? []).map((i) => i.name).join(", ") || "not specified"}`,
    `- Entity type: ${p.applicant.entityType}; prior subsidy availed: ${p.applicant.priorSubsidy ? "yes" : "no"}`,
    "",
    `Write ALL SEVEN DPR sections, in this exact order, each delimited by ===SECTION: <id>===:`,
    ...SECTION_IDS.map((id, i) => `  ${i + 1}. ${id}`),
    "",
    "Section content guidance:",
    "- executive_summary: One-paragraph overview of the project, applicant, location, cost, and viability. Reference token values for cost, subsidy, and viability verdict.",
    "- project_concept: Describe the proposed business, its purpose, and how it serves the target market. Reference the activity type and NIC description (in words).",
    "- market_analysis: Discuss the target market, demand, and competition. Paraphrase market details in words only — do not quote numbers.",
    "- technical_feasibility: Describe the production process, machinery, and capacity. Reference capacity in words only (e.g. \"a substantial monthly output\").",
    "- financial_viability: Discuss the project cost, means of finance, term loan, EMI, profitability, DSCR, and break-even. Use the token values verbatim for every figure.",
    "- implementation_schedule: Outline the timeline for setup, procurement, and commencement in words only — do not invent durations in months.",
    "- risk_mitigation: Identify key project risks and mitigation strategies in words only — do not invent probability percentages.",
    "",
    "Begin now. Remember: every digit in your output MUST come from the token table.",
  ];
  return lines.join("\n");
}

function buildRetrySystemPrompt(tokens: Record<string, string>): string {
  return [
    "You are a PMEGP DPR writer performing a CORRECTED rewrite of a SINGLE section.",
    "",
    "Your previous attempt contained numbers that are NOT in the allowed token table. You must rewrite the section so that EVERY digit comes from the table below — either as the placeholder token or as the exact value.",
    "",
    "ALLOWED NUMERICAL VALUES:",
    renderTokenTable(tokens),
    "",
    "OUTPUT FORMAT:",
    "Output ONLY the prose for the single requested section. Do not include the ===SECTION: ...=== delimiter. Do not include any heading. Do not number list items. No digit may appear in your output unless it matches one of the values above (or is the placeholder token form).",
  ].join("\n");
}

function buildRetryUserPrompt(
  sectionId: string,
  previousProse: string,
  mismatches: string[],
): string {
  return [
    `Rewrite section: ${sectionId}`,
    "",
    "Your previous attempt contained these disallowed numbers:",
    ...mismatches.map((m) => `  - "${m}"`),
    "",
    "Previous attempt (for reference — DO NOT reuse the offending numbers):",
    previousProse || "(section was missing or empty)",
    "",
    "Rewrite the section now. Every digit must come from the allowed token table, either as a placeholder token or as the exact value. Output ONLY the section prose — no delimiters, no headings.",
  ].join("\n");
}

// ── Token replacement ──────────────────────────────────────────────────────

/**
 * Replace every placeholder token in the prose with its formatted value.
 * Uses split/join (not regex) so tokens containing regex metacharacters
 * (e.g. `{{`, `}}`) are treated as literals.
 */
function replaceTokens(prose: string, tokens: Record<string, string>): string {
  let out = prose;
  for (const [token, value] of Object.entries(tokens)) {
    out = out.split(token).join(value);
  }
  return out;
}

// ── Single-section regeneration ────────────────────────────────────────────

async function regenerateSection(
  sectionId: string,
  previousProse: string,
  mismatches: string[],
  tokens: Record<string, string>,
  providerConfig: ProviderConnectionConfig,
): Promise<string> {
  const systemMsg: ProviderMessage = {
    role: "system",
    content: buildRetrySystemPrompt(tokens),
  };
  const userMsg: ProviderMessage = {
    role: "user",
    content: buildRetryUserPrompt(sectionId, previousProse, mismatches),
  };
  const resp = await getAIResponse([systemMsg, userMsg], providerConfig);
  if (!resp.success || !resp.content) {
    throw new Error(
      `AI provider failed during section regeneration for "${sectionId}": ${resp.error ?? "no content"}`,
    );
  }
  // The retry prompt asks for prose only — strip any stray delimiters just in case.
  return resp.content.replace(/===SECTION:[^=]*===/g, "").trim();
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Generate a full DPR narrative by prompting the AI with a token map of
 * computed figures, then verifying the response against the same map.
 *
 * Flow:
 *   1. Build token map from financials + eligibility.
 *   2. One AI call requesting all 7 sections.
 *   3. Parse the response into sections.
 *   4. For each section, run verifyNumbers(). If it fails, regenerate that
 *      section (up to MAX_RETRIES times) with a stricter prompt that names
 *      the offending numbers.
 *   5. If a section still fails after MAX_RETRIES, throw
 *      `Error("Number-injection guard failed for section <id>")`.
 *   6. Replace any residual token placeholders with their values.
 *   7. Stamp provenance = `AI:template:<templateId>` for every section.
 */
export async function generateNarrative(
  input: WriterInput,
  providerConfig: ProviderConnectionConfig,
): Promise<WriterOutput> {
  const tokens = buildTokenMap(input.financials, input.eligibility);

  // ── 1. Initial multi-section generation ──────────────────────────────
  const systemMsg: ProviderMessage = {
    role: "system",
    content: buildSystemPrompt(tokens),
  };
  const userMsg: ProviderMessage = {
    role: "user",
    content: buildUserPrompt(input.profile),
  };

  const initialResp = await getAIResponse([systemMsg, userMsg], providerConfig);
  if (!initialResp.success || !initialResp.content) {
    throw new Error(
      `AI provider failed during initial generation: ${initialResp.error ?? "no content"}`,
    );
  }

  const parsed = parseSections(initialResp.content);

  // ── 2. Per-section verification + regeneration ───────────────────────
  const verifiedSections: Record<string, string> = {};

  for (const sectionId of SECTION_IDS) {
    let prose = parsed[sectionId] ?? "";

    // A missing/empty section is treated as an immediate guard failure so
    // the regeneration loop kicks in from scratch.
    let verification: VerificationResult =
      prose.trim().length === 0
        ? { ok: false, mismatches: ["<missing or empty section>"] }
        : verifyNumbers(prose, tokens);

    let attempts = 0;
    while (!verification.ok && attempts < MAX_RETRIES) {
      attempts++;
      prose = await regenerateSection(
        sectionId,
        prose,
        verification.mismatches,
        tokens,
        providerConfig,
      );
      verification = verifyNumbers(prose, tokens);
    }

    if (!verification.ok) {
      throw new Error(`Number-injection guard failed for section ${sectionId}`);
    }

    verifiedSections[sectionId] = prose;
  }

  // ── 3. Replace any residual token placeholders with their values ─────
  const sections: Record<string, string> = {};
  for (const sectionId of SECTION_IDS) {
    sections[sectionId] = replaceTokens(verifiedSections[sectionId], tokens);
  }

  // ── 4. Provenance stamp ──────────────────────────────────────────────
  const provenance: Record<string, string> = {};
  for (const sectionId of SECTION_IDS) {
    provenance[sectionId] = `AI:template:${input.templateId}`;
  }

  return { sections, provenance };
}
