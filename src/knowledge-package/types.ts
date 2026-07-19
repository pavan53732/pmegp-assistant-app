// ─── Knowledge Package Types ─────────────────────────────────────────────
// Types specific to the Knowledge Package data.
// See doc 09.
// ───────────────────────────────────────────────────────────────────────────

export type NicSector = "MANUFACTURING" | "SERVICE";
export type NicSubCategory = "MANUFACTURING" | "SERVICE" | "TRADING" | "TRANSPORT";

export interface NicCodeEntry {
  nicCode: string;
  description: string;
  sector: NicSector;
  subCategory: NicSubCategory;
}

export interface NicCodeMetadata {
  source: string;
  dataVersion: string;
  description: string;
  sectorStructure: Record<string, string>;
  notes: string;
  files: Array<{
    filename: string;
    sector: NicSector;
    subCategory: NicSubCategory;
  }>;
  schema: {
    nicCode: string;
    description: string;
    sector: string;
    subCategory: string;
  };
}