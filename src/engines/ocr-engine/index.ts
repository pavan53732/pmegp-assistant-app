// ─── OCR Engine (Mock Implementation) ─────────────────────────────────────
// Provides the contract for document processing. Since this runs in a
// sandboxed environment without actual OCR libraries, this implements a
// mock/demonstration pipeline that simulates extraction from common
// document types (text-based: txt, csv, json).
//
// Contract: AGENT_CONTRACTS.md §13
// Rules:   IMPLEMENTATION_RULES.md #16 (Privacy), #2 (Pure Functions)
// ───────────────────────────────────────────────────────────────────────────

import type {
  ProjectProfile,
  AttachmentType,
  MachineryItem,
  Gender,
  ApplicantCategory,
  LandStatus,
} from "@/shared/types";
import type { FieldProvenance, ProvenanceMetadata } from "@/shared/types";

// ── Public Types ──────────────────────────────────────────────────────────

export interface OcrResult {
  success: boolean;
  extractedFields: Record<string, string>;
  confidence: number; // 0-1
  rawText: string;
}

// ── Internal Constants ────────────────────────────────────────────────────

/** Maximum file size for mock processing (1 MB). */
const MAX_FILE_SIZE = 1_048_576;

/** File types supported by the mock OCR pipeline. */
const SUPPORTED_FILE_TYPES = ["txt", "csv", "json"] as const;

/** Regex patterns for extracting key-value pairs from document text. */
const EXTRACTION_PATTERNS: ReadonlyArray<{
  readonly patterns: readonly RegExp[];
  readonly fieldKey: string;
  readonly postProcess?: (value: string) => string;
}> = [
  {
    patterns: [/Applicant\s*Name\s*[:\-]\s*(.+)/i, /Name\s*[:\-]\s*(.+)/i],
    fieldKey: "applicant.name",
  },
  {
    patterns: [/Age\s*[:\-]\s*(\d+)/i],
    fieldKey: "applicant.age",
  },
  {
    patterns: [/Gender\s*[:\-]\s*(.+)/i, /Sex\s*[:\-]\s*(.+)/i],
    fieldKey: "applicant.gender",
    postProcess: normalizeGender,
  },
  {
    patterns: [
      /Caste\s*Category\s*[:\-]\s*(.+)/i,
      /Category\s*[:\-]\s*(.+)/i,
    ],
    fieldKey: "applicant.category",
    postProcess: normalizeCategory,
  },
  {
    patterns: [
      /Aadhaar\s*(?:No|Number)?\s*[:\-]\s*(\S+)/i,
      /Aadhaar\s*[:\-]\s*(\S+)/i,
    ],
    fieldKey: "applicant.aadhaarNo",
    postProcess: maskAadhaar,
  },
  {
    patterns: [/PAN\s*(?:No|Number)?\s*[:\-]\s*(\S+)/i, /PAN\s*[:\-]\s*(\S+)/i],
    fieldKey: "applicant.panNo",
    postProcess: maskPan,
  },
  {
    patterns: [/NIC\s*(?:Code)?\s*[:\-]\s*(\S+)/i],
    fieldKey: "business.nicCode",
  },
  {
    patterns: [
      /Unit\s*Name\s*[:\-]\s*(.+)/i,
      /Project\s*Name\s*[:\-]\s*(.+)/i,
      /Business\s*Name\s*[:\-]\s*(.+)/i,
    ],
    fieldKey: "business.name",
  },
  {
    patterns: [/State\s*[:\-]\s*(.+)/i],
    fieldKey: "location.state",
  },
  {
    patterns: [/District\s*[:\-]\s*(.+)/i],
    fieldKey: "location.district",
  },
  {
    patterns: [
      /(?:Total|Amount|Cost)\s*[:\-]\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    ],
    fieldKey: "financials.amount",
  },
  {
    patterns: [/Quotation\s*No\s*[:\-]\s*(\S+)/i],
    fieldKey: "quotationNo",
  },
];

