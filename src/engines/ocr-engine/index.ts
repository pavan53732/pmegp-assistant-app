// ─── OCR Engine (On-Device Tesseract.js) ──────────────────────────────────
// On-device OCR via Tesseract.js (WASM, runs in the WebView, truly offline —
// no cloud calls, no PII leaves the device). Replaces the previous text-only
// mock. Image acquisition is handled inside this module:
//
//   • Native (Android): @capacitor/camera's Camera.getPhoto() — quality 90,
//     JPEG, base64. Source = CAMERA or PHOTOS depending on the `source` arg.
//   • Web (dev): an <input type="file" accept="image/*"> prompt, with the
//     `capture="environment"` hint when source === "camera" so mobile
//     browsers open the rear camera.
//   • Test bypass: setTestImage(b64) injects a base64 image so unit tests
//     and web dev can exercise the pipeline without the camera prompt.
//
// Contract: AGENT_CONTRACTS.md §13 (signature change: extractFromDocument now
//   takes a capture source ("camera" | "gallery") + documentType instead of
//   an in-memory ArrayBuffer — the buffer is acquired inside the function
//   via the device camera or web file picker). mapOcrToProfile and the
//   OcrResult shape are unchanged.
// Rules:   IMPLEMENTATION_RULES.md #16 (Privacy / PII masking), #2 (Pure
//   Functions — mapOcrToProfile is pure; extractFromDocument is I/O by
//   necessity).
//
// Boundary: this file imports only platform SDKs (@capacitor/core,
//   @capacitor/camera, tesseract.js) and @/shared/types — never
//   @/features/* or @/providers/*.
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

// `@capacitor/core` is platform-agnostic (the web shim is identical to the
// native one at the JS level — it just returns "web" from getPlatform()).
// Safe to import statically; only used here for isNativePlatform().
import { Capacitor } from "@capacitor/core";

// ── Public Types ──────────────────────────────────────────────────────────
// Shape preserved EXACTLY from the previous mock implementation so callers
// of mapOcrToProfile keep working unchanged. extractFromDocument's parameter
// list changed (was (fileBuffer, fileType); now (source, documentType)) —
// no in-repo callers exist (verified via grep).

export interface OcrResult {
  success: boolean;
  extractedFields: Record<string, string>;
  confidence: number; // 0-1
  rawText: string;
}

// ── Test Image Injection (dev/test only) ──────────────────────────────────
// Lets unit tests or web dev bypass the camera/file-picker prompt by
// pre-supplying a base64 image. Accepts either a raw base64 string or a
// "data:image/...;base64,..." data URL. Pass an empty string to clear.

let testImage: string | null = null;

export function setTestImage(b64: string): void {
  testImage = b64 && b64.length > 0 ? b64 : null;
}

// ── PII Masking (Rule #16) ────────────────────────────────────────────────
// Two layers:
//   1. Targeted masks (maskAadhaar / maskPan / maskPhone / maskEmail) are
//      applied as `postProcess` on the matching EXTRACTION_PATTERNS entries
//      so the extracted field values are masked at extraction time.
//   2. maskPii(rawText) scans the full OCR buffer for any Aadhaar / PAN /
//      phone / email patterns and masks them before rawText is returned —
//      this catches PII that the field-extraction patterns missed (e.g.
//      an Aadhaar number printed on a quotation that doesn't match the
//      "Aadhaar No:" labelled pattern).

/**
 * Mask Aadhaar: keep the first 4 and last 4 digits, mask the middle 4.
 * Input:  "2345 6789 0123" or "234567890123"
 * Output: "2345 XXXX 0123"
 */
function maskAadhaar(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) {
    // Too short to safely mask — pad-stretch to keep first 4 / last 4 shape.
    const padded = digits.padEnd(8, "X");
    return `${padded.slice(0, 4)} XXXX ${padded.slice(-4)}`;
  }
  const first4 = digits.slice(0, 4);
  const last4 = digits.slice(-4);
  return `${first4} XXXX ${last4}`;
}

