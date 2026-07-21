// ─── PDF Engine (Wave 2 — full bank-ready PDF) ───────────────────────────────
// Generates a bank-ready Detailed Project Report PDF from a DprDocument using
// `pdf-lib` (client-side, zero Node deps — runs in a Capacitor WebView).
//
// Public API (unchanged from Wave 1 / doc 08):
//   generatePdf(dpr) → Promise<ArrayBuffer>
//   printDpr(dpr)    → void
//
// Document structure (in order):
//   1. Cover page          — PMEGP wordmark, title, eligibility status, CONFIDENTIAL
//   2. Table of Contents   — numbered list of sections + appendices
//   3. Section pages       — one page (or more) per dpr.sections[i], with tables
//   4. Appendix A          — Financial Summary (key figures table)
//   5. Appendix B          — Eligibility Assessment (checklist with ✓/✗)
//
// Determinism: same DprDocument → byte-identical ArrayBuffer.
//   • No `new Date()` inside generatePdf — the cover date is sourced from
//     dpr.generatedAt; /CreationDate and /ModDate are set explicitly from it.
//   • StandardFonts (Helvetica + Helvetica-Bold) are referenced by name, not
//     embedded as randomised byte streams, so font inclusion is deterministic.
//   • All rupee formatting uses integer math only (no toLocaleString, no floats).
//
// No Node deps: only `pdf-lib` + `@/engines/*` imports. Zero fs/stream/buffer/
// path. ESLint import-boundary rule (engines/ → no @/features/* or @/providers/*)
// is satisfied.
// ───────────────────────────────────────────────────────────────────────────────

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import type { DprDocument, DprSection, DprTable } from "@/engines/dpr-engine";
import type { FinancialResult } from "@/engines/financial-engine";
import type { EligibilityResult } from "@/engines/eligibility-engine";

// ── Page geometry (A4 in PDF points) ─────────────────────────────────────────
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// ── Colors (RGB 0..1, fixed at module load — deterministic) ──────────────────
const COLOR_DARK_GREEN = rgb(0.02, 0.12, 0.10);
const COLOR_GRAY = rgb(0.45, 0.45, 0.45);
const COLOR_LIGHT_GRAY = rgb(0.75, 0.75, 0.75);
const COLOR_RED = rgb(0.6, 0.2, 0.2);
const COLOR_GREEN = rgb(0.0, 0.45, 0.15);
const COLOR_BORDER = rgb(0.65, 0.65, 0.65);
const COLOR_HEADER_BG = rgb(0.93, 0.93, 0.93);
const COLOR_ROW_ALT = rgb(0.97, 0.97, 0.97);
const COLOR_WATERMARK = rgb(0.88, 0.88, 0.88);
const COLOR_BLACK = rgb(0.05, 0.05, 0.05);
const COLOR_WHITE = rgb(1, 1, 1);

// ════════════════════════════════════════════════════════════════════════════
// Formatting helpers — pure, integer-math, deterministic
// ════════════════════════════════════════════════════════════════════════════

/**
 * Format a number in Indian comma grouping using integer math only.
 *   1234567  → "12,34,567"
 *   5000000  → "50,00,000"
 *   500      → "500"
 *   -1234567 → "-12,34,567"
 *
 * No toLocaleString, no floats — pure integer digit manipulation. The Indian
 * system groups the rightmost 3 digits, then groups of 2 going left.
 */
export function formatINR(n: number): string {
  const negative = n < 0;
  const abs = Math.abs(Math.trunc(n));
  const digits = abs.toString();

  if (digits.length <= 3) {
    return (negative ? "-" : "") + digits;
  }

  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);

  // Group `rest` into chunks of 2 from the right.
  const groups: string[] = [];
  let remaining = rest;
  while (remaining.length > 2) {
    groups.unshift(remaining.slice(-2));
    remaining = remaining.slice(0, -2);
  }
  if (remaining.length > 0) {
    groups.unshift(remaining);
  }

  return (negative ? "-" : "") + groups.join(",") + "," + lastThree;
}

/** Rupee amount with "Rs. " prefix and Indian grouping. */
function formatINRRupees(n: number): string {
  return "Rs. " + formatINR(n);
}