/** Regex for extracting line items from quotation-style documents. */
const MACHINERY_LINE_PATTERN =
  /(?:^|\n)\s*(\d+)?\s*[.)]\s*(.+?)\s+(?:Qty\s*[:\-]?\s*(\d+)|(\d+))\s*(?:x\s*)?(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/gi;

// ── PII Masking Helpers (Rule #16) ────────────────────────────────────────

/**
 * Mask Aadhaar number — store only the last 4 digits.
 * Input:  "2345 6789 0123" or "234567890123"
 * Output: "XXXX XXXX 0123"
 */
function maskAadhaar(value: string): string {
  const digits = value.replace(/\s/g, "");
  if (digits.length < 4) return "XXXX XXXX " + digits.padStart(4, "X");
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}

/**
 * Mask PAN number — show first 2 and last 2, mask the middle.
 * Input:  "ABCDE1234F"
 * Output: "ABXXXX34F"
 */
function maskPan(value: string): string {
  const cleaned = value.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 5) return cleaned;
  return cleaned.slice(0, 2) + "XXXX" + cleaned.slice(-2);
}

// ── Normalization Helpers ─────────────────────────────────────────────────

function normalizeGender(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "m" || v === "male") return "MALE";
  if (v === "f" || v === "female") return "FEMALE";
  return "OTHER";
}

function normalizeCategory(value: string): string {
  const v = value.trim().toUpperCase();
  if (v === "GENERAL" || v === "GEN") return "GEN";
  if (v === "SC" || v.includes("SCHEDULED CASTE")) return "SC";
  if (v === "ST" || v.includes("SCHEDULED TRIBE")) return "ST";
  if (v === "OBC" || v.includes("OTHER BACKWARD")) return "OBC";
  if (v === "MINORITY") return "MINORITY";
  if (v === "EX-SERVICEMEN" || v === "EX_SERVICEMEN" || v.includes("EX-SERVICE"))
    return "EX_SERVICEMEN";
  if (v === "PH" || v.includes("PHYSICALLY HANDICAPPED") || v.includes("DISABLED"))
    return "PH";
  if (v === "NER" || v.includes("NORTH EASTERN")) return "NER";
  return value;
}

function normalizeLandStatus(value: string): string {
  const v = value.trim().toUpperCase();
  if (v.includes("OWN")) return "OWN";
  if (v.includes("RENT")) return "RENTED";
  if (v.includes("LEASE")) return "LEASED";
  if (v.includes("NONE") || v.includes("NO LAND")) return "NONE";
  if (v.includes("FAMILY")) return "FAMILY";
  return value;
}

function parseCurrency(value: string): number {
  return Math.round(parseFloat(value.replace(/,/g, "")) || 0);
}

// ── Core Functions ────────────────────────────────────────────────────────

/**
 * Extract structured fields from a document buffer.
 *
 * Mock implementation: decodes as UTF-8 text and applies regex-based
 * key-value extraction. Returns failure for non-text or undecodable files.
 */
export async function extractFromDocument(
  fileBuffer: ArrayBuffer,
  fileType: string
): Promise<OcrResult> {
  const typeCheck = canProcessFile(fileType, fileBuffer.byteLength);
  if (!typeCheck.canProcess) {
    return {
      success: false,
      extractedFields: {},
      confidence: 0,
      rawText: "",
    };
  }

  // Attempt UTF-8 decode
  let rawText: string;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    rawText = decoder.decode(fileBuffer);
  } catch {
    return {
      success: false,
      extractedFields: {},
      confidence: 0,
      rawText: "",
    };
  }

  if (!rawText.trim()) {
    return {
      success: false,
      extractedFields: {},
      confidence: 0,
      rawText: "",
    };
  }

  // Extract key-value fields
  const extractedFields: Record<string, string> = {};
  let matchCount = 0;

  for (const { patterns, fieldKey, postProcess } of EXTRACTION_PATTERNS) {
    for (const pattern of patterns) {
      const match = pattern.exec(rawText);
      if (match?.[1]) {
        let value = match[1].trim();
        if (postProcess) {
          value = postProcess(value);
        }
        extractedFields[fieldKey] = value;
        matchCount++;
        break; // first matching pattern wins per field
      }
    }
  }

  // For quotation documents, also try to extract line items as JSON
  const hasQuotationNo = "quotationNo" in extractedFields;
  if (hasQuotationNo) {
    const lineItems = extractMachineryLines(rawText);
    if (lineItems.length > 0) {
      extractedFields["machinery.items"] = JSON.stringify(lineItems);
    }
  }

  // Confidence: ratio of expected fields found (mock heuristic)
  const maxExpectedFields = hasQuotationNo ? 8 : 6;
  const confidence = Math.min(matchCount / maxExpectedFields, 1);

  return {
    success: true,
    extractedFields,
    confidence: Math.round(confidence * 100) / 100,
    rawText,
  };
}

