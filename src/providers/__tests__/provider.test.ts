// ─── Provider Tests ──────────────────────────────────────────────────────
import { describe, test, expect } from "vitest";
import { redactPii } from "@/shared/security/pii";

describe("Provider PII Redaction", () => {
  test("redacts Aadhaar numbers before AI prompt", () => {
    const text = "My Aadhaar is 1234 5678 9012";
    const redacted = redactPii(text);
    expect(redacted).toContain("1234 XXXX 9012");
    expect(redacted).not.toContain("5678");
  });

  test("redacts PAN numbers", () => {
    const text = "PAN: ABCDE1234F";
    const redacted = redactPii(text);
    expect(redacted).not.toContain("CDE1234");
  });

  test("redacts phone numbers", () => {
    const text = "Phone: +91 9876 54 3210";
    const redacted = redactPii(text);
    expect(redacted).not.toContain("54 3210");
  });

  test("redacts email addresses", () => {
    const text = "Email: john.doe@example.com";
    const redacted = redactPii(text);
    expect(redacted).toContain("jo****@example.com");
  });

  test("leaves non-PII text unchanged", () => {
    const text = "Project cost is Rs. 12,34,567";
    const redacted = redactPii(text);
    expect(redacted).toBe(text);
  });
});
