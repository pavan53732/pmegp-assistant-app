// ─── PII Redaction Utilities ───────────────────────────────────────────────
// Centralised masking for Aadhaar, PAN, phone, email, and free-text PII
// scrubbing. Used by providers/ (before AI prompts) and by logging paths.
//
// Rule #16: API key never logged. PII never in logs.
// ───────────────────────────────────────────────────────────────────────────────

/** Mask an Aadhaar number: keep first 4 + last 4, mask middle 4 digits. */
export function maskAadhaar(aadhaar: string): string {
  const digits = aadhaar.replace(/\D/g, "");
  if (digits.length !== 12) return aadhaar.replace(/\d/g, "X");
  return `${digits.slice(0, 4)} XXXX ${digits.slice(8)}`;
}

/** Mask a PAN: keep first 2 + last 2, mask middle 6 characters. */
export function maskPan(pan: string): string {
  if (pan.length < 6) return "XXXXXX";
  return `${pan.slice(0, 2)}XXXX${pan.slice(-2)}`;
}

/** Mask a phone number: keep first 4 + last 4 digits, mask the middle. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return digits.replace(/\d/g, "X");
  const leading = phone.slice(0, phone.indexOf(digits[0]) + 4);
  const trailing = digits.slice(-4);
  return `${leading}XXXX${trailing}`;
}

/** Mask an email: keep first 2 chars of local part, mask rest; keep domain. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 2) return "****@****";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const masked = local.slice(0, 2) + "*".repeat(Math.max(3, local.length - 2));
  return `${masked}${domain}`;
}

/**
 * Redact all known PII patterns from a free-text string. Used before logging
 * or before sending text to the AI provider (Rule #16).
 */
export function redactPii(text: string): string {
  return text
    .replace(/\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g, "$1 XXXX $3")
    .replace(/\b([A-Z]{2})[A-Z]{3}(\d{4})([A-Z])\b/g, "$1XXXX$2$3")
    .replace(/(\+?91[\s-]?)?(\d{4})[\s-]?(\d{2})[\s-]?(\d{4})\b/g, "$1$2XXXX$4")
    .replace(/([a-zA-Z0-9._%+-]{2})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "$1****@$2");
}
