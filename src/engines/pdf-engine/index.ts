// ─── PDF Engine ─────────────────────────────────────────────────────────────
// Converts a DprDocument into a structured plain-text document formatted for
// printing. Produces a UTF-8 encoded ArrayBuffer with:
//   - Project header, date, page breaks between sections
//   - Section titles and content
//   - Aligned column tables
//   - Indian currency formatting
//   - Page numbers
//
// Pure function — NO I/O, NO AI calls, NO side effects.
// ─────────────────────────────────────────────────────────────────────────────

import type { DprDocument, DprSection, DprTable } from "@/engines/dpr-engine";

// ── Constants ──────────────────────────────────────────────────────────────

const PAGE_WIDTH = 80;
const FOOTER_WIDTH = 72;

// ── Currency Helper ─────────────────────────────────────────────────────────

/** Format a whole-rupee number in Indian notation (e.g. "Rs. 25,00,000"). */
function formatIndianCurrency(amount: number): string {
  const str = Math.abs(Math.round(amount)).toString();
  if (str.length <= 3) return `Rs. ${amount.toLocaleString("en-IN")}`;
  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted =
    rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  return `Rs. ${amount < 0 ? "-" : ""}${formatted}`;
}

// ── Text Utilities ──────────────────────────────────────────────────────────

function repeatChar(ch: string, count: number): string {
  return ch.repeat(count);
}

function centerText(text: string, width: number): string {
  const pad = Math.max(0, (width - text.length) / 2);
  const left = Math.floor(pad);
  const right = Math.ceil(pad);
  return repeatChar(" ", left) + text + repeatChar(" ", right);
}

function padEnd(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + repeatChar(" ", width - text.length);
}

function padStart(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return repeatChar(" ", width - text.length) + text;
}

