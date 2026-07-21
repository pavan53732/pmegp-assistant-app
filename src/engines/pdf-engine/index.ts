// ─── PDF Engine (Wave 1 stub — full rewrite in Wave 2) ──────────────────────
// Generates a PDF from a DprDocument. The legacy pdfkit implementation was
// server-only (Node `fs`/`Buffer`) and cannot run in a Capacitor WebView, so
// it has been removed. This stub preserves the public API using `pdf-lib`
// (client-side, zero Node deps) and produces a minimal valid PDF. Wave 2 will
// implement the full 18-section layout, TOC, financial tables, watermarks,
// headers/footers, and deterministic byte output.
//
// API contract (unchanged from doc 08):
//   generatePdf(dpr) → Promise<ArrayBuffer>   (now async per Stage B spec)
//   printDpr(dpr)    → void
// ───────────────────────────────────────────────────────────────────────────────

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DprDocument } from "@/engines/dpr-engine";

/**
 * Generate a minimal placeholder PDF for the given DPR.
 *
 * Wave 2 will replace this with the full bank-ready document (cover, TOC, 18
 * sections, financial summary, eligibility assessment, watermarks, page
 * numbers). For now we emit a single-page summary so the feature layer can
 * wire up view/share flows against a real ArrayBuffer.
 */
export async function generatePdf(dpr: DprDocument): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  doc.setTitle("DPR — PMEGP Project");
  doc.setProducer("PMEGP Assistant");
  doc.setCreator("PMEGP Assistant PDF Engine");

  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 60;
  let y = page.getHeight() - margin;

  page.drawText("PMEGP Detailed Project Report", { x: margin, y, size: 18, font: bold, color: rgb(0.02, 0.12, 0.10) });
  y -= 28;
  page.drawText("CONFIDENTIAL — Placeholder (Wave 2 full layout pending)", { x: margin, y, size: 9, font, color: rgb(0.6, 0.2, 0.2) });
  y -= 24;

  page.drawText(`Sections: ${dpr.sections.length}`, { x: margin, y, size: 12, font });
  y -= 18;

  for (const section of dpr.sections) {
    if (y < margin + 40) break;
    page.drawText(`${section.id}. ${section.title}`.slice(0, 80), { x: margin, y, size: 11, font: bold });
    y -= 16;
  }

  const bytes = await doc.save();
  // pdf-lib returns Uint8Array; copy into a fresh ArrayBuffer to match the
  // declared `ArrayBuffer` return type (doc 08 contract).
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/** Log that a PDF was generated. (Hook for the pipeline; no side effects.) */
export function printDpr(_dpr: DprDocument): void {
  console.log("[PDF Engine] PDF generated (Wave 1 placeholder).");
}
