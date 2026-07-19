// ─── Knowledge Package Loader ─────────────────────────────────────────
// Loads NIC code data from bundled JSON files. Singleton pattern —
// data is loaded once and cached in memory.
//
// All functions are synchronous (data is bundled, not fetched).
// See doc 09.
// ───────────────────────────────────────────────────────────────────────────

import type { NicCodeEntry, NicSector, NicCodeMetadata } from "./types";

import manufacturingData from "./data/nic_codes_manufacturing.json";
import serviceServiceData from "./data/nic_codes_service_service.json";
import serviceTradingData from "./data/nic_codes_service_trading.json";
import serviceTransportData from "./data/nic_codes_service_transport.json";
import metadataRaw from "./data/nic_codes_metadata.json";

// ── Singleton cache ───────────────────────────────────────────────────────

let allCodes: NicCodeEntry[] | null = null;
const metadata = metadataRaw as NicCodeMetadata;

function load(): NicCodeEntry[] {
  if (allCodes) return allCodes;

  const files = [
    manufacturingData,
    serviceServiceData,
    serviceTradingData,
    serviceTransportData,
  ];

  allCodes = files.flatMap((file) => file as NicCodeEntry[]);
  return allCodes;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Fuzzy search NIC codes by description.
 * Case-insensitive substring match on the description field.
 */
export function searchNicCodes(query: string): NicCodeEntry[] {
  const codes = load();
  const normalized = query.toLowerCase().trim();

  if (!normalized) return codes;

  return codes.filter((entry) =>
    entry.description.toLowerCase().includes(normalized)
  );
}

/**
 * Get a single NIC code entry by its 6-digit code.
 */
export function getNicCode(code: string): NicCodeEntry | undefined {
  const codes = load();
  return codes.find((entry) => entry.nicCode === code);
}

/**
 * Get all NIC codes for a given top-level sector type.
 */
export function getNicCodesByType(type: NicSector): NicCodeEntry[] {
  const codes = load();
  return codes.filter((entry) => entry.sector === type);
}

/**
 * Get the Knowledge Package metadata.
 */
export function getMetadata(): NicCodeMetadata {
  return metadata;
}

/**
 * Get the total number of NIC code entries loaded.
 */
export function getTotalCount(): number {
  return load().length;
}