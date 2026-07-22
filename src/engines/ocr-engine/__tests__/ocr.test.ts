// ─── OCR Engine Tests ──────────────────────────────────────────────────
import { describe, test, expect } from "vitest";
import { extractFieldsFromText } from "../index";

describe("OCR Engine — extractFieldsFromText()", () => {
  test("extracts fields from quotation text", () => {
    const text = "Supplier: ABC Machinery\nItem: Lathe Machine\nQty: 2\nUnit Price: ₹2,50,000\nTotal: ₹5,00,000";
    const result = extractFieldsFromText(text, "quotation");
    expect(result.fields).toBeDefined();
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  test("returns low confidence for garbled text", () => {
    const text = "asdf qwer zxcv 1234 !!!";
    const result = extractFieldsFromText(text, "quotation");
    expect(result.confidence).toBeLessThan(0.3);
  });

  test("extracted fields include source markers", () => {
    const text = "Item: Grinder\nPrice: ₹1,20,000";
    const result = extractFieldsFromText(text, "quotation");
    for (const field of result.fields) {
      expect(field.source).toBe("OCR");
    }
  });

  test("deterministic: same text → same extraction", () => {
    const text = "Supplier: XYZ\nAmount: ₹50,000";
    const a = extractFieldsFromText(text, "quotation");
    const b = extractFieldsFromText(text, "quotation");
    expect(a.fields.length).toBe(b.fields.length);
  });
});
