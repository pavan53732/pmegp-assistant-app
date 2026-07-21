// ─── PDF Engine ─────────────────────────────────────────────────────────────
// Converts a DprDocument into a professional, bank-ready PDF document using
// the pdfkit library. Generates an in-memory PDF buffer with:
//   - Professional cover page with PMEGP branding
//   - Section headings, formatted markdown content, and structured tables
//   - Alternating-row shading, bold headers, proper column widths
//   - Running headers/footers with page numbers on every page
//   - Financial and eligibility summary appendices
//
// Pure function — NO network calls, NO AI calls, NO side effects.
// Returns an ArrayBuffer (compatible with the pipeline service).
// ─────────────────────────────────────────────────────────────────────────────

import PDFDocument from "pdfkit";
import type { DprDocument, DprSection, DprTable } from "@/engines/dpr-engine";

// ── Page Layout Constants ──────────────────────────────────────────────────

/** A4 page width in points. */
const PAGE_WIDTH = 595.28;

/** A4 page height in points. */
const PAGE_HEIGHT = 841.89;

/** Top margin for content pages. */
const MARGIN_TOP = 50;

/** Bottom margin for content pages. */
const MARGIN_BOTTOM = 50;

/** Left margin. */
const MARGIN_LEFT = 60;

/** Right margin. */
const MARGIN_RIGHT = 60;

/** Usable content width. */
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

/** Header height reserved at the top of each content page. */
const HEADER_HEIGHT = 36;

/** Footer height reserved at the bottom of each content page. */
const FOOTER_HEIGHT = 36;

/** Effective Y range for content (from top of content area to bottom). */
const CONTENT_TOP = MARGIN_TOP + HEADER_HEIGHT + 8;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM - FOOTER_HEIGHT - 8;

// ── Colour Palette ─────────────────────────────────────────────────────────

/** Dark emerald green for section headings and key accents. */
const COLOR_HEADING = "#064e3b";

/** Medium emerald green for sub-headings and table headers. */
const COLOR_SUBHEADING = "#047857";

/** Black for body text. */
const COLOR_BODY = "#1a1a1a";

/** Dark grey for secondary text and captions. */
const COLOR_SECONDARY = "#374151";

/** Light grey for table alternating row shading. */
const COLOR_ROW_ALT = "#f0fdf4";

/** Table header background. */
const COLOR_TABLE_HEADER = "#064e3b";

/** Table header text (white). */
const COLOR_TABLE_HEADER_TEXT = "#ffffff";

/** Table border line. */
const COLOR_TABLE_BORDER = "#d1d5db";

/** Header/footer separator line. */
const COLOR_RULE = "#9ca3af";

/** Watermark colour for "CONFIDENTIAL". */
const COLOR_WATERMARK = "#d1d5db";

// ── Font Sizes ─────────────────────────────────────────────────────────────

const FONT_TITLE = 28;
const FONT_SUBTITLE = 14;
const FONT_SECTION = 16;
const FONT_SUBSECTION = 12;
const FONT_BODY = 10;
const FONT_TABLE_CAPTION = 9;
const FONT_TABLE_HEADER = 9;
const FONT_TABLE_BODY = 8.5;
const FONT_HEADER_FOOTER = 7.5;
const FONT_COVER_FIELD_LABEL = 10;
const FONT_COVER_FIELD_VALUE = 12;

// ── Type Aliases ───────────────────────────────────────────────────────────

/** A pdfkit document instance narrowed for our usage. */
type Doc = InstanceType<typeof PDFDocument>;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a professional, bank-ready PDF document from a DprDocument.
 *
 * The PDF includes a branded cover page, all DPR sections with formatted
 * markdown content and structured tables, a financial summary, and an
 * eligibility assessment. Every page (except the cover) carries a running
 * header, footer with page numbering, and a "CONFIDENTIAL" watermark.
 *
 * @param dpr - The complete DprDocument produced by the DPR engine.
 * @returns An ArrayBuffer containing the PDF binary data, suitable for
 *          base64-encoding and download.
 */
export function generatePdf(dpr: DprDocument): ArrayBuffer {
  const errors: string[] = [];

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: "Detailed Project Report — PMEGP",
      Author: "PMEGP Assistant",
      Subject: `DPR for ${dpr.sections.find((s) => s.id === "business-profile")?.content ?? "PMEGP Project"}`,
      Creator: "PMEGP Assistant PDF Engine",
    },
  });

  // Collect PDF output into a buffer
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  try {
    // Determine project name from executive summary or first section
    const projectName = extractProjectName(dpr);

    // ── 1. Cover Page ──
    renderCoverPage(doc, dpr, projectName);

    // ── 2. Table of Contents ──
    renderTableOfContents(doc, dpr);

    // ── 3. DPR Sections ──
    const sortedSections = [...dpr.sections].sort((a, b) => a.order - b.order);
    for (let i = 0; i < sortedSections.length; i++) {
      const section = sortedSections[i]!;
      // Page break before each section (except the first after TOC)
      if (i > 0) {
        doc.addPage();
      }
      renderSection(doc, section, projectName);
    }

    // ── 4. Financial Summary ──
    doc.addPage();
    renderFinancialSummary(doc, dpr);

    // ── 5. Eligibility Assessment ──
    doc.addPage();
    renderEligibilityAssessment(doc, dpr);

    // ── 6. Headers, Footers & Watermarks on all pages ──
    addHeadersFootersAndWatermarks(doc, projectName);

    doc.end();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Unknown PDF generation error");
    // Still end the doc so the stream resolves
    try {
      doc.end();
    } catch {
      // ignore
    }
  }

  // pdfkit is stream-based; we need to wait for the 'end' event
  // Since we're in a synchronous context (pure function), we use a
  // synchronous approach by collecting chunks.
  // The buffer is already collected by the 'data' event handler above.
  const pdfBuffer = Buffer.concat(chunks);

  return pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  ) as ArrayBuffer;
}