function wordWrap(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n\n+/);

  for (const para of paragraphs) {
    const rawLines = para.split("\n");
    for (const rawLine of rawLines) {
      if (rawLine.trim().length === 0) {
        lines.push("");
        continue;
      }
      // Handle markdown headings (###, ##, #)
      const headingMatch = rawLine.match(/^(#{1,3})\s+(.*)/);
      if (headingMatch) {
        lines.push("");
        lines.push(headingMatch[2].trim().toUpperCase());
        lines.push(repeatChar("-", Math.min(headingMatch[2].trim().length, maxWidth)));
        lines.push("");
        continue;
      }

      // Handle markdown bold (**text**)
      const cleaned = rawLine.replace(/\*\*/g, "");
      const words = cleaned.split(/\s+/).filter(Boolean);

      if (words.length === 0) {
        lines.push("");
        continue;
      }

      let currentLine = "";
      for (const word of words) {
        if (currentLine.length === 0) {
          currentLine = word;
        } else if (currentLine.length + 1 + word.length <= maxWidth) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    lines.push("");
  }

  return lines;
}

// ── Table Rendering ─────────────────────────────────────────────────────────

function renderTable(table: DprTable): string[] {
  const lines: string[] = [];
  const colCount = table.headers.length;
  if (colCount === 0) return lines;

  // Calculate column widths — first pass to measure content
  const widths: number[] = table.headers.map((h) => h.length);
  for (const row of table.rows) {
    for (let i = 0; i < colCount; i++) {
      const cellLen = (row[i] ?? "").length;
      if (cellLen > widths[i]) widths[i] = cellLen;
    }
  }

  // Cap total width to PAGE_WIDTH - 4 (margins)
  const totalWidth = widths.reduce((a, b) => a + b, 0) + (colCount - 1) * 3; // 3 = " | "
  const availableWidth = PAGE_WIDTH - 4;
  if (totalWidth > availableWidth) {
    const ratio = availableWidth / totalWidth;
    for (let i = 0; i < widths.length; i++) {
      widths[i] = Math.max(widths[i], Math.floor(widths[i] * ratio));
    }
  }

  // Render caption
  lines.push("");
  lines.push(table.caption);
  lines.push(repeatChar("-", Math.min(table.caption.length, PAGE_WIDTH - 4)));

  // Render separator
  function separator(): string {
    return "| " + widths.map((w) => repeatChar("-", w)).join(" | ") + " |";
  }

  // Render row
  function renderRow(cells: string[]): string {
    const parts: string[] = [];
    for (let i = 0; i < colCount; i++) {
      const cell = (cells[i] ?? "").trim();
      // Right-align if cell looks like a number
      const isNumber = /^[\d,.₹\sRs.\-]+$/.test(cell) && cell.replace(/[\d,.₹\sRs.\-]/g, "").length === 0;
      parts.push(isNumber ? padStart(cell, widths[i]) : padEnd(cell, widths[i]));
    }
    return "| " + parts.join(" | ") + " |";
  }

  lines.push(separator());
  lines.push(renderRow(table.headers));
  lines.push(separator());

  for (const row of table.rows) {
    lines.push(renderRow(row));
  }

  lines.push(separator());
  lines.push("");

  return lines;
}

// ── Financial Summary Table ─────────────────────────────────────────────────

function renderFinancialSummary(dpr: DprDocument): string[] {
  const f = dpr.financialResult;
  const lines: string[] = [];

  lines.push("");
  lines.push("FINANCIAL SUMMARY".toUpperCase());
  lines.push(repeatChar("=", 40));
  lines.push("");

  const entries: [string, number][] = [
    ["Total Project Cost", f.totalProjectCost],
    ["Own Contribution (25%)", f.ownContribution],
    ["Bank Finance", f.bankFinance],
    ["  - Subsidy Amount", f.subsidyAmount],
    ["  - Bank Term Loan", f.bankTermLoan],
    ["  - Bank Working Capital", f.bankWorkingCapital],
    ["", 0],
    ["Monthly EMI", f.emi],
    ["Loan Tenure (months)", f.loanTenureMonths],
    ["Total Interest", f.totalInterest],
    ["Total Repayment", f.totalRepayment],
    ["", 0],
    ["Annual Revenue", f.annualRevenue],
    ["Annual Expenditure", f.annualExpenditure],
    ["Annual Net Profit", f.annualNetProfit],
    ["", 0],
    ["DSCR", 0], // ratio, handled separately
    ["Break-Even (%)", 0], // percent, handled separately
  ];

  const labelWidth = 30;
  for (const [label, value] of entries) {
    if (label === "") {
      lines.push("");
      continue;
    }
    if (label === "DSCR") {
      lines.push(padEnd(label, labelWidth) + f.dscr.toFixed(2));
    } else if (label === "Break-Even (%)") {
      lines.push(padEnd(label, labelWidth) + f.breakEvenPercent.toFixed(1) + "%");
    } else if (label === "Loan Tenure (months)") {
      lines.push(padEnd(label, labelWidth) + String(value));
    } else {
      lines.push(padEnd(label, labelWidth) + formatIndianCurrency(value));
    }
  }

  lines.push("");

  return lines;
}

// ── Eligibility Summary ─────────────────────────────────────────────────────

function renderEligibilitySummary(dpr: DprDocument): string[] {
  const e = dpr.eligibilityResult;
  const lines: string[] = [];

  lines.push("");
  lines.push("ELIGIBILITY ASSESSMENT".toUpperCase());
  lines.push(repeatChar("=", 40));
  lines.push("");

  lines.push("Overall Status: " + (e.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"));
  lines.push("");

  if (e.checks.length > 0) {
    lines.push("Checks:");
    for (const check of e.checks) {
      const icon = check.passed ? "[PASS]" : "[FAIL]";
      const detail = check.required !== undefined
        ? ` (required: ${check.required}, actual: ${check.actual ?? "N/A"})`
        : "";
      lines.push(`  ${icon} ${check.label}${detail}`);
    }
    lines.push("");
  }

  if (e.blockers.length > 0) {
    lines.push("Blockers:");
    for (const b of e.blockers) {
      lines.push(`  - ${b}`);
    }
    lines.push("");
  }

  if (e.warnings.length > 0) {
    lines.push("Warnings:");
    for (const w of e.warnings) {
      lines.push(`  - ${w}`);
    }
    lines.push("");
  }

  return lines;
}

// ── Page Numbering ──────────────────────────────────────────────────────────

function addPageNumbers(allLines: string[]): string[] {
  const PAGE_HEIGHT = 60; // lines per page
  const pages: string[] = [];
  let currentPage: string[] = [];

  for (const line of allLines) {
    currentPage.push(line);
    if (currentPage.length >= PAGE_HEIGHT) {
      pages.push(currentPage.join("\n"));
      currentPage = [];
    }
  }
  if (currentPage.length > 0) {
    pages.push(currentPage.join("\n"));
  }

  const totalPages = pages.length;
  const result: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) result.push("\f"); // form feed = page break
    result.push(pages[i]);
    const pageNum = `Page ${i + 1} of ${totalPages}`;
    result.push(repeatChar(" ", FOOTER_WIDTH - pageNum.length) + pageNum);
  }

  return result;
}

// ── Main Document Assembly ──────────────────────────────────────────────────

function assembleDocument(dpr: DprDocument): string[] {
  const lines: string[] = [];

  // ── Header ──
  const title = "DETAILED PROJECT REPORT";
  const subtitle = "PMEGP — Prime Minister's Employment Generation Programme";
  const date = new Date(dpr.generatedAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  lines.push(repeatChar("=", PAGE_WIDTH));
  lines.push(centerText(title, PAGE_WIDTH));
  lines.push(centerText(subtitle, PAGE_WIDTH));
  lines.push(centerText(`Date: ${date}`, PAGE_WIDTH));
  lines.push(repeatChar("=", PAGE_WIDTH));
  lines.push("");

  // ── Sections ──
  const sortedSections = [...dpr.sections].sort((a, b) => a.order - b.order);

  for (let si = 0; si < sortedSections.length; si++) {
    const section = sortedSections[si];

    // Page break before each section (except the first)
    if (si > 0) {
      lines.push("\f");
    }

    // Section title
    lines.push(centerText(section.title.toUpperCase(), PAGE_WIDTH));
    lines.push(repeatChar("-", PAGE_WIDTH));
    lines.push("");

    // Section content
    const contentLines = wordWrap(section.content, PAGE_WIDTH - 4);
    lines.push(...contentLines);

    // Section tables
    if (section.tables && section.tables.length > 0) {
      for (const table of section.tables) {
        lines.push(...renderTable(table));
      }
    }
  }

  // ── Financial Summary ──
  lines.push("\f");
  lines.push(...renderFinancialSummary(dpr));

  // ── Eligibility Summary ──
  lines.push(...renderEligibilitySummary(dpr));

  // ── Footer info ──
  lines.push(repeatChar("=", PAGE_WIDTH));
  lines.push(centerText(`Generated: ${dpr.generatedAt}`, PAGE_WIDTH));
  lines.push(centerText(`Word Count: ${dpr.wordCount}`, PAGE_WIDTH));
  lines.push(repeatChar("=", PAGE_WIDTH));

  return lines;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert a DprDocument into a well-formatted plain-text ArrayBuffer (UTF-8).
 * Suitable for printing or saving as a .txt file.
 */
export function generatePdf(dpr: DprDocument): ArrayBuffer {
  const allLines = assembleDocument(dpr);
  const numberedLines = addPageNumbers(allLines);
  const text = numberedLines.join("\n") + "\n";
  return new TextEncoder().encode(text).buffer;
}

/**
 * Generate the text representation and signal readiness for printing.
 * In a browser environment, this would trigger window.print().
 * In this environment, it generates the text and logs a message.
 */
export function printDpr(dpr: DprDocument): void {
  const _buffer = generatePdf(dpr);
  // In a browser environment, this would call window.print()
  // Here we generate the text to verify it's ready for printing
  console.log("[PDF Engine] DPR text document generated and ready for printing.");
}