/**
 * Map OCR extraction results to a partial ProjectProfile.
 *
 * Pure function — no I/O. The returned partial can be merged into
 * an existing profile. All fields carry provenance:
 *   source: "OCR", verification: "UNVERIFIED", extractConfidence from result.
 */
export function mapOcrToProfile(
  ocrResult: OcrResult,
  documentType: AttachmentType
): Partial<ProjectProfile> {
  if (!ocrResult.success) {
    return {};
  }

  const fields = ocrResult.extractedFields;
  const conf = ocrResult.confidence;
  // PII masking already happened during extraction (Rule #16).

  const builder = new ProfileBuilder(conf);

  switch (documentType) {
    case "QUOTATION":
      buildQuotation(fields, builder);
      break;
    case "IDENTITY_PROOF":
      buildIdentityProof(fields, builder);
      break;
    case "LAND_DOCUMENT":
      buildLandDocument(fields, builder);
      break;
    case "EDP_CERTIFICATE":
      buildEdpCertificate(fields, builder);
      break;
    case "ADDRESS_PROOF":
      buildAddressProof(fields, builder);
      break;
    case "OTHER":
    default:
      buildGenericFields(fields, builder);
      break;
  }

  return builder.build();
}

// ── Profile Builder ───────────────────────────────────────────────────────
//
// Accumulates partial section updates and provenance entries, then
// produces a Partial<ProjectProfile>. Uses `Record<string, unknown>`
// for each section internally to avoid TypeScript's strict type
// checking on partial sub-objects.

class ProfileBuilder {
  private applicant: Record<string, unknown> = {};
  private business: Record<string, unknown> = {};
  private location: Record<string, unknown> = {};
  private land: Record<string, unknown> = {};
  private machinery: Record<string, unknown> | null = null;
  private financials: Record<string, unknown> = {};
  private provEntries: Array<[string, FieldProvenance]> = [];

  constructor(private confidence: number) {}

  setApplicant(field: string, value: unknown, dotPath: string): void {
    this.applicant[field] = value;
    this.provEntries.push([dotPath, makeProvenance(this.confidence)]);
  }

  setBusiness(field: string, value: unknown, dotPath: string): void {
    this.business[field] = value;
    this.provEntries.push([dotPath, makeProvenance(this.confidence)]);
  }

  setLocation(field: string, value: unknown, dotPath: string): void {
    this.location[field] = value;
    this.provEntries.push([dotPath, makeProvenance(this.confidence)]);
  }

  setLand(field: string, value: unknown, dotPath: string): void {
    this.land[field] = value;
    this.provEntries.push([dotPath, makeProvenance(this.confidence)]);
  }

  setMachinery(items: MachineryItem[]): void {
    const totalCost = Math.round(
      items.reduce((sum, item) => sum + item.totalCost, 0)
    );
    this.machinery = { items, totalCost };

    this.provEntries.push(["machinery.totalCost", makeProvenance(this.confidence)]);
    items.forEach((_, idx) => {
      this.provEntries.push([`machinery.items.${idx}`, makeProvenance(this.confidence)]);
      this.provEntries.push([`machinery.items.${idx}.name`, makeProvenance(this.confidence)]);
      this.provEntries.push([`machinery.items.${idx}.quantity`, makeProvenance(this.confidence)]);
      this.provEntries.push([`machinery.items.${idx}.unitCost`, makeProvenance(this.confidence)]);
      this.provEntries.push([`machinery.items.${idx}.totalCost`, makeProvenance(this.confidence)]);
    });
  }

  setFinancials(field: string, value: unknown, dotPath: string): void {
    this.financials[field] = value;
    this.provEntries.push([dotPath, makeProvenance(this.confidence)]);
  }

  /** Add a provenance entry without setting a profile field. */
  addProvenance(dotPath: string): void {
    this.provEntries.push([dotPath, makeProvenance(this.confidence)]);
  }