/**
 * Mask PAN: keep first 2 and last 2 chars, mask the middle 6 (always "XXXX"
 * — 4 X's regardless of how many chars are between, matching the prior mock).
 * Input:  "ABCDE1234F"
 * Output: "ABXXXX34F"
 */
function maskPan(value: string): string {
  const cleaned = value.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 5) return cleaned;
  return cleaned.slice(0, 2) + "XXXX" + cleaned.slice(-2);
}

/**
 * Mask phone: keep the first 4 and last 4 digits, mask everything between
 * (typically the middle 2-4 digits of a 10-digit Indian mobile number).
 * Input:  "+91 98765 43210" or "9876543210"
 * Output: "+91 9XXX43210"  /  "9876XXXX210"
 */
function maskPhone(value: string): string {
  const trimmed = value.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return trimmed;
  const first4 = digits.slice(0, 4);
  const last4 = digits.slice(-4);
  const middleLen = Math.max(digits.length - 8, 4);
  const middle = "X".repeat(middleLen);
  return `${plus}${first4}${middle}${last4}`;
}

/**
 * Mask email: keep the first 2 chars of the local part, mask the rest.
 * Domain is left untouched (not PII for our purposes — needed for
 * downstream validation).
 * Input:  "john.doe@example.com"
 * Output: "jo*****@example.com"
 */
function maskEmail(value: string): string {
  const trimmed = value.trim();
  const at = trimmed.indexOf("@");
  if (at < 2) return trimmed; // too short to mask safely
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  const keep = local.slice(0, 2);
  const masked = "*".repeat(Math.max(local.length - 2, 3));
  return `${keep}${masked}${domain}`;
}

