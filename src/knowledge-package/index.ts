// ─── Knowledge Package Public API ────────────────────────────────────
// Import from here for all Knowledge Package access.
// ───────────────────────────────────────────────────────────────────────────

export {
  searchNicCodes,
  getNicCode,
  getNicCodesByType,
  getMetadata,
  getTotalCount,
} from "./loader";

export type {
  NicCodeEntry,
  NicSector,
  NicSubCategory,
  NicCodeMetadata,
} from "./types";