/** Format a float with exactly `decimals` digits (e.g. DSCR 1.42 → "1.42"). */
function formatFloat(n: number, decimals = 2): string {
  if (!isFinite(n)) return "0." + "0".repeat(decimals);
  const negative = n < 0;
  const factor = Math.pow(10, decimals);
  const abs = Math.abs(Math.round(n * factor));
  const intPart = Math.floor(abs / factor);
  const fracPart = abs % factor;
  const fracStr = fracPart.toString().padStart(decimals, "0");
  return (negative ? "-" : "") + intPart.toString() + "." + fracStr;
}

/** Format a non-negative integer with standard 3-digit grouping (e.g. word count). */
function formatCount(n: number): string {
  const digits = Math.abs(Math.trunc(n)).toString();
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format an ISO timestamp as "DD MMM YYYY" (deterministic, no locale).
 * Falls back to the raw string if parsing fails.
 */
function formatDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const year = m[1];
  const monthIdx = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const monthLabel = months[monthIdx] ?? m[2];
  const dayStr = day < 10 ? "0" + day : String(day);
  return `${dayStr} ${monthLabel} ${year}`;
}

// ════════════════════════════════════════════════════════════════════════════
// Text helpers
// ════════════════════════════════════════════════════════════════════════════

/**
 * Sanitize text for WinAnsiEncoding (pdf-lib's StandardFonts encoding).
 * Replaces characters outside WinAnsi (notably ₹ → "Rs. ", ✓/✗ → "Y"/"N") with
 * safe ASCII equivalents. Characters already in WinAnsi (em dash, smart quotes,
 * bullet, ellipsis, en dash) are preserved.
 */
function sanitizeText(text: string): string {
  return text
    .replace(/₹/g, "Rs. ")
    .replace(/[✓✔]/g, "Y")
    .replace(/[✗✘]/g, "N")
    .replace(/™/g, "(TM)")
    .replace(/\u00a0/g, " "); // nbsp → space
}

/** Strip basic markdown markers (headings, bold, italic, code, bullets) to plain text. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*(\d+)\.\s+/gm, "$1. ");
}

/** Word-wrap text to fit `maxWidth` using the given font & size. Hard-breaks long words. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  for (const para of paragraphs) {
    if (para.length === 0) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current.length === 0 ? word : current + " " + word;
      const width = font.widthOfTextAtSize(candidate, size);
      if (width <= maxWidth) {
        current = candidate;
      } else {
        if (current.length > 0) lines.push(current);
        // Hard-break a single word that's still too wide.
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            const candidateChunk = chunk + ch;
            if (font.widthOfTextAtSize(candidateChunk, size) <= maxWidth) {
              chunk = candidateChunk;
            } else {
              if (chunk.length > 0) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current.length > 0) lines.push(current);
  }
  return lines;
}

// ════════════════════════════════════════════════════════════════════════════
// Render context + low-level drawing helpers
// ════════════════════════════════════════════════════════════════════════════

interface RenderContext {
  doc: PDFDocument;
  font: PDFFont;  // Helvetica (regular)
  bold: PDFFont;  // Helvetica-Bold
  page: PDFPage;  // current page
  y: number;      // current y cursor (top of next line)
}

/** Add a fresh content page with the CONFIDENTIAL watermark pre-drawn underneath. */
function newContentPage(ctx: RenderContext): void {
  const page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawWatermark(page, ctx.font);
  ctx.page = page;
  ctx.y = PAGE_HEIGHT - MARGIN;
}

/** Ensure `needed` points of vertical space; paginate if necessary. */
function ensureSpace(ctx: RenderContext, needed: number): void {
  if (ctx.y - needed < MARGIN + 36) {
    newContentPage(ctx);
  }
}

/** Draw a single line of text at the current y cursor; advance y. */
function drawLine(
  ctx: RenderContext,
  text: string,
  opts: {
    size?: number;
    bold?: boolean;
    color?: RGB;
    indent?: number;
    lineHeight?: number;
  } = {},
): void {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.bold : ctx.font;
  const color = opts.color ?? COLOR_BLACK;
  const indent = opts.indent ?? 0;
  const lineHeight = opts.lineHeight ?? size * 1.3;
  const x = MARGIN + indent;
  const y = ctx.y - size;

  ctx.page.drawText(sanitizeText(text), { x, y, size, font, color });
  ctx.y -= lineHeight;
}