// PII scan patterns — used by maskPii on the full rawText buffer. Aadhaar
// runs first so phone doesn't double-match 12-digit Aadhaar sequences.
const AADHAAR_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b|\b\d{12}\b/g;
const PAN_PATTERN = /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g;
const PHONE_PATTERN = /\+?\d[\d\s-]{8,14}\d/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Mask all PII (Aadhaar, PAN, phone, email) found in free text. Applied to
 * rawText before it leaves extractFromDocument so the unmasked OCR buffer
 * is never persisted or displayed (Rule #16).
 */
export function maskPii(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(AADHAAR_PATTERN, (m) => maskAadhaar(m));
  out = out.replace(PAN_PATTERN, (m) => maskPan(m));
  out = out.replace(PHONE_PATTERN, (m) => maskPhone(m));
  out = out.replace(EMAIL_PATTERN, (m) => maskEmail(m));
  return out;
}

// ── Extraction Patterns (preserved from mock) ─────────────────────────────

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
      /Aadhaar\s*(?:No|Number)?\s*[:\-]\s*([\d\s]{12,})/i,
      /Aadhaar\s*[:\-]\s*([\d\s]{12,})/i,
    ],
    fieldKey: "applicant.aadhaarNo",
    postProcess: maskAadhaar,
  },
  {
    patterns: [/PAN\s*(?:No|Number)?\s*[:\-]\s*([A-Za-z0-9]+)/i, /PAN\s*[:\-]\s*([A-Za-z0-9]+)/i],
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

// ── Image Acquisition ─────────────────────────────────────────────────────

/**
 * Acquire an image as a "data:image/...;base64,..." data URL from the camera
 * or gallery. Branches on:
 *   1. testImage set via setTestImage() — used by tests / web dev.
 *   2. Native platform — @capacitor/camera (dynamically imported so the web
 *      dev server never tries to resolve the native plugin at module-eval).
 *   3. Web — <input type="file" accept="image/*"> with a `capture` hint for
 *      the camera source.
 */
async function acquireImage(source: "camera" | "gallery"): Promise<string> {
  if (testImage) {
    return normalizeDataUrl(testImage);
  }
  if (Capacitor.isNativePlatform()) {
    return captureNative(source);
  }
  return pickWebImage(source);
}

function normalizeDataUrl(b64: string): string {
  if (b64.startsWith("data:")) return b64;
  return `data:image/jpeg;base64,${b64}`;
}

/**
 * Native capture via @capacitor/camera. The plugin module is imported
 * dynamically (inside the function body) so that on the web dev server the
 * native plugin code is never evaluated.
 */
async function captureNative(source: "camera" | "gallery"): Promise<string> {
  const cameraMod = await import("@capacitor/camera");
  const { Camera, CameraResultType, CameraSource } = cameraMod;
  const photo = await Camera.getPhoto({
    quality: 90,
    resultType: CameraResultType.Base64,
    source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
    correctOrientation: true,
  });
  const base64 = photo.base64String;
  if (!base64) {
    throw new Error("Camera.getPhoto returned no base64 data");
  }
  return `data:image/jpeg;base64,${base64}`;
}

/**
 * Web fallback: synthetic file input. Injects an <input type="file"
 * accept="image/*"> into the DOM, clicks it, and resolves with the chosen
 * file as a data URL. When source === "camera" the `capture="environment"`
 * attribute hints mobile browsers to open the rear camera directly.
 *
 * Handles cancel best-effort: many browsers fire a window `focus` event
 * (without ever firing `change`) when the user dismisses the picker. We
 * listen for that and reject after a short grace period.
 */
function pickWebImage(source: "camera" | "gallery"): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (source === "camera") {
      // Hint mobile browsers to use the rear camera; desktop ignores.
      input.setAttribute("capture", "environment");
    }
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.opacity = "0";
    document.body.appendChild(input);

    let settled = false;
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    const onFilePicked = (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const result = reader.result;
        if (typeof result === "string") resolve(result);
        else reject(new Error("FileReader returned non-string result"));
      };
      reader.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(reader.error || new Error("FileReader error"));
      };
      reader.readAsDataURL(file);
    };

    input.addEventListener("change", () => {
      if (settled) return;
      const file = input.files && input.files[0];
      if (!file) {
        settled = true;
        cleanup();
        reject(new Error("No file selected"));
        return;
      }
      onFilePicked(file);
    });

    // Cancel detection — most browsers fire window `focus` when the picker
    // dialog is dismissed without a selection. Wait a short grace period so
    // a legitimate `change` event has time to land first.
    const cancelTimer = window.setTimeout(() => {
      if (settled) return;
      const onCancel = () => {
        window.removeEventListener("focus", onCancel);
        window.setTimeout(() => {
          if (!settled && (!input.files || input.files.length === 0)) {
            settled = true;
            cleanup();
            reject(new Error("User cancelled image selection"));
          }
        }, 500);
      };
      window.addEventListener("focus", onCancel);
    }, 300);

    input.click();
    // Best-effort: clear the cancel timer if a file is chosen normally.
    input.addEventListener("change", () => window.clearTimeout(cancelTimer), { once: true });
  });
}

// ── OCR ───────────────────────────────────────────────────────────────────

interface TesseractResult {
  text: string;
  confidence: number; // 0-100 (Tesseract scale)
}

/**
 * Run Tesseract.js OCR on a data-URL image. The tesseract.js module is
 * dynamically imported so its (large) WASM core is only loaded when OCR is
 * actually invoked, not at module-eval time of this engine.
 *
 * OFFLINE MODE: We build a worker via `createWorker("eng", 1, { … })` and
 * pass local `workerPath` / `corePath` / `langPath` (see
 * `./tesseract-config`). This forces tesseract.js to load its worker script,
 * the SIMD WASM core, and the English trained data from `/public/tesseract/`
 * (served at `/tesseract/`) instead of fetching ~10MB from a CDN on the first
 * OCR call. The worker is terminated after each recognition so memory is
 * released between captures (tesseract.js v5 workers are cheap to recreate
 * once the WASM core is cached by the browser).
 *
 * Note: tesseract.js v5 ships as a CommonJS module (`export = Tesseract`).
 * With esModuleInterop the dynamic import exposes the namespace either as
 * the default export or as named exports — we handle both shapes.
 */