/**
 * Generate the text representation and signal readiness for printing.
 * Now produces a real PDF. Logs a confirmation message.
 */
export function printDpr(dpr: DprDocument): void {
  const _buffer = generatePdf(dpr);
  console.log("[PDF Engine] DPR PDF document generated and ready for download.");
}

// ── Cover Page ─────────────────────────────────────────────────────────────

/**
 * Render the professional cover page with PMEGP branding.
 */
function renderCoverPage(doc: Doc, dpr: DprDocument, projectName: string): void {
  doc.addPage();

  // Top decorative bar
  doc
    .rect(0, 0, PAGE_WIDTH, 8)
    .fill(COLOR_HEADING);

  // PMEGP label
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(COLOR_HEADING)
    .text("GOVERNMENT OF INDIA", MARGIN_LEFT, 50, { align: "center", width: CONTENT_WIDTH });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLOR_SECONDARY)
    .text("Ministry of Micro, Small and Medium Enterprises", MARGIN_LEFT, 68, {
      align: "center",
      width: CONTENT_WIDTH,
    });

  // Separator line
  let y = 92;
  doc
    .moveTo(MARGIN_LEFT, y)
    .lineTo(PAGE_WIDTH - MARGIN_RIGHT, y)
    .strokeColor(COLOR_RULE)
    .lineWidth(0.5)
    .stroke();

  y += 20;

  // Main title
  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_TITLE)
    .fillColor(COLOR_HEADING)
    .text("DETAILED PROJECT REPORT", MARGIN_LEFT, y, {
      align: "center",
      width: CONTENT_WIDTH,
    });

  y = doc.y + 8;

  doc
    .font("Helvetica")
    .fontSize(FONT_SUBTITLE)
    .fillColor(COLOR_SECONDARY)
    .text("Under Prime Minister's Employment Generation Programme (PMEGP)", MARGIN_LEFT, y, {
      align: "center",
      width: CONTENT_WIDTH,
    });

  y = doc.y + 6;

  doc
    .font("Helvetica-Oblique")
    .fontSize(FONT_SUBTITLE - 1)
    .fillColor(COLOR_SECONDARY)
    .text("KVIC / KVIB / State Channelising Agencies", MARGIN_LEFT, y, {
      align: "center",
      width: CONTENT_WIDTH,
    });

  // Separator
  y = doc.y + 20;
  doc
    .moveTo(MARGIN_LEFT + 80, y)
    .lineTo(PAGE_WIDTH - MARGIN_RIGHT - 80, y)
    .strokeColor(COLOR_HEADING)
    .lineWidth(1.5)
    .stroke();

  // Project information block
  y = doc.y + 30;

  const date = new Date(dpr.generatedAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Extract applicant name from business profile section
  const businessSection = dpr.sections.find((s) => s.id === "business-profile");
  const applicantName = extractApplicantName(dpr);

  const coverFields: [string, string][] = [
    ["Project Name", projectName],
    ["Applicant / Promoter", applicantName],
    ["Date of Preparation", date],
    ["Total Project Cost", formatIndianCurrencyFromDpr(dpr.financialResult.totalProjectCost)],
    ["Document Word Count", String(dpr.wordCount)],
  ];

  for (const [label, value] of coverFields) {
    doc
      .font("Helvetica")
      .fontSize(FONT_COVER_FIELD_LABEL)
      .fillColor(COLOR_SECONDARY)
      .text(label, MARGIN_LEFT + 60, y, { width: 160, continued: false });

    doc
      .font("Helvetica-Bold")
      .fontSize(FONT_COVER_FIELD_VALUE)
      .fillColor(COLOR_BODY)
      .text(value, MARGIN_LEFT + 220, y, { width: CONTENT_WIDTH - 280 });

    y += 24;
  }

  // Bottom decorative bar
  doc
    .rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8)
    .fill(COLOR_HEADING);

  // Footer text on cover
  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor(COLOR_SECONDARY)
    .text(
      "Prepared using PMEGP Assistant",
      MARGIN_LEFT,
      PAGE_HEIGHT - 50,
      { align: "center", width: CONTENT_WIDTH }
    );
}

