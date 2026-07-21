// ─── Shared Formatting Helpers ──────────────────────────────────────────────
// Pure formatting functions shared by all feature screens.
// Indian-style currency / date / percent formatting — no locale dependencies
// beyond Intl.NumberFormat (used for date only).
//
// `formatINR` mirrors the integer-math implementation in pdf-engine so the UI
// and PDF show identical strings for the same number.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format an integer (whole rupees) in Indian comma grouping.
 *   1234567  → "12,34,567"
 *   5000000  → "50,00,000"
 *   500      → "500"
 *   -1234    → "-1,234"
 *
 * Prefix "₹" is included for display contexts; pass `withSymbol: false` for
 * bare numbers (e.g. inside table cells where the column header carries the
 * unit).
 */
export function formatINR(n: number, withSymbol = true): string {
  const negative = n < 0;
  const abs = Math.abs(Math.trunc(n));
  const digits = abs.toString();

  if (digits.length <= 3) {
    return (negative ? "-" : "") + (withSymbol ? "₹" : "") + digits;
  }

  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);

  const groups: string[] = [];
  let remaining = rest;
  while (remaining.length > 2) {
    groups.unshift(remaining.slice(-2));
    remaining = remaining.slice(0, -2);
  }
  if (remaining.length > 0) {
    groups.unshift(remaining);
  }

  return (
    (negative ? "-" : "") +
    (withSymbol ? "₹" : "") +
    groups.join(",") +
    "," +
    lastThree
  );
}

/**
 * Format a number with a fixed number of decimal places (e.g. DSCR 1.42,
 * break-even 67.83%). Trims trailing zeros via Number.toFixed when sensible
 * for display.
 */
export function formatNumber(n: number, decimals = 2): string {
  if (!isFinite(n)) return (0).toFixed(decimals);
  return n.toFixed(decimals);
}

/**
 * Format a 0-100 percentage value with the supplied decimals.
 */
export function formatPercent(n: number, decimals = 1): string {
  if (!isFinite(n)) return "0%";
  return `${n.toFixed(decimals)}%`;
}

/**
 * Format an ISO date string as "DD Mon YYYY" (e.g. "15 Jan 2025").
 * Falls back to the raw string when the input cannot be parsed.
 */
export function formatDate(iso: string | Date | undefined | null): string {
  if (iso === undefined || iso === null || iso === "") return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format an ISO date+time as "DD Mon YYYY, HH:MM" (24-hour, en-IN locale).
 */
export function formatDateTime(iso: string | Date | undefined | null): string {
  if (iso === undefined || iso === null || iso === "") return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Friendly label for a ProjectStatus enum value (used in dashboard badges
 * and project screens).
 */
export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    EMPTY: "Empty",
    PARTIAL: "In progress",
    DISCOVERING: "Discovering",
    COMPLETE: "Complete",
    REVIEW_PENDING: "Review pending",
    VALIDATED: "Validated",
    ELIGIBILITY_READY: "Eligibility checked",
    FINANCIAL_READY: "Financials ready",
    DPR_READY: "DPR ready",
  };
  return labels[status] ?? status;
}

/**
 * Tailwind class fragment for the visual variant of a ProjectStatus badge.
 */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "DPR_READY":
      return "bg-emerald-600 text-white border-transparent";
    case "FINANCIAL_READY":
      return "bg-emerald-500 text-white border-transparent";
    case "ELIGIBILITY_READY":
      return "bg-teal-600 text-white border-transparent";
    case "VALIDATED":
      return "bg-blue-600 text-white border-transparent";
    case "REVIEW_PENDING":
    case "COMPLETE":
      return "bg-amber-500 text-white border-transparent";
    case "DISCOVERING":
      return "bg-indigo-500 text-white border-transparent";
    case "PARTIAL":
      return "bg-orange-500 text-white border-transparent";
    case "EMPTY":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