async function runOcr(imageData: string): Promise<TesseractResult> {
  const mod: any = await import("tesseract.js");
  const tess = mod.default ?? mod;
  const { TESSERACT_CONFIG } = await import("./tesseract-config");

  const worker = await tess.createWorker("eng", 1, {
    workerPath: TESSERACT_CONFIG.workerPath,
    corePath: TESSERACT_CONFIG.corePath,
    langPath: TESSERACT_CONFIG.langPath,
    // logger: (m: any) => { if (m.status) console.debug(`[tesseract] ${m.status}: ${m.progress ?? ""}`); },
  });
  try {
    const { data } = await worker.recognize(imageData);
    return {
      text: typeof data?.text === "string" ? data.text : "",
      confidence: typeof data?.confidence === "number" ? data.confidence : 0,
    };
  } finally {
    await worker.terminate();
  }
}

// ── Core Functions ────────────────────────────────────────────────────────

/**
 * Capture a document image (camera or gallery) and extract structured
 * fields via on-device Tesseract.js OCR. PII (Aadhaar, PAN, phone, email)
 * is masked before the result leaves this function — both in the extracted
 * field values (per-field postProcess) and in rawText (via maskPii).
 *
 * Returns a failed OcrResult on any capture / OCR error (matches the prior
 * mock's `{ success: false }` contract) — callers should branch on
 * `result.success` and surface a user-facing message, never throw.
 */
export async function extractFromDocument(
  source: "camera" | "gallery",
  documentType: AttachmentType,
): Promise<OcrResult> {
  try {
    const imageData = await acquireImage(source);
    const ocr = await runOcr(imageData);
    const rawText = ocr.text;

    if (!rawText.trim()) {
      return {
        success: false,
        extractedFields: {},
        confidence: 0,
        rawText: "",
      };
    }

    // Extract key-value fields (reuses the same regex patterns as the
    // previous mock — Aadhaar / PAN postProcess masks them in place).
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

    // For quotation documents, also try to extract line items as JSON.
    // documentType biases this: a document the user labelled QUOTATION gets
    // machinery extraction even if the "Quotation No" labelled pattern
    // didn't match (OCR is lossy — label may be missing).
    const isQuotation =
      documentType === "QUOTATION" || "quotationNo" in extractedFields;
    if (isQuotation) {
      const lineItems = extractMachineryLines(rawText);
      if (lineItems.length > 0) {
        extractedFields["machinery.items"] = JSON.stringify(lineItems);
      }
    }

    // Confidence: blend Tesseract's per-page OCR confidence (0-1) with the
    // field-coverage heuristic so a confident OCR of an empty form doesn't
    // report 0.9 just because Tesseract was sure the page was blank.
    const maxExpectedFields = isQuotation ? 8 : 6;
    const fieldConfidence = Math.min(matchCount / maxExpectedFields, 1);
    const ocrConfidence = ocr.confidence / 100;
    const confidence =
      Math.round(((ocrConfidence + fieldConfidence) / 2) * 100) / 100;

    // PII masking BEFORE return — rawText must not contain unmasked PII.
    const maskedText = maskPii(rawText);

    return {
      success: true,
      extractedFields,
      confidence,
      rawText: maskedText,
    };
  } catch {
    // Capture failures, OCR crashes, user-cancel — surface as a failed
    // result (matches the existing { success: false } contract).
    return {
      success: false,
      extractedFields: {},
      confidence: 0,
      rawText: "",
    };
  }
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
 * source: "OCR", verification: "UNVERIFIED" — fields extracted via OCR are
 * never auto-confirmed; the user must explicitly verify them in the UI.
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