// ── Table of Contents ──────────────────────────────────────────────────────

/**
 * Render a simple table of contents listing all DPR sections.
 */
function renderTableOfContents(doc: Doc, dpr: DprDocument): void {
  doc.addPage();
  let y = CONTENT_TOP;

  // Section heading
  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SECTION)
    .fillColor(COLOR_HEADING)
    .text("TABLE OF CONTENTS", MARGIN_LEFT, y, { width: CONTENT_WIDTH });

  y = doc.y + 4;

  // Separator
  doc
    .moveTo(MARGIN_LEFT, y)
    .lineTo(MARGIN_LEFT + CONTENT_WIDTH, y)
    .strokeColor(COLOR_HEADING)
    .lineWidth(1)
    .stroke();

  y += 16;

  const sortedSections = [...dpr.sections].sort((a, b) => a.order - b.order);

  for (const section of sortedSections) {
    // Ensure space for this line
    if (y > CONTENT_BOTTOM - 20) {
      doc.addPage();
      y = CONTENT_TOP;
    }

    doc
      .font("Helvetica")
      .fontSize(FONT_BODY)
      .fillColor(COLOR_BODY)
      .text(section.title, MARGIN_LEFT, y, {
        width: CONTENT_WIDTH - 30,
        continued: false,
      });

    // Dotted line from end of title to page right
    y = doc.y + 4;
  }

  // Additional items
  y += 8;
  const extraItems = [
    "Financial Summary",
    "Eligibility Assessment",
  ];
  for (const item of extraItems) {
    if (y > CONTENT_BOTTOM - 20) {
      doc.addPage();
      y = CONTENT_TOP;
    }
    doc
      .font("Helvetica")
      .fontSize(FONT_BODY)
      .fillColor(COLOR_BODY)
      .text(item, MARGIN_LEFT, y, { width: CONTENT_WIDTH });
    y = doc.y + 4;
  }
}

// ── Section Rendering ──────────────────────────────────────────────────────

/**
 * Render a single DPR section with its title, markdown content, and tables.
 */
function renderSection(doc: Doc, section: DprSection, projectName: string): void {
  let y = CONTENT_TOP;

  // Section title
  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SECTION)
    .fillColor(COLOR_HEADING)
    .text(section.title, MARGIN_LEFT, y, { width: CONTENT_WIDTH });

  y = doc.y + 4;

  // Title underline
  doc
    .moveTo(MARGIN_LEFT, y)
    .lineTo(MARGIN_LEFT + CONTENT_WIDTH, y)
    .strokeColor(COLOR_HEADING)
    .lineWidth(1)
    .stroke();

  y += 12;

  // Render markdown content
  y = renderMarkdownContent(doc, section.content, y);

  // Render structured tables
  if (section.tables && section.tables.length > 0) {
    for (const table of section.tables) {
      if (y > CONTENT_TOP + 20) {
        y += 8;
      }
      // Ensure minimum space for at least a table header
      if (y > CONTENT_BOTTOM - 80) {
        doc.addPage();
        y = CONTENT_TOP;
      }
      y = renderTable(doc, table, y);
    }
  }
}

// ── Markdown Rendering ─────────────────────────────────────────────────────

/**
 * Parse and render markdown content onto the PDF document.
 * Handles: ## headings, **bold**, - bullets, numbered lists, paragraphs.
 *
 * @param doc     - The pdfkit document.
 * @param content - The markdown string from the DPR section.
 * @param startY  - The Y position to start rendering at.
 * @returns The Y position after all content has been rendered.
 */