/** Draw wrapped paragraph text starting at the current y cursor. */
function drawParagraph(
  ctx: RenderContext,
  text: string,
  opts: {
    size?: number;
    bold?: boolean;
    color?: RGB;
    indent?: number;
    lineHeight?: number;
    gap?: number;
  } = {},
): void {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.bold : ctx.font;
  const indent = opts.indent ?? 0;
  const lineHeight = opts.lineHeight ?? size * 1.3;
  const maxWidth = CONTENT_WIDTH - indent;

  const safe = sanitizeText(text);
  const lines = wrapText(safe, font, size, maxWidth);
  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    drawLine(ctx, line, {
      size,
      bold: opts.bold,
      color: opts.color,
      indent,
      lineHeight,
    });
  }
  if (opts.gap) ctx.y -= opts.gap;
}

// ════════════════════════════════════════════════════════════════════════════
// Watermark, header, footer
// ════════════════════════════════════════════════════════════════════════════

/** Draw the diagonal "CONFIDENTIAL" watermark in light gray on a page. */
function drawWatermark(page: PDFPage, font: PDFFont): void {
  const text = "CONFIDENTIAL";
  const size = 60;
  const textWidth = font.widthOfTextAtSize(text, size);
  // Center the text visually; pdf-lib rotates around the (x, y) anchor.
  const cx = PAGE_WIDTH / 2;
  const cy = PAGE_HEIGHT / 2;
  page.drawText(text, {
    x: cx - textWidth / 2,
    y: cy - size / 2,
    size,
    font,
    color: COLOR_WATERMARK,
    rotate: degrees(-45),
  });
}

/** Header: small gray title line at top of every content page (not cover). */
function drawHeader(page: PDFPage, font: PDFFont): void {
  const text = "PMEGP Detailed Project Report — CONFIDENTIAL";
  page.drawText(text, {
    x: MARGIN,
    y: PAGE_HEIGHT - 30,
    size: 8,
    font,
    color: COLOR_GRAY,
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 38 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 38 },
    thickness: 0.3,
    color: COLOR_LIGHT_GRAY,
  });
}