  build(): Partial<ProjectProfile> {
    const result: Partial<ProjectProfile> = {};

    if (Object.keys(this.applicant).length > 0) {
      result.applicant = this.applicant as unknown as ProjectProfile["applicant"];
    }
    if (Object.keys(this.business).length > 0) {
      result.business = this.business as unknown as ProjectProfile["business"];
    }
    if (Object.keys(this.location).length > 0) {
      result.location = this.location as unknown as ProjectProfile["location"];
    }
    if (Object.keys(this.land).length > 0) {
      result.land = this.land as unknown as ProjectProfile["land"];
    }
    if (this.machinery !== null) {
      result.machinery = this.machinery as unknown as ProjectProfile["machinery"];
    }
    if (Object.keys(this.financials).length > 0) {
      result.financials = this.financials as unknown as ProjectProfile["financials"];
    }

    if (this.provEntries.length > 0) {
      result.provenance = mergeProvenance(this.provEntries);
    }

    return result;
  }
}

// ── Document-Type Builders ────────────────────────────────────────────────

function buildQuotation(
  fields: Record<string, string>,
  b: ProfileBuilder
): void {
  // Extract machinery items if present
  const itemsJson = fields["machinery.items"];
  if (itemsJson) {
    try {
      const items: MachineryItem[] = JSON.parse(itemsJson);
      if (items.length > 0) {
        // Add source: "OCR" to each item
        const taggedItems: MachineryItem[] = items.map((item) => ({
          ...item,
          source: "OCR" as const,
        }));
        b.setMachinery(taggedItems);
      }
    } catch {
      // Invalid JSON — skip machinery extraction
    }
  }

  if (fields["business.name"]) {
    b.setBusiness("name", fields["business.name"], "business.name");
  }

  if (fields["business.nicCode"]) {
    b.setBusiness("nicCode", fields["business.nicCode"], "business.nicCode");
  }

  if (fields["financials.amount"]) {
    const amount = parseCurrency(fields["financials.amount"]);
    b.setFinancials("machineryAndEquipment", amount, "financials.machineryAndEquipment");
  }
}

function buildIdentityProof(
  fields: Record<string, string>,
  b: ProfileBuilder
): void {
  if (fields["applicant.name"]) {
    b.setApplicant("name", fields["applicant.name"], "applicant.name");
  }

  if (fields["applicant.age"]) {
    const age = parseInt(fields["applicant.age"], 10);
    if (!isNaN(age) && age > 0 && age < 120) {
      b.setApplicant("age", age, "applicant.age");
    }
  }

  if (fields["applicant.gender"]) {
    const gender = fields["applicant.gender"] as Gender;
    if (["MALE", "FEMALE", "OTHER"].includes(gender)) {
      b.setApplicant("gender", gender, "applicant.gender");
    }
  }

  if (fields["applicant.category"]) {
    const category = fields["applicant.category"] as ApplicantCategory;
    const validCategories = new Set<string>([
      "GEN", "SC", "ST", "OBC", "MINORITY", "EX_SERVICEMEN", "PH", "NER",
    ]);
    if (validCategories.has(category)) {
      b.setApplicant("category", category, "applicant.category");
    }
  }

  // PII fields — already masked during extraction (Rule #16)
  if (fields["applicant.aadhaarNo"]) {
    b.setApplicant("aadhaarNo", fields["applicant.aadhaarNo"], "applicant.aadhaarNo");
  }

  if (fields["applicant.panNo"]) {
    b.setApplicant("panNo", fields["applicant.panNo"], "applicant.panNo");
  }
}

function buildLandDocument(
  fields: Record<string, string>,
  b: ProfileBuilder
): void {
  if (fields["land.status"]) {
    const status = normalizeLandStatus(fields["land.status"]) as LandStatus;
    b.setLand("status", status, "land.status");
  }

  if (fields["land.areaSqFt"]) {
    const area = parseFloat(fields["land.areaSqFt"]);
    if (!isNaN(area) && area > 0) {
      b.setLand("areaSqFt", Math.round(area), "land.areaSqFt");
    }
  }

  if (fields["land.areaSqMt"]) {
    const area = parseFloat(fields["land.areaSqMt"]);
    if (!isNaN(area) && area > 0) {
      b.setLand("areaSqMt", Math.round(area * 100) / 100, "land.areaSqMt");
    }
  }
}

function buildEdpCertificate(
  fields: Record<string, string>,
  b: ProfileBuilder
): void {
  // EDP certificate always marks the training as completed
  b.setApplicant("edpCompleted", true, "applicant.edpCompleted");

  if (fields["edp.certificateNo"]) {
    b.setApplicant("edpCertificateNo", fields["edp.certificateNo"], "applicant.edpCertificateNo");
  }
}