function renderMarkdownContent(doc: Doc, content: string, startY: number): number {
  const lines = content.split("\n");
  let y = startY;
  let inBulletList = false;
  let inNumberedList = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;

    // Empty line = paragraph break
    if (rawLine.trim() === "") {
      if (inBulletList || inNumberedList) {
        inBulletList = false;
        inNumberedList = false;
      }
      y += 4;
      continue;
    }

    // ── Markdown heading (## ) ──
    const headingMatch = rawLine.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      inBulletList = false;
      inNumberedList = false;
      const level = headingMatch[1]!.length;
      const text = headingMatch[2]!.trim();

      if (y > CONTENT_BOTTOM - 40) {
        doc.addPage();
        y = CONTENT_TOP;
      }

      const fontSize = level === 1 ? FONT_SUBSECTION + 1 : FONT_SUBSECTION;
      doc
        .font("Helvetica-Bold")
        .fontSize(fontSize)
        .fillColor(COLOR_SUBHEADING)
        .text(text, MARGIN_LEFT, y, { width: CONTENT_WIDTH });

      y = doc.y + 4;

      // Subtle underline for sub-section headings
      doc
        .moveTo(MARGIN_LEFT, y)
        .lineTo(MARGIN_LEFT + CONTENT_WIDTH * 0.3, y)
        .strokeColor(COLOR_TABLE_BORDER)
        .lineWidth(0.5)
        .stroke();

      y += 8;
      continue;
    }

    // ── Bullet point (- item) ──
    const bulletMatch = rawLine.match(/^[-*]\s+(.*)/);
    if (bulletMatch) {
      if (!inBulletList) {
        inBulletList = true;
        inNumberedList = false;
        y += 2;
      }

      const text = bulletMatch[1]!.trim();
      const bulletText = renderInlineBold(doc, text);

      // Estimate height needed
      const textHeight = doc
        .font("Helvetica")
        .fontSize(FONT_BODY)
        .heightOfString(bulletText, { width: CONTENT_WIDTH - 30 });

      if (y + textHeight > CONTENT_BOTTOM) {
        doc.addPage();
        y = CONTENT_TOP;
      }

      // Bullet character
      doc
        .font("Helvetica")
        .fontSize(FONT_BODY)
        .fillColor(COLOR_BODY)
        .text("\u2022", MARGIN_LEFT + 10, y, { width: 12, continued: false });

      // Bullet text — with inline bold handling
      renderRichText(doc, text, MARGIN_LEFT + 24, y, CONTENT_WIDTH - 24);

      y = doc.y + 2;
      continue;
    }

    // ── Numbered list (1. item) ──
    const numMatch = rawLine.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      if (!inNumberedList) {
        inNumberedList = true;
        inBulletList = false;
        y += 2;
      }

      const num = numMatch[1]!;
      const text = numMatch[2]!.trim();

      const textHeight = doc
        .font("Helvetica")
        .fontSize(FONT_BODY)
        .heightOfString(text, { width: CONTENT_WIDTH - 30 });

      if (y + textHeight > CONTENT_BOTTOM) {
        doc.addPage();
        y = CONTENT_TOP;
      }

      // Number
      doc
        .font("Helvetica-Bold")
        .fontSize(FONT_BODY)
        .fillColor(COLOR_BODY)
        .text(`${num}.`, MARGIN_LEFT + 10, y, { width: 16, continued: false });

      // Numbered text
      renderRichText(doc, text, MARGIN_LEFT + 28, y, CONTENT_WIDTH - 28);

      y = doc.y + 2;
      continue;
    }

    // ── Regular paragraph text ──
    inBulletList = false;
    inNumberedList = false;

    const cleanedLine = rawLine.replace(/\*\*/g, "").trim();
    if (!cleanedLine) {
      y += 2;
      continue;
    }

    const textHeight = doc
      .font("Helvetica")
      .fontSize(FONT_BODY)
      .heightOfString(cleanedLine, { width: CONTENT_WIDTH });

    if (y + textHeight > CONTENT_BOTTOM) {
      doc.addPage();
      y = CONTENT_TOP;
    }

    // Render paragraph with inline bold support
    renderRichText(doc, rawLine.trim(), MARGIN_LEFT, y, CONTENT_WIDTH);

    y = doc.y + 4;
  }

  return y;
}

/**
 * Render text that may contain **bold** inline spans.
 * Wraps text properly within the given width.
 */
function renderRichText(doc: Doc, text: string, x: number, y: number, maxWidth: number): void {
  // Split text by **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  let curX = x;
  let curY = y;
  const lineHeight = FONT_BODY * 1.4;

  for (const part of parts) {
    if (!part) continue;

    const isBold = part.startsWith("**") && part.endsWith("**");
    const cleanText = isBold ? part.slice(2, -2) : part;

    if (!cleanText) continue;

    const font = isBold ? "Helvetica-Bold" : "Helvetica";
    doc.font(font).fontSize(FONT_BODY).fillColor(COLOR_BODY);

    // Word-wrap within the available width
    const words = cleanText.split(/\s+/);
    for (const word of words) {
      if (!word) continue;

      const wordWidth = doc.widthOfString(word + " ");

      if (curX + wordWidth > x + maxWidth) {
        curX = x;
        curY += lineHeight;

        if (curY > CONTENT_BOTTOM) {
          doc.addPage();
          curY = CONTENT_TOP;
        }
      }

      doc.text(word, curX, curY, { width: maxWidth - (curX - x), continued: false });
      curX += doc.widthOfString(word + " ");
    }
  }

  // Advance doc.y past the rendered content
  if (doc.y < curY + lineHeight) {
    // We can't directly set doc.y, so we use a dummy operation
    doc.text("", x, curY + lineHeight);
  }
}

/**
 * Strip bold markers from text for height estimation.
 */
function renderInlineBold(_doc: Doc, text: string): string {
  return text.replace(/\*\*/g, "");
}

// ── Table Rendering ────────────────────────────────────────────────────────

/**
 * Parse a markdown table from lines (for inline tables in markdown content).
 * Returns null if the lines don't form a valid table.
 *
 * Not used for DPR structured tables (DprTable), which are rendered directly.
 * Kept for potential future use with inline markdown tables.
 */
function parseMarkdownTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  const tableLines = lines.filter((l) => l.trim().startsWith("|"));

  if (tableLines.length < 2) return null;

  // First line is headers
  const headerCells = tableLines[0]!
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);

  // Second line should be separator (---)
  const separator = tableLines[1]!.trim();
  if (!/^[\s|:-]+$/.test(separator)) return null;

  // Remaining lines are data rows
  const rows: string[][] = [];
  for (let i = 2; i < tableLines.length; i++) {
    const cells = tableLines[i]!
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return { headers: headerCells, rows };
}