/** Footer: "Page X of Y" + app credit at the bottom of every content page. */
function drawFooter(page: PDFPage, font: PDFFont, pageNum: number, totalPages: number): void {
  const text = `Page ${pageNum} of ${totalPages}`;
  page.drawText(text, {
    x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(text, 8),
    y: 25,
    size: 8,
    font,
    color: COLOR_GRAY,
  });
  page.drawText("PMEGP Assistant", {
    x: MARGIN,
    y: 25,
    size: 8,
    font,
    color: COLOR_GRAY,
  });
  page.drawLine({
    start: { x: MARGIN, y: 33 },
    end: { x: PAGE_WIDTH - MARGIN, y: 33 },
    thickness: 0.3,
    color: COLOR_LIGHT_GRAY,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Line-drawn checkmark / cross (✓ and ✗ are not in WinAnsiEncoding)
// ════════════════════════════════════════════════════════════════════════════

/** Draw a checkmark (✓) at (x, y) with the given pixel size. */
function drawCheckMark(page: PDFPage, x: number, y: number, size: number, color: RGB): void {
  // Down-right then up-right: classic ✓ shape.
  page.drawLine({
    start: { x, y: y + size * 0.35 },
    end: { x: x + size * 0.35, y: y - size * 0.1 },
    thickness: 1.4,
    color,
  });
  page.drawLine({
    start: { x: x + size * 0.35, y: y - size * 0.1 },
    end: { x: x + size, y: y + size * 0.6 },
    thickness: 1.4,
    color,
  });
}

/** Draw a cross (✗) at (x, y) with the given pixel size. */
function drawCrossMark(page: PDFPage, x: number, y: number, size: number, color: RGB): void {
  page.drawLine({
    start: { x, y },
    end: { x: x + size, y: y + size },
    thickness: 1.4,
    color,
  });
  page.drawLine({
    start: { x, y: y + size },
    end: { x: x + size, y },
    thickness: 1.4,
    color,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Cover page
// ════════════════════════════════════════════════════════════════════════════

function drawCoverPage(
  doc: PDFDocument,
  dpr: DprDocument,
  font: PDFFont,
  bold: PDFFont,
): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const cx = PAGE_WIDTH / 2;

  // ── Top green band — visual treatment for the PMEGP wordmark ──
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 140,
    width: PAGE_WIDTH,
    height: 140,
    color: COLOR_DARK_GREEN,
  });

  page.drawText("PMEGP", {
    x: cx - bold.widthOfTextAtSize("PMEGP", 56) / 2,
    y: PAGE_HEIGHT - 95,
    size: 56,
    font: bold,
    color: COLOR_WHITE,
  });

  const subtitle = "Prime Minister's Employment Generation Programme";
  page.drawText(subtitle, {
    x: cx - bold.widthOfTextAtSize(subtitle, 11) / 2,
    y: PAGE_HEIGHT - 120,
    size: 11,
    font: bold,
    color: COLOR_WHITE,
  });

  // ── Document title block ──
  const titleY = PAGE_HEIGHT - 240;
  page.drawText("Detailed Project Report", {
    x: cx - bold.widthOfTextAtSize("Detailed Project Report", 28) / 2,
    y: titleY,
    size: 28,
    font: bold,
    color: COLOR_DARK_GREEN,
  });

  const tagline = "Prepared for Submission to Financing Bank under PMEGP";
  page.drawText(tagline, {
    x: cx - font.widthOfTextAtSize(tagline, 11) / 2,
    y: titleY - 25,
    size: 11,
    font,
    color: COLOR_GRAY,
  });

  // ── Report metadata (sections, words, generated-at) ──
  const summaryY = titleY - 90;
  const sectionsLabel = `Sections: ${dpr.sections.length}`;
  page.drawText(sectionsLabel, {
    x: cx - font.widthOfTextAtSize(sectionsLabel, 12) / 2,
    y: summaryY,
    size: 12,
    font,
    color: COLOR_BLACK,
  });
  const wordsLabel = `Word Count: ${formatCount(dpr.wordCount)}`;
  page.drawText(wordsLabel, {
    x: cx - font.widthOfTextAtSize(wordsLabel, 12) / 2,
    y: summaryY - 20,
    size: 12,
    font,
    color: COLOR_BLACK,
  });
  const generatedLabel = `Generated: ${formatDisplayDate(dpr.generatedAt)}`;
  page.drawText(generatedLabel, {
    x: cx - font.widthOfTextAtSize(generatedLabel, 12) / 2,
    y: summaryY - 40,
    size: 12,
    font,
    color: COLOR_BLACK,
  });

  // ── Eligibility status badge ──
  const eligible = dpr.eligibilityResult.eligible;
  const statusText = eligible ? "ELIGIBLE" : "NOT ELIGIBLE";
  const statusColor = eligible ? COLOR_GREEN : COLOR_RED;
  const badgeY = summaryY - 100;
  const badgeWidth = bold.widthOfTextAtSize(statusText, 14) + 40;
  page.drawRectangle({
    x: cx - badgeWidth / 2,
    y: badgeY - 6,
    width: badgeWidth,
    height: 24,
    color: COLOR_WHITE,
    borderColor: statusColor,
    borderWidth: 1,
  });
  page.drawText(statusText, {
    x: cx - bold.widthOfTextAtSize(statusText, 14) / 2,
    y: badgeY,
    size: 14,
    font: bold,
    color: statusColor,
  });
  const statusCaption = "Eligibility Status (per PMEGP scheme rules)";
  page.drawText(statusCaption, {
    x: cx - font.widthOfTextAtSize(statusCaption, 9) / 2,
    y: badgeY - 20,
    size: 9,
    font,
    color: COLOR_GRAY,
  });

  // ── Confidentiality notice near bottom ──
  const noticeY = 130;
  page.drawRectangle({
    x: MARGIN,
    y: noticeY - 14,
    width: CONTENT_WIDTH,
    height: 50,
    color: rgb(0.98, 0.95, 0.95),
    borderColor: COLOR_RED,
    borderWidth: 0.8,
  });
  page.drawText("CONFIDENTIAL", {
    x: cx - bold.widthOfTextAtSize("CONFIDENTIAL", 13) / 2,
    y: noticeY + 14,
    size: 13,
    font: bold,
    color: COLOR_RED,
  });
  const noticeText =
    "This Detailed Project Report contains confidential business and financial information. " +
    "Distribution beyond the financing bank and authorised PMEGP reviewing authorities is prohibited.";
  const noticeLines = wrapText(noticeText, font, 9, CONTENT_WIDTH - 20);
  let ny = noticeY + 2;
  for (const line of noticeLines) {
    page.drawText(line, {
      x: cx - font.widthOfTextAtSize(line, 9) / 2,
      y: ny,
      size: 9,
      font,
      color: COLOR_BLACK,
    });
    ny -= 11;
  }

  // ── Credit footer (no Page X of Y on cover) ──
  const credit = "Generated by PMEGP Assistant";
  page.drawText(credit, {
    x: cx - font.widthOfTextAtSize(credit, 8) / 2,
    y: 60,
    size: 8,
    font,
    color: COLOR_GRAY,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Table of Contents
// ════════════════════════════════════════════════════════════════════════════

function drawTableOfContents(ctx: RenderContext, dpr: DprDocument): void {
  drawLine(ctx, "Table of Contents", {
    size: 18,
    bold: true,
    color: COLOR_DARK_GREEN,
    lineHeight: 28,
  });
  ctx.y -= 4;

  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.8,
    color: COLOR_DARK_GREEN,
  });
  ctx.y -= 16;

  drawParagraph(
    ctx,
    "The Detailed Project Report is organised into the following sections, followed by " +
      "a Financial Summary and an Eligibility Assessment appendix.",
    { size: 9, color: COLOR_GRAY, lineHeight: 13, gap: 14 },
  );

  // Numbered section list.
  let i = 1;
  for (const section of dpr.sections) {
    const label = `${i}. ${section.title}`;
    const lines = wrapText(sanitizeText(label), ctx.font, 11, CONTENT_WIDTH - 10);
    for (const line of lines) {
      ensureSpace(ctx, 16);
      drawLine(ctx, line, { size: 11, indent: 10, lineHeight: 16 });
    }
    i++;
  }

  // Appendix entries.
  ensureSpace(ctx, 32);
  ctx.y -= 4;
  drawLine(ctx, "Appendix A — Financial Summary", {
    size: 11,
    bold: true,
    indent: 10,
    lineHeight: 16,
    color: COLOR_DARK_GREEN,
  });
  drawLine(ctx, "Appendix B — Eligibility Assessment", {
    size: 11,
    bold: true,
    indent: 10,
    lineHeight: 16,
    color: COLOR_DARK_GREEN,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Table rendering (for DprTable inside sections)
// ════════════════════════════════════════════════════════════════════════════

function drawDprTable(ctx: RenderContext, table: DprTable): void {
  const headers = table.headers;
  const rows = table.rows;
  const colCount = headers.length;
  if (colCount === 0) return;

  const cellSize = 9;
  const headerSize = 9;
  const padding = 6;
  const rowHeight = 18;

  // Column widths: max(header width, max cell width) + padding on each side.
  const colWidths: number[] = new Array(colCount).fill(0);
  for (let c = 0; c < colCount; c++) {
    const hw = ctx.bold.widthOfTextAtSize(sanitizeText(headers[c] ?? ""), headerSize);
    colWidths[c] = Math.max(colWidths[c], hw);
  }
  for (const row of rows) {
    for (let c = 0; c < colCount; c++) {
      const cw = ctx.font.widthOfTextAtSize(sanitizeText(row[c] ?? ""), cellSize);
      if (cw > colWidths[c]) colWidths[c] = cw;
    }
  }

  let totalWidth = colWidths.reduce((a, b) => a + b, 0) + padding * 2 * colCount;
  if (totalWidth > CONTENT_WIDTH) {
    const scale = CONTENT_WIDTH / totalWidth;
    for (let c = 0; c < colCount; c++) colWidths[c] *= scale;
    totalWidth = CONTENT_WIDTH;
  }

  // Caption
  ensureSpace(ctx, rowHeight + 30);
  drawLine(ctx, table.caption, {
    size: 10,
    bold: true,
    color: COLOR_BLACK,
    lineHeight: 16,
  });
  ctx.y -= 4;

  // Header row
  ensureSpace(ctx, rowHeight + 4);
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - rowHeight,
    width: totalWidth,
    height: rowHeight,
    color: COLOR_HEADER_BG,
    borderColor: COLOR_BORDER,
    borderWidth: 0.5,
  });
  let xCursor = MARGIN;
  for (let c = 0; c < colCount; c++) {
    ctx.page.drawText(sanitizeText(headers[c] ?? ""), {
      x: xCursor + padding,
      y: ctx.y - rowHeight + 5,
      size: headerSize,
      font: ctx.bold,
      color: COLOR_BLACK,
    });
    xCursor += colWidths[c] + padding * 2;
  }
  ctx.y -= rowHeight;

  // Body rows
  for (let r = 0; r < rows.length; r++) {
    ensureSpace(ctx, rowHeight + 2);
    const isAlt = r % 2 === 1;
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - rowHeight,
      width: totalWidth,
      height: rowHeight,
      color: isAlt ? COLOR_ROW_ALT : undefined,
      borderColor: COLOR_BORDER,
      borderWidth: 0.3,
    });
    xCursor = MARGIN;
    for (let c = 0; c < colCount; c++) {
      let display = sanitizeText(rows[r][c] ?? "");
      const maxW = colWidths[c];
      // Truncate with ellipsis if too wide for the computed column width.
      if (ctx.font.widthOfTextAtSize(display, cellSize) > maxW) {
        while (
          display.length > 1 &&
          ctx.font.widthOfTextAtSize(display + "…", cellSize) > maxW
        ) {
          display = display.slice(0, -1);
        }
        display = display + "…";
      }
      ctx.page.drawText(display, {
        x: xCursor + padding,
        y: ctx.y - rowHeight + 5,
        size: cellSize,
        font: ctx.font,
        color: COLOR_BLACK,
      });
      xCursor += colWidths[c] + padding * 2;
    }
    ctx.y -= rowHeight;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Section rendering
// ════════════════════════════════════════════════════════════════════════════

function drawSection(ctx: RenderContext, section: DprSection): void {
  // Each major section starts on a fresh page.
  newContentPage(ctx);

  // Section title (bold 14pt)
  drawLine(ctx, section.title, {
    size: 14,
    bold: true,
    color: COLOR_DARK_GREEN,
    lineHeight: 22,
  });

  // Underline rule
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.6,
    color: COLOR_LIGHT_GRAY,
  });
  ctx.y -= 16;

  // Content — strip markdown then wrap at 10pt.
  const text = stripMarkdown(section.content);
  drawParagraph(ctx, text, { size: 10, lineHeight: 14, gap: 8 });

  // Tables (if any)
  if (section.tables && section.tables.length > 0) {
    for (const table of section.tables) {
      ctx.y -= 4;
      drawDprTable(ctx, table);
      ctx.y -= 6;
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Appendix A — Financial Summary
// ════════════════════════════════════════════════════════════════════════════

function drawFinancialSummary(ctx: RenderContext, fin: FinancialResult): void {
  newContentPage(ctx);

  drawLine(ctx, "Appendix A — Financial Summary", {
    size: 16,
    bold: true,
    color: COLOR_DARK_GREEN,
    lineHeight: 24,
  });
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.6,
    color: COLOR_LIGHT_GRAY,
  });
  ctx.y -= 16;

  drawParagraph(
    ctx,
    "Key financial figures computed by the Financial Engine. All rupee values are in Indian " +
      "notation (e.g. Rs. 12,34,567).",
    { size: 9, color: COLOR_GRAY, lineHeight: 13, gap: 10 },
  );

  const rows: Array<[string, string]> = [
    ["Total Project Cost", formatINRRupees(fin.totalProjectCost)],
    ["Own Contribution", `${formatINRRupees(fin.ownContribution)} (${fin.ownContributionPercent}%)`],
    ["Subsidy Amount", `${formatINRRupees(fin.subsidyAmount)} (${fin.subsidyRate}% margin)`],
    ["Bank Term Loan", formatINRRupees(fin.bankTermLoan)],
    ["Bank Working Capital Loan", formatINRRupees(fin.bankWorkingCapital)],
    ["Total Bank Finance", formatINRRupees(fin.bankFinance)],
    ["EMI (Monthly)", formatINRRupees(fin.emi)],
    ["Loan Tenure", `${fin.loanTenureMonths} months`],
    ["Repayment Moratorium", `${fin.repaymentMoratoriumMonths} months`],
    ["Total Interest Payable", formatINRRupees(fin.totalInterest)],
    ["Total Repayment", formatINRRupees(fin.totalRepayment)],
    ["Annual Revenue (Projected)", formatINRRupees(fin.annualRevenue)],
    ["Annual Expenditure", formatINRRupees(fin.annualExpenditure)],
    ["Annual Net Profit", formatINRRupees(fin.annualNetProfit)],
    ["Annual Depreciation", formatINRRupees(fin.annualDepreciation)],
    ["DSCR (Debt Service Coverage Ratio)", formatFloat(fin.dscr)],
    ["Break-even Percentage", formatFloat(fin.breakEvenPercent) + "%"],
  ];

  const labelW = 280;
  const rowH = 18;

  // Header row
  ensureSpace(ctx, rowH + 4);
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - rowH,
    width: CONTENT_WIDTH,
    height: rowH,
    color: COLOR_HEADER_BG,
    borderColor: COLOR_BORDER,
    borderWidth: 0.5,
  });
  ctx.page.drawText("Figure", {
    x: MARGIN + 6,
    y: ctx.y - rowH + 5,
    size: 9,
    font: ctx.bold,
    color: COLOR_BLACK,
  });
  ctx.page.drawText("Value", {
    x: MARGIN + labelW + 6,
    y: ctx.y - rowH + 5,
    size: 9,
    font: ctx.bold,
    color: COLOR_BLACK,
  });
  ctx.y -= rowH;

  for (let i = 0; i < rows.length; i++) {
    const [label, value] = rows[i];
    ensureSpace(ctx, rowH + 2);
    const isAlt = i % 2 === 1;
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - rowH,
      width: CONTENT_WIDTH,
      height: rowH,
      color: isAlt ? COLOR_ROW_ALT : undefined,
      borderColor: COLOR_BORDER,
      borderWidth: 0.3,
    });
    ctx.page.drawText(sanitizeText(label), {
      x: MARGIN + 6,
      y: ctx.y - rowH + 5,
      size: 9,
      font: ctx.font,
      color: COLOR_BLACK,
    });
    ctx.page.drawText(sanitizeText(value), {
      x: MARGIN + labelW + 6,
      y: ctx.y - rowH + 5,
      size: 9,
      font: ctx.bold,
      color: COLOR_BLACK,
    });
    ctx.y -= rowH;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Appendix B — Eligibility Assessment
// ════════════════════════════════════════════════════════════════════════════

function drawEligibilityAssessment(ctx: RenderContext, elig: EligibilityResult): void {
  newContentPage(ctx);

  drawLine(ctx, "Appendix B — Eligibility Assessment", {
    size: 16,
    bold: true,
    color: COLOR_DARK_GREEN,
    lineHeight: 24,
  });
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.6,
    color: COLOR_LIGHT_GRAY,
  });
  ctx.y -= 16;

  // Overall status banner
  const statusText = elig.eligible
    ? "Overall Status: ELIGIBLE — all hard criteria satisfied."
    : `Overall Status: NOT ELIGIBLE — ${elig.blockers.length} blocker(s) found.`;
  drawParagraph(ctx, statusText, {
    size: 10,
    bold: true,
    color: elig.eligible ? COLOR_GREEN : COLOR_RED,
    gap: 8,
  });

  // Warnings (soft signals — EDP not completed, etc.)
  if (elig.warnings.length > 0) {
    drawParagraph(ctx, "Warnings:", {
      size: 9,
      bold: true,
      color: COLOR_RED,
      gap: 4,
    });
    for (const w of elig.warnings) {
      drawParagraph(ctx, "• " + w, {
        size: 9,
        indent: 10,
        color: COLOR_BLACK,
        lineHeight: 12,
        gap: 2,
      });
    }
    ctx.y -= 6;
  }

  ctx.y -= 4;
  drawLine(ctx, "Criteria Checklist", {
    size: 12,
    bold: true,
    color: COLOR_DARK_GREEN,
    lineHeight: 18,
  });
  ctx.y -= 8;

  // Each criterion: ✓/✗ (line-drawn) + bold label + actual/required + reason.
  for (const check of elig.checks) {
    const markSize = 10;
    const indent = markSize + 10;

    // Reserve space for at least the mark + label line + reason (1-2 lines).
    ensureSpace(ctx, 50);

    const markX = MARGIN;
    const markY = ctx.y - markSize - 2;

    if (check.passed) {
      drawCheckMark(ctx.page, markX, markY, markSize, COLOR_GREEN);
    } else {
      drawCrossMark(ctx.page, markX, markY, markSize, COLOR_RED);
    }

    // Label
    ctx.page.drawText(sanitizeText(check.label), {
      x: MARGIN + indent,
      y: ctx.y - 11,
      size: 11,
      font: ctx.bold,
      color: check.passed ? COLOR_GREEN : COLOR_RED,
    });
    ctx.y -= 18;

    // Actual / Required (if provided)
    const actualStr =
      check.actual !== undefined ? `Actual: ${check.actual}` : "";
    const reqStr =
      check.required !== undefined ? `Required: ${check.required}` : "";
    const joined = [actualStr, reqStr].filter((s) => s.length > 0).join("   |   ");
    if (joined.length > 0) {
      drawParagraph(ctx, joined, {
        size: 9,
        indent,
        color: COLOR_GRAY,
        lineHeight: 12,
        gap: 2,
      });
    }

    // Reason (always present)
    drawParagraph(ctx, check.reason, {
      size: 9,
      indent,
      color: COLOR_BLACK,
      lineHeight: 12,
      gap: 8,
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate a full bank-ready PDF from a DprDocument.
 *
 * Same DprDocument → byte-identical ArrayBuffer. No use of `new Date()` — the
 * cover date is sourced from `dpr.generatedAt` and the PDF /CreationDate +
 * /ModDate are set explicitly from it.
 */
export async function generatePdf(dpr: DprDocument): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  doc.setTitle("PMEGP Detailed Project Report");
  doc.setAuthor("PMEGP Assistant");
  doc.setSubject("Detailed Project Report");
  doc.setKeywords(["PMEGP", "DPR", "Project Report"]);
  doc.setProducer("PMEGP Assistant PDF Engine");
  doc.setCreator("PMEGP Assistant");

  // Deterministic creation/modification dates from dpr.generatedAt.
  // (Avoid `new Date()` — would inject wall-clock time and break determinism.)
  const generatedDate = new Date(dpr.generatedAt);
  doc.setCreationDate(generatedDate);
  doc.setModificationDate(generatedDate);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // ── Phase 1 — Cover page (page index 0; no header/footer/watermark) ──
  drawCoverPage(doc, dpr, font, bold);

  // ── Phase 2 — Content pages (TOC, sections, appendices) ──
  // First content page (with watermark) is created here; subsequent pages are
  // added on demand by newContentPage().
  const firstPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawWatermark(firstPage, font);

  const ctx: RenderContext = {
    doc,
    font,
    bold,
    page: firstPage,
    y: PAGE_HEIGHT - MARGIN,
  };

  // Table of Contents (uses the already-created first content page).
  drawTableOfContents(ctx, dpr);

  // Sections — sorted by `order` defensively (dpr-engine already returns them
  // in order, but the sort guarantees determinism independent of array order).
  const sortedSections = [...dpr.sections].sort((a, b) => a.order - b.order);
  for (const section of sortedSections) {
    drawSection(ctx, section);
  }

  // Appendices.
  drawFinancialSummary(ctx, dpr.financialResult);
  drawEligibilityAssessment(ctx, dpr.eligibilityResult);

  // ── Phase 3 — Second pass: headers & footers on every page except cover ──
  const pages = doc.getPages();
  const totalPages = pages.length;
  for (let i = 1; i < totalPages; i++) {
    drawHeader(pages[i], font);
    drawFooter(pages[i], font, i + 1, totalPages);
  }

  // ── Serialize → ArrayBuffer (pdf-lib returns Uint8Array; copy per contract) ──
  const bytes = await doc.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/**
 * Log that a PDF was generated. (Pipeline hook — no side effects beyond the
 * console log; the actual PDF bytes are produced by `generatePdf`.)
 */
export function printDpr(dpr: DprDocument): void {
  console.log("[PDF Engine] PDF generated, " + dpr.sections.length + " sections");
}