function buildAddressProof(
  fields: Record<string, string>,
  b: ProfileBuilder
): void {
  if (fields["location.state"]) {
    b.setLocation("state", fields["location.state"], "location.state");
  }

  if (fields["location.district"]) {
    b.setLocation("district", fields["location.district"], "location.district");
  }
}

function buildGenericFields(
  fields: Record<string, string>,
  b: ProfileBuilder
): void {
  if (fields["applicant.name"]) {
    b.setApplicant("name", fields["applicant.name"], "applicant.name");
  }

  if (fields["business.name"]) {
    b.setBusiness("name", fields["business.name"], "business.name");
  }

  if (fields["location.state"]) {
    b.setLocation("state", fields["location.state"], "location.state");
  }

  if (fields["location.district"]) {
    b.setLocation("district", fields["location.district"], "location.district");
  }
}

// ── Machinery Line Item Extraction ────────────────────────────────────────

/**
 * Extract machinery line items from quotation text.
 *
 * Matches patterns like:
 *   1. Lathe Machine    Qty: 2   Rs. 45,000
 *   2) Drilling Machine  3  x  Rs.12,500.00
 */
function extractMachineryLines(text: string): Array<{
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}> {
  const items: Array<{
    name: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }> = [];

  let match: RegExpExecArray | null;
  const pattern = new RegExp(MACHINERY_LINE_PATTERN.source, "gi");

  while ((match = pattern.exec(text)) !== null) {
    const name = match[2]?.trim();
    const quantity = parseInt(match[3] || match[4] || "1", 10);
    const unitCost = parseCurrency(match[5] || "0");

    if (name && !isNaN(quantity) && quantity > 0 && unitCost > 0) {
      items.push({
        name,
        quantity,
        unitCost,
        totalCost: Math.round(quantity * unitCost),
      });
    }
  }

  return items;
}

// ── Provenance Helpers ────────────────────────────────────────────────────

/**
 * Create a FieldProvenance entry for an OCR-extracted field.
 */
function makeProvenance(confidence: number): FieldProvenance {
  return {
    source: "OCR",
    verification: "UNVERIFIED",
    extractConfidence: Math.round(confidence * 100) / 100,
  };
}

/**
 * Build a ProvenanceMetadata from an array of [dotPath, provenance] entries.
 */
function mergeProvenance(
  entries: Array<[string, FieldProvenance]>
): ProvenanceMetadata {
  const perField: Record<string, FieldProvenance> = {};

  for (const [path, prov] of entries) {
    perField[path] = prov;
  }

  // Aggregate: average confidence of OCR-sourced fields
  const confidences = entries.map(([, p]) => p.extractConfidence ?? 0);
  const aggregate =
    confidences.length > 0
      ? Math.round(
          (confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100
        ) / 100
      : 0;

  return { perField, aggregate };
}

// ── Utility Exports ───────────────────────────────────────────────────────

/**
 * Get the list of file types supported by the mock OCR pipeline.
 */
export function getSupportedFileTypes(): string[] {
  return [...SUPPORTED_FILE_TYPES];
}

/**
 * Validate whether a file can be processed by the OCR engine.
 *
 * Checks file type against supported list and enforces size limits.
 */
export function canProcessFile(
  fileType: string,
  fileSize: number
): { canProcess: boolean; reason?: string } {
  const normalizedType = fileType.toLowerCase().replace(/^\./, "");

  if (!SUPPORTED_FILE_TYPES.includes(normalizedType as (typeof SUPPORTED_FILE_TYPES)[number])) {
    return {
      canProcess: false,
      reason: `Unsupported file type "${fileType}". Supported types: ${SUPPORTED_FILE_TYPES.join(", ")}`,
    };
  }

  if (fileSize <= 0) {
    return {
      canProcess: false,
      reason: "File is empty (0 bytes).",
    };
  }

  if (fileSize > MAX_FILE_SIZE) {
    return {
      canProcess: false,
      reason: `File size (${formatBytes(fileSize)}) exceeds the maximum allowed size (${formatBytes(MAX_FILE_SIZE)}).`,
    };
  }

  return { canProcess: true };
}

// ── Internal Utilities ────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}