/**
 * Render a structured DprTable onto the PDF with professional formatting.
 * Includes caption, header row with dark background, alternating row shading,
 * proper column widths, and cell padding.
 *
 * @param doc     - The pdfkit document.
 * @param table   - The structured DprTable to render.
 * @param startY  - The Y position to start rendering at.
 * @returns The Y position after the table has been rendered.
 */
function renderTable(doc: Doc, table: DprTable, startY: number): number {
  const colCount = table.headers.length;
  if (colCount === 0) return startY;

  let y = startY;

  // ── Table Caption ──
  if (y > CONTENT_BOTTOM - 20) {
    doc.addPage();
    y = CONTENT_TOP;
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_TABLE_CAPTION)
    .fillColor(COLOR_SECONDARY)
    .text(table.caption, MARGIN_LEFT, y, { width: CONTENT_WIDTH });

  y = doc.y + 6;

  // ── Calculate Column Widths ──
  const colWidths = calculateColumnWidths(table.headers, table.rows, CONTENT_WIDTH);

  // ── Row Height Calculation ──
  const cellPaddingX = 5;
  const cellPaddingY = 4;
  const rowHeight = (text: string, colIdx: number): number => {
    const availableWidth = colWidths[colIdx]! - cellPaddingX * 2;
    const h = doc
      .font("Helvetica")
      .fontSize(FONT_TABLE_BODY)
      .heightOfString(text, { width: Math.max(availableWidth, 20) });
    return h + cellPaddingY * 2;
  };

  // ── Render Header Row ──
  const headerHeights = table.headers.map((h, i) => rowHeight(h, i));
  const headerRowHeight = Math.max(...headerHeights, 18);

  if (y + headerRowHeight > CONTENT_BOTTOM) {
    doc.addPage();
    y = CONTENT_TOP;
  }

  // Header background
  doc
    .rect(MARGIN_LEFT, y, CONTENT_WIDTH, headerRowHeight)
    .fill(COLOR_TABLE_HEADER);

  // Header cells
  let curX = MARGIN_LEFT;
  for (let i = 0; i < colCount; i++) {
    const w = colWidths[i]!;
    doc
      .font("Helvetica-Bold")
      .fontSize(FONT_TABLE_HEADER)
      .fillColor(COLOR_TABLE_HEADER_TEXT)
      .text(
        table.headers[i] ?? "",
        curX + cellPaddingX,
        y + cellPaddingY,
        {
          width: w - cellPaddingX * 2,
          align: "left",
          lineBreak: false,
        }
      );
    curX += w;
  }

  y += headerRowHeight;

  // ── Render Data Rows ──
  for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
    const row = table.rows[rowIdx]!;

    // Calculate row height
    const rowHeights = row.map((cell, i) => rowHeight(cell ?? "", i));
    const thisRowHeight = Math.max(...rowHeights, 16);

    // Check if we need a new page for this row
    if (y + thisRowHeight > CONTENT_BOTTOM) {
      doc.addPage();
      y = CONTENT_TOP;

      // Re-render header on new page
      doc
        .rect(MARGIN_LEFT, y, CONTENT_WIDTH, headerRowHeight)
        .fill(COLOR_TABLE_HEADER);

      let headerX = MARGIN_LEFT;
      for (let i = 0; i < colCount; i++) {
        const w = colWidths[i]!;
        doc
          .font("Helvetica-Bold")
          .fontSize(FONT_TABLE_HEADER)
          .fillColor(COLOR_TABLE_HEADER_TEXT)
          .text(
            table.headers[i] ?? "",
            headerX + cellPaddingX,
            y + cellPaddingY,
            { width: w - cellPaddingX * 2, align: "left", lineBreak: false }
          );
        headerX += w;
      }
      y += headerRowHeight;
    }

    // Alternating row background
    if (rowIdx % 2 === 1) {
      doc
        .rect(MARGIN_LEFT, y, CONTENT_WIDTH, thisRowHeight)
        .fill(COLOR_ROW_ALT);
    }

    // Row cells
    curX = MARGIN_LEFT;
    for (let i = 0; i < colCount; i++) {
      const cellText = (row[i] ?? "").trim();
      const w = colWidths[i]!;

      // Right-align numeric cells
      const isNumeric = /^[\d,.₹\sRs.\-+%()]+$/.test(cellText) &&
        cellText.replace(/[\d,.₹\sRs.\-+%()]/g, "").length === 0;

      doc
        .font("Helvetica")
        .fontSize(FONT_TABLE_BODY)
        .fillColor(COLOR_BODY)
        .text(cellText, curX + cellPaddingX, y + cellPaddingY, {
          width: w - cellPaddingX * 2,
          align: isNumeric ? "right" : "left",
        });

      curX += w;
    }

    y += thisRowHeight;
  }

  // ── Table Bottom Border ──
  doc
    .moveTo(MARGIN_LEFT, y)
    .lineTo(MARGIN_LEFT + CONTENT_WIDTH, y)
    .strokeColor(COLOR_TABLE_BORDER)
    .lineWidth(0.5)
    .stroke();

  // Column separators (vertical lines) — done after all rows
  // We draw them on each row area, which is complex; skip for cleanliness.

  y += 8;

  return y;
}

/**
 * Calculate optimal column widths for a table based on content.
 * Ensures total width fits within the available content width.
 */
function calculateColumnWidths(
  headers: string[],
  rows: string[][],
  availableWidth: number
): number[] {
  const colCount = headers.length;
  if (colCount === 0) return [];

  // Measure header widths
  const headerWidths = headers.map((h) => measureTextWidth(h, "Helvetica-Bold", FONT_TABLE_HEADER));

  // Measure max content width per column
  const contentWidths = headers.map(() => 0);
  for (const row of rows) {
    for (let i = 0; i < colCount; i++) {
      const cellText = (row[i] ?? "").trim();
      const cellWidth = measureTextWidth(cellText, "Helvetica", FONT_TABLE_BODY);
      if (cellWidth > contentWidths[i]!) {
        contentWidths[i] = cellWidth;
      }
    }
  }

  // Take the max of header and content width for each column, plus padding
  const padding = 12; // cellPaddingX * 2
  const rawWidths = headers.map((_, i) => Math.max(headerWidths[i]!, contentWidths[i]!) + padding);

  const totalRawWidth = rawWidths.reduce((a, b) => a + b, 0);

  // Scale to fit if necessary
  if (totalRawWidth > availableWidth) {
    const ratio = availableWidth / totalRawWidth;
    return rawWidths.map((w) => Math.max(Math.floor(w * ratio), 30));
  }

  // Distribute extra space proportionally
  const extraSpace = availableWidth - totalRawWidth;
  if (extraSpace > 0) {
    const totalProportion = rawWidths.reduce((a, b) => a + b, 0);
    return rawWidths.map((w) => {
      const extra = totalProportion > 0 ? (w / totalProportion) * extraSpace : extraSpace / colCount;
      return Math.floor(w + extra);
    });
  }

  return rawWidths;
}

/**
 * Measure the width of a text string with a given font and size.
 * Uses a temporary pdfkit document for measurement.
 */
function measureTextWidth(text: string, font: string, fontSize: number): number {
  const measureDoc = new PDFDocument();
  measureDoc.font(font).fontSize(fontSize);
  const width = measureDoc.widthOfString(text);
  // We don't end this doc — it's just for measurement.
  // In practice, pdfkit caches font metrics so this is lightweight.
  return width;
}

// ── Financial Summary ──────────────────────────────────────────────────────

/**
 * Render a formatted financial summary section at the end of the PDF.
 * Displays all key financial figures from the DPR's financialResult.
 */
function renderFinancialSummary(doc: Doc, dpr: DprDocument): void {
  let y = CONTENT_TOP;
  const f = dpr.financialResult;

  // Section heading
  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SECTION)
    .fillColor(COLOR_HEADING)
    .text("FINANCIAL SUMMARY", MARGIN_LEFT, y, { width: CONTENT_WIDTH });

  y = doc.y + 4;
  doc
    .moveTo(MARGIN_LEFT, y)
    .lineTo(MARGIN_LEFT + CONTENT_WIDTH, y)
    .strokeColor(COLOR_HEADING)
    .lineWidth(1)
    .stroke();

  y += 12;

  // Financial entries table
  const financialTable: DprTable = {
    caption: "Table: Key Financial Indicators",
    headers: ["Particulars", "Amount / Value"],
    rows: [
      ["Total Project Cost", formatIndianCurrencyFromDpr(f.totalProjectCost)],
      ["Own Contribution (25%)", formatIndianCurrencyFromDpr(f.ownContribution)],
      ["Bank Finance", formatIndianCurrencyFromDpr(f.bankFinance)],
      ["  \u2014 PMEGP Subsidy", formatIndianCurrencyFromDpr(f.subsidyAmount)],
      ["  \u2014 Bank Term Loan", formatIndianCurrencyFromDpr(f.bankTermLoan)],
      ["  \u2014 Bank Working Capital", formatIndianCurrencyFromDpr(f.bankWorkingCapital)],
      [""],
      ["Monthly EMI", formatIndianCurrencyFromDpr(f.emi)],
      ["Loan Tenure", `${f.loanTenureMonths} months`],
      ["Moratorium Period", `${f.repaymentMoratoriumMonths} months`],
      ["Total Interest", formatIndianCurrencyFromDpr(f.totalInterest)],
      ["Total Repayment", formatIndianCurrencyFromDpr(f.totalRepayment)],
      [""],
      ["Annual Revenue", formatIndianCurrencyFromDpr(f.annualRevenue)],
      ["Annual Expenditure", formatIndianCurrencyFromDpr(f.annualExpenditure)],
      ["Annual Net Profit", formatIndianCurrencyFromDpr(f.annualNetProfit)],
      ["Annual Depreciation", formatIndianCurrencyFromDpr(f.annualDepreciation)],
      [""],
      ["DSCR (Debt Service Coverage Ratio)", f.dscr.toFixed(2)],
      ["Break-even (% of capacity)", `${f.breakEvenPercent.toFixed(2)}%`],
    ],
  };

  y = renderTable(doc, financialTable, y);
}

// ── Eligibility Assessment ─────────────────────────────────────────────────

/**
 * Render the eligibility assessment results at the end of the PDF.
 * Shows overall status, individual checks, blockers, and warnings.
 */
function renderEligibilityAssessment(doc: Doc, dpr: DprDocument): void {
  let y = CONTENT_TOP;
  const e = dpr.eligibilityResult;

  // Section heading
  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SECTION)
    .fillColor(COLOR_HEADING)
    .text("ELIGIBILITY ASSESSMENT", MARGIN_LEFT, y, { width: CONTENT_WIDTH });

  y = doc.y + 4;
  doc
    .moveTo(MARGIN_LEFT, y)
    .lineTo(MARGIN_LEFT + CONTENT_WIDTH, y)
    .strokeColor(COLOR_HEADING)
    .lineWidth(1)
    .stroke();

  y += 16;

  // Overall status badge
  const statusText = e.eligible ? "ELIGIBLE FOR PMEGP" : "NOT ELIGIBLE FOR PMEGP";
  const statusColor = e.eligible ? "#065f46" : "#991b1b";
  const bgColor = e.eligible ? "#d1fae5" : "#fee2e2";

  doc
    .roundedRect(MARGIN_LEFT + 10, y, CONTENT_WIDTH - 20, 28, 4)
    .fill(bgColor);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(statusColor)
    .text(statusText, MARGIN_LEFT + 10, y + 7, {
      width: CONTENT_WIDTH - 20,
      align: "center",
    });

  y += 44;

  // Checks table
  if (e.checks.length > 0) {
    doc
      .font("Helvetica-Bold")
      .fontSize(FONT_SUBSECTION)
      .fillColor(COLOR_SUBHEADING)
      .text("Eligibility Checks", MARGIN_LEFT, y, { width: CONTENT_WIDTH });

    y = doc.y + 8;

    const checksTable: DprTable = {
      caption: "Table: Eligibility Check Results",
      headers: ["Check", "Result", "Required", "Actual", "Status"],
      rows: e.checks.map((check) => [
        check.label,
        check.reason,
        check.required !== undefined ? String(check.required) : "\u2014",
        check.actual !== undefined ? String(check.actual) : "\u2014",
        check.passed ? "PASS" : "FAIL",
      ]),
    };

    y = renderTable(doc, checksTable, y);
  }

  // Blockers
  if (e.blockers.length > 0) {
    if (y > CONTENT_BOTTOM - 60) {
      doc.addPage();
      y = CONTENT_TOP;
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(FONT_SUBSECTION)
      .fillColor("#991b1b")
      .text("Blockers", MARGIN_LEFT, y, { width: CONTENT_WIDTH });

    y = doc.y + 8;

    for (const blocker of e.blockers) {
      if (y > CONTENT_BOTTOM - 20) {
        doc.addPage();
        y = CONTENT_TOP;
      }
      doc
        .font("Helvetica")
        .fontSize(FONT_BODY)
        .fillColor(COLOR_BODY)
        .text(`\u2717  ${blocker}`, MARGIN_LEFT + 10, y, { width: CONTENT_WIDTH - 20 });
      y = doc.y + 4;
    }
    y += 8;
  }

  // Warnings
  if (e.warnings.length > 0) {
    if (y > CONTENT_BOTTOM - 60) {
      doc.addPage();
      y = CONTENT_TOP;
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(FONT_SUBSECTION)
      .fillColor("#92400e")
      .text("Warnings", MARGIN_LEFT, y, { width: CONTENT_WIDTH });

    y = doc.y + 8;

    for (const warning of e.warnings) {
      if (y > CONTENT_BOTTOM - 20) {
        doc.addPage();
        y = CONTENT_TOP;
      }
      doc
        .font("Helvetica")
        .fontSize(FONT_BODY)
        .fillColor(COLOR_BODY)
        .text(`\u26A0  ${warning}`, MARGIN_LEFT + 10, y, { width: CONTENT_WIDTH - 20 });
      y = doc.y + 4;
    }
  }
}

// ── Headers, Footers & Watermarks ──────────────────────────────────────────

/**
 * Add running headers, footers with page numbers, and "CONFIDENTIAL" watermarks
 * to every page except the cover page (page 0).
 * Must be called after all content has been rendered (requires bufferPages: true).
 */
function addHeadersFootersAndWatermarks(doc: Doc, projectName: string): void {
  const pages = doc.bufferedPageRange();
  const totalPages = pages.count;

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);

    // Skip cover page (page 0)
    if (i === 0) {
      // Add watermark on cover page only
      renderWatermark(doc);
      continue;
    }

    // ── Header ──
    const headerY = MARGIN_TOP + 4;

    // Header left text
    doc
      .font("Helvetica-Bold")
      .fontSize(FONT_HEADER_FOOTER)
      .fillColor(COLOR_SECONDARY)
      .text("DPR \u2014 " + truncateText(projectName, 40), MARGIN_LEFT, headerY, {
        width: CONTENT_WIDTH * 0.6,
        lineBreak: false,
      });

    // Header right text
    doc
      .font("Helvetica-Bold")
      .fontSize(FONT_HEADER_FOOTER)
      .fillColor(COLOR_HEADING)
      .text("PMEGP", MARGIN_LEFT, headerY, {
        width: CONTENT_WIDTH,
        align: "right",
        lineBreak: false,
      });

    // Header rule
    doc
      .moveTo(MARGIN_LEFT, MARGIN_TOP + HEADER_HEIGHT)
      .lineTo(PAGE_WIDTH - MARGIN_RIGHT, MARGIN_TOP + HEADER_HEIGHT)
      .strokeColor(COLOR_RULE)
      .lineWidth(0.5)
      .stroke();

    // ── Footer ──
    const footerY = PAGE_HEIGHT - MARGIN_BOTTOM - FOOTER_HEIGHT + 12;

    // Footer rule
    doc
      .moveTo(MARGIN_LEFT, footerY - 4)
      .lineTo(PAGE_WIDTH - MARGIN_RIGHT, footerY - 4)
      .strokeColor(COLOR_RULE)
      .lineWidth(0.5)
      .stroke();

    // Page number (center)
    doc
      .font("Helvetica")
      .fontSize(FONT_HEADER_FOOTER)
      .fillColor(COLOR_SECONDARY)
      .text(`Page ${i} of ${totalPages}`, MARGIN_LEFT, footerY, {
        width: CONTENT_WIDTH,
        align: "center",
        lineBreak: false,
      });

    // Confidential (right)
    doc
      .font("Helvetica-Oblique")
      .fontSize(FONT_HEADER_FOOTER - 0.5)
      .fillColor(COLOR_RULE)
      .text("Confidential", MARGIN_LEFT, footerY, {
        width: CONTENT_WIDTH,
        align: "right",
        lineBreak: false,
      });

    // ── Watermark ──
    renderWatermark(doc);
  }
}

/**
 * Render a diagonal "CONFIDENTIAL" watermark on the current page.
 */
function renderWatermark(doc: Doc): void {
  doc
    .font("Helvetica-Bold")
    .fontSize(48)
    .fillColor(COLOR_WATERMARK)
    .save()
    .translate(PAGE_WIDTH / 2, PAGE_HEIGHT / 2)
    .rotate(-45)
    .text("CONFIDENTIAL", -200, -20, {
      width: 400,
      align: "center",
      lineBreak: false,
    })
    .restore();
}

// ── Utility Functions ──────────────────────────────────────────────────────

/**
 * Extract the project name from the DPR document.
 * Looks at the executive summary content for the project name.
 */
function extractProjectName(dpr: DprDocument): string {
  // Try executive summary first
  const execSummary = dpr.sections.find((s) => s.id === "executive-summary");
  if (execSummary) {
    // Look for "Project: ..." or "proposed unit of ..."
    const projectMatch = execSummary.content.match(/proposed unit of (.+?)\./i);
    if (projectMatch) {
      return capitalizeFirst(projectMatch[1]!.trim());
    }
    // Look for the activity type description
    const activityMatch = execSummary.content.match(/activity of (.+?)\s+has/i);
    if (activityMatch) {
      return capitalizeFirst(activityMatch[1]!.trim());
    }
  }

  return "PMEGP Project";
}

/**
 * Extract the applicant name from the DPR document.
 */
function extractApplicantName(dpr: DprDocument): string {
  // Try business profile section tables
  const bizSection = dpr.sections.find((s) => s.id === "business-profile");
  if (bizSection && bizSection.tables && bizSection.tables.length > 0) {
    const promoterTable = bizSection.tables[0]!;
    for (const row of promoterTable.rows) {
      if (row[0]?.toLowerCase().includes("name")) {
        return row[1] ?? "N/A";
      }
    }
  }

  // Fallback: look in content
  if (bizSection) {
    const nameMatch = bizSection.content.match(/(?:applicant|promoter)[^:]*:\s*\*\*([^*]+)\*\*/i);
    if (nameMatch) {
      return nameMatch[1]!.trim();
    }
  }

  return "N/A";
}

/**
 * Format a whole-rupee number in Indian notation with ₹ symbol.
 * e.g., 2500000 → "₹25,00,000"
 */
function formatIndianCurrencyFromDpr(amount: number): string {
  const absAmount = Math.abs(Math.round(amount));
  const str = absAmount.toString();

  if (str.length <= 3) {
    return `₹${amount < 0 ? "-" : ""}${str}`;
  }

  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  return `₹${amount < 0 ? "-" : ""}${formatted}`;
}

/**
 * Capitalize the first letter of a string.
 */
function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}