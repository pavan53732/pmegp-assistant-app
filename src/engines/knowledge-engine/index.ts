// ─── Knowledge Engine ─────────────────────────────────────────────────────────
// Serves reference data from the Knowledge Package.
// Pure business logic — NO UI, NO AI, NO I/O side effects.
// "AI never computes" — this engine provides data, not calculations.
// All suggestions come from bundled data. AI-generated suggestions are PROHIBITED.
// ───────────────────────────────────────────────────────────────────────────────

import type {
  ActivityType,
  ApplicantCategory,
  UrbanRural,
} from "../../shared/types/project-profile";
import type { NicSector, NicSubCategory } from "../../knowledge-package/types";
import { searchNicCodes, getNicCode } from "../../knowledge-package/loader";

// ── Data Imports (bundled JSON — loaded synchronously) ───────────────────────

import subsidyMatrixData from "../../knowledge-package/data/pmegp_subsidy_matrix.json";
import negativeListData from "../../knowledge-package/data/pmegp_negative_list.json";
import machineryCatalogData from "../../knowledge-package/data/pmegp_machinery_catalog.json";
import rawMaterialsCatalogData from "../../knowledge-package/data/pmegp_raw_materials.json";
import activityDefaultsData from "../../knowledge-package/data/pmegp_activity_defaults.json";
import locationData from "../../knowledge-package/data/pmegp_location_data.json";

// ── Public Types ─────────────────────────────────────────────────────────────

export interface ActivitySuggestion {
  nicCode: string;
  description: string;
  sector: NicSector;
  subCategory: NicSubCategory;
  matchScore: number; // 0–1 relevance
  matchReason: string;
}

export interface MachinerySuggestion {
  name: string;
  specification?: string;
  typicalQuantity: number;
  estimatedUnitCost: number;
  estimatedUnitCostRange: [number, number]; // [min, max] in rupees
  isEssential: boolean;
  category: string; // "PRIMARY", "SECONDARY", "ANCILLARY"
}

export interface RawMaterialSuggestion {
  name: string;
  specification?: string;
  typicalMonthlyQuantity: number;
  unit: string;
  estimatedUnitRate: number;
  estimatedUnitRateRange: [number, number]; // [min, max] in rupees
}

export interface EmployeeSuggestion {
  role: string;
  category: "SKILLED" | "UNSKILLED" | "ADMINISTRATIVE";
  typicalCount: { min: number; max: number };
  estimatedMonthlyWage: number;
  estimatedMonthlyWageRange: [number, number]; // [min, max] in rupees
}

export interface UtilitySuggestion {
  type: string; // "POWER", "WATER", "RENT", etc.
  description: string;
  estimatedMonthlyCost: number;
  estimatedMonthlyCostRange: [number, number]; // [min, max] in rupees
}

export interface CapacitySuggestion {
  unit: string; // e.g. "kg/month", "units/month"
  typicalRange: { min: number; max: number };
  capacityUtilPercent: number; // typical 60–80
}

export interface MarketSuggestion {
  targetMarket: string;
  competitionLevel: "LOW" | "MEDIUM" | "HIGH";
  sellingPriceUnit?: string;
}

export interface ProjectSizeSuggestion {
  totalProjectCostRange: [number, number]; // [min, max] in rupees
  subsidyRate: number;
  bankFinancePercent: number;
  ownContributionPercent: number;
  recommendedCeiling: number; // ₹25L or ₹50L
}

export interface NegativeListEntry {
  nicCode: string;
  description: string;
  reason: string;
}

export interface SubsidyInfo {
  subsidyRate: number;
  maxProjectCost: number;
  ownContributionPercent: number;
  category: string;
  isSpecial: boolean;
}

export interface LocationInfo {
  isAspirationalDistrict: boolean;
  isHillBorderArea: boolean;
  suggestedIndustries: string[];
}

// ── Internal: Type assertions for JSON imports ───────────────────────────────

interface MachineryCatalogItem {
  name: string;
  specification?: string;
  typicalQuantity: number;
  estimatedUnitCost: number;
  unitCostRange: number[]; // JSON arrays are not tuples; cast when mapping
  isEssential: boolean;
  category: string;
}

interface MachineryCatalogEntry {
  nicPrefix: string;
  industryName: string;
  machinery: MachineryCatalogItem[];
}

interface RawMaterialCatalogItem {
  name: string;
  specification?: string;
  typicalMonthlyQuantity: number;
  unit: string;
  estimatedUnitRate: number;
  unitRateRange: number[]; // JSON arrays are not tuples; cast when mapping
}

interface RawMaterialCatalogEntry {
  nicPrefix: string;
  industryName: string;
  rawMaterials: RawMaterialCatalogItem[];
}

interface EmployeeDefaults {
  min: number;
  max: number;
  estimatedMonthlyWage: number;
  wageRange: [number, number];
}

interface UtilityDefaults {
  estimatedMonthlyCost: number;
  costRange: [number, number];
  description: string;
}

interface ActivityDefaultsEntry {
  nicPrefix: string;
  industryName: string;
  sector: string;
  employees: {
    skilled: EmployeeDefaults;
    unskilled: EmployeeDefaults;
    administrative: EmployeeDefaults;
  };
  utilities: Record<string, UtilityDefaults>;
  capacity: {
    unit: string;
    typicalRange: { min: number; max: number };
    capacityUtilPercent: number;
    workingDaysPerMonth: number;
    workingHoursPerDay: number;
    shifts: number;
  };
  market: {
    typicalTargetMarkets: string[];
    competitionLevel: string;
    sellingPriceUnit: string;
  };
  projectSize: {
    small: { range: [number, number]; description: string };
    medium: { range: [number, number]; description: string };
    large: { range: [number, number]; description: string };
  };
  synonyms: string[];
}

// ── Singleton caches ─────────────────────────────────────────────────────────

let _machineryCatalog: Record<string, MachineryCatalogEntry> | null = null;
let _rawMaterialsCatalog: Record<string, RawMaterialCatalogEntry> | null = null;
let _activityDefaults: Record<string, ActivityDefaultsEntry> | null = null;
let _negativeListNics: Set<string> | null = null;
let _negativeKeywords: string[] | null = null;
let _aspirationalDistricts: Set<string> | null = null;
let _hillBorderStates: Record<string, { isHillBorder: boolean; allDistricts: boolean; districts?: string[] }> | null = null;

function getMachineryCatalog(): Record<string, MachineryCatalogEntry> {
  if (!_machineryCatalog) {
    _machineryCatalog = (machineryCatalogData as unknown as { catalog: Record<string, MachineryCatalogEntry> }).catalog;
  }
  return _machineryCatalog;
}

function getRawMaterialsCatalog(): Record<string, RawMaterialCatalogEntry> {
  if (!_rawMaterialsCatalog) {
    _rawMaterialsCatalog = (rawMaterialsCatalogData as unknown as { catalog: Record<string, RawMaterialCatalogEntry> }).catalog;
  }
  return _rawMaterialsCatalog;
}

function getActivityDefaults(): Record<string, ActivityDefaultsEntry> {
  if (!_activityDefaults) {
    _activityDefaults = (activityDefaultsData as unknown as { activities: Record<string, ActivityDefaultsEntry> }).activities;
  }
  return _activityDefaults;
}

function getNegativeListNics(): Set<string> {
  if (!_negativeListNics) {
    const data = negativeListData as { excludedActivities: Array<{ nicCode: string; description: string; reason: string }>; keywordPatterns?: string[] };
    _negativeListNics = new Set(data.excludedActivities.map(e => e.nicCode));
    _negativeKeywords = data.keywordPatterns ?? [];
  }
  return _negativeListNics!;
}

function getNegativeKeywords(): string[] {
  if (!_negativeKeywords) getNegativeListNics(); // loads both
  return _negativeKeywords!;
}

function getAspirationalDistricts(): Set<string> {
  if (!_aspirationalDistricts) {
    const data = locationData as { aspirationalDistricts: string[] };
    _aspirationalDistricts = new Set(data.aspirationalDistricts.map(d => d.toLowerCase()));
  }
  return _aspirationalDistricts;
}

function getHillBorderStates() {
  if (!_hillBorderStates) {
    const data = locationData as unknown as { hillBorderStates: Record<string, { isHillBorder: boolean; allDistricts: boolean; districts?: string[] }> };
    _hillBorderStates = data.hillBorderStates;
  }
  return _hillBorderStates;
}

// ── Synonym Expansion ────────────────────────────────────────────────────────

/**
 * Build a synonym map from activity defaults data.
 * Maps synonym → canonical NIC prefix.
 */
function getSynonymMap(): Map<string, string> {
  const map = new Map<string, string>();
  const defaults = getActivityDefaults();
  for (const [prefix, entry] of Object.entries(defaults)) {
    // Map the industry name itself
    map.set(entry.industryName.toLowerCase(), prefix);
    // Map all synonyms
    for (const syn of entry.synonyms) {
      map.set(syn.toLowerCase(), prefix);
    }
  }
  return map;
}

// ── Helper: Extract 2-digit NIC prefix ───────────────────────────────────────

function extractNicPrefix(nicCode: string): string {
  const digits = nicCode.replace(/[^0-9]/g, "");
  // Knowledge datasets use 4-digit keys (e.g. "1010", "1410")
  // Fall back to 2-digit if the code is shorter
  return digits.length >= 4 ? digits.substring(0, 4) : digits.substring(0, 2);
}

// ── Helper: Fuzzy match score (0–1) ──────────────────────────────────────────

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (t === q) return 1.0;
  if (t.includes(q)) return 0.85;
  if (q.includes(t) && t.length >= 3) return 0.75;
  // Word overlap
  const qWords = new Set(q.split(/\s+/));
  const tWords = new Set(t.split(/\s+/));
  let overlap = 0;
  for (const w of qWords) { if (tWords.has(w)) overlap++; }
  const union = new Set([...qWords, ...tWords]).size;
  return union > 0 ? overlap / union * 0.7 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve a user's activity description to matching NIC codes.
 * Uses synonym expansion + NIC code description search.
 *
 * Pure function — synchronous, no I/O.
 */
export function resolveActivity(query: string): ActivitySuggestion[] {
  if (!query || !query.trim()) return [];

  const results: ActivitySuggestion[] = [];
  const seen = new Set<string>();
  const synonymMap = getSynonymMap();
  const q = query.toLowerCase().trim();

  // 1. Check synonym map for direct NIC prefix match
  for (const [synonym, prefix] of synonymMap) {
    if (q === synonym || q.includes(synonym) || synonym.includes(q)) {
      // Find all NIC codes starting with this prefix
      const matches = searchNicCodes(prefix.padEnd(2, "0"));
      for (const entry of matches) {
        if (!seen.has(entry.nicCode)) {
          seen.add(entry.nicCode);
          results.push({
            nicCode: entry.nicCode,
            description: entry.description,
            sector: entry.sector,
            subCategory: entry.subCategory,
            matchScore: q === synonym ? 0.95 : 0.8,
            matchReason: `Matched via synonym "${synonym}" → NIC ${prefix}xx`,
          });
        }
      }
      // Also include the activity defaults name
      const defaults = getActivityDefaults()[prefix];
      if (defaults && !seen.has(prefix)) {
        seen.add(prefix);
        results.push({
          nicCode: prefix.padEnd(2, "0"),
          description: defaults.industryName,
          sector: (defaults.sector as NicSector) || "MANUFACTURING",
          subCategory: (defaults.sector as NicSubCategory) || "MANUFACTURING",
          matchScore: q === synonym ? 0.95 : 0.8,
          matchReason: `Matched via synonym "${synonym}" → ${defaults.industryName}`,
        });
      }
    }
  }

  // 2. Search NIC code descriptions
  const nicMatches = searchNicCodes(query);
  for (const entry of nicMatches) {
    if (!seen.has(entry.nicCode)) {
      seen.add(entry.nicCode);
      const score = fuzzyScore(query, entry.description);
      if (score > 0.1) {
        results.push({
          nicCode: entry.nicCode,
          description: entry.description,
          sector: entry.sector,
          subCategory: entry.subCategory,
          matchScore: score,
          matchReason: `Description match: "${entry.description}"`,
        });
      }
    }
  }

  // 3. Sort by match score descending, take top 20
  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, 20);
}

/**
 * Suggest machinery items for a given NIC code.
 * Returns typical machinery list with estimated costs.
 */
export function suggestMachinery(nicCode: string): MachinerySuggestion[] {
  const prefix = extractNicPrefix(nicCode);
  const catalog = getMachineryCatalog();
  const entry = catalog[prefix];

  if (!entry) return [];

  return entry.machinery.map(item => ({
    name: item.name,
    specification: item.specification,
    typicalQuantity: item.typicalQuantity,
    estimatedUnitCost: item.estimatedUnitCost,
    estimatedUnitCostRange: item.unitCostRange as [number, number],
    isEssential: item.isEssential,
    category: item.category,
  }));
}

/**
 * Suggest raw materials for a given NIC code.
 */
export function suggestRawMaterials(nicCode: string): RawMaterialSuggestion[] {
  const prefix = extractNicPrefix(nicCode);
  const catalog = getRawMaterialsCatalog();
  const entry = catalog[prefix];

  if (!entry) return [];

  return entry.rawMaterials.map(item => ({
    name: item.name,
    specification: item.specification,
    typicalMonthlyQuantity: item.typicalMonthlyQuantity,
    unit: item.unit,
    estimatedUnitRate: item.estimatedUnitRate,
    estimatedUnitRateRange: item.unitRateRange as [number, number],
  }));
}

/**
 * Suggest employee structure for a given NIC code.
 * Returns skilled, unskilled, and administrative staff suggestions.
 */
export function suggestEmployees(
  nicCode: string,
  _projectScale?: "SMALL" | "MEDIUM" | "LARGE"
): EmployeeSuggestion[] {
  const prefix = extractNicPrefix(nicCode);
  const defaults = getActivityDefaults();
  const entry = defaults[prefix];

  if (!entry) return [];

  const suggestions: EmployeeSuggestion[] = [];

  // Skilled workers
  suggestions.push({
    role: "Skilled Worker / Technician",
    category: "SKILLED",
    typicalCount: { min: entry.employees.skilled.min, max: entry.employees.skilled.max },
    estimatedMonthlyWage: entry.employees.skilled.estimatedMonthlyWage,
    estimatedMonthlyWageRange: entry.employees.skilled.wageRange,
  });

  // Unskilled workers
  suggestions.push({
    role: "Unskilled Helper / Labour",
    category: "UNSKILLED",
    typicalCount: { min: entry.employees.unskilled.min, max: entry.employees.unskilled.max },
    estimatedMonthlyWage: entry.employees.unskilled.estimatedMonthlyWage,
    estimatedMonthlyWageRange: entry.employees.unskilled.wageRange,
  });

  // Administrative
  suggestions.push({
    role: "Administrative / Accounts",
    category: "ADMINISTRATIVE",
    typicalCount: { min: entry.employees.administrative.min, max: entry.employees.administrative.max },
    estimatedMonthlyWage: entry.employees.administrative.estimatedMonthlyWage,
    estimatedMonthlyWageRange: entry.employees.administrative.wageRange,
  });

  return suggestions;
}

/**
 * Suggest utility/overhead costs for a given NIC code.
 */
export function suggestUtilities(nicCode: string): UtilitySuggestion[] {
  const prefix = extractNicPrefix(nicCode);
  const defaults = getActivityDefaults();
  const entry = defaults[prefix];

  if (!entry) return [];

  const utilityLabels: Record<string, string> = {
    power: "POWER",
    water: "WATER",
    rent: "RENT",
    transport: "TRANSPORT",
    communication: "COMMUNICATION",
    insurance: "INSURANCE",
    maintenance: "MAINTENANCE",
    miscellaneous: "MISCELLANEOUS",
  };

  return Object.entries(entry.utilities).map(([key, val]) => ({
    type: utilityLabels[key] ?? key.toUpperCase(),
    description: val.description,
    estimatedMonthlyCost: val.estimatedMonthlyCost,
    estimatedMonthlyCostRange: val.costRange,
  }));
}

/**
 * Suggest capacity parameters for a given NIC code.
 */
export function suggestCapacity(nicCode: string): CapacitySuggestion {
  const prefix = extractNicPrefix(nicCode);
  const defaults = getActivityDefaults();
  const entry = defaults[prefix];

  if (!entry) {
    return { unit: "units/month", typicalRange: { min: 100, max: 1000 }, capacityUtilPercent: 70 };
  }

  return {
    unit: entry.capacity.unit,
    typicalRange: entry.capacity.typicalRange,
    capacityUtilPercent: entry.capacity.capacityUtilPercent,
  };
}

/**
 * Suggest market parameters for a given NIC code and optional location.
 */
export function suggestMarket(
  nicCode: string,
  _location?: { state: string; district: string }
): MarketSuggestion[] {
  const prefix = extractNicPrefix(nicCode);
  const defaults = getActivityDefaults();
  const entry = defaults[prefix];

  if (!entry) return [];

  return entry.market.typicalTargetMarkets.map(market => ({
    targetMarket: market,
    competitionLevel: (entry.market.competitionLevel as "LOW" | "MEDIUM" | "HIGH") ?? "MEDIUM",
    sellingPriceUnit: entry.market.sellingPriceUnit || undefined,
  }));
}

/**
 * Suggest project size parameters based on activity type, category, and area.
 */
export function suggestProjectSize(
  activityType: ActivityType,
  category: ApplicantCategory,
  area: UrbanRural
): ProjectSizeSuggestion {
  const specialCategories = new Set<string>([
    "SC", "ST", "OBC", "MINORITY", "EX_SERVICEMEN", "PH", "NER",
  ]);
  const isSpecial = specialCategories.has(category);

  // Subsidy rate from matrix
  let subsidyRate: number;
  let ownContributionPercent: number;
  let recommendedCeiling: number;

  if (isSpecial) {
    subsidyRate = area === "RURAL" ? 35 : 25;
    ownContributionPercent = 5;
    recommendedCeiling = 5000000;
  } else {
    subsidyRate = area === "RURAL" ? 25 : 15;
    ownContributionPercent = 10;
    recommendedCeiling = activityType === "MANUFACTURING" ? 5000000 : 2500000;
  }

  // Use the smaller of the scheme ceiling and activity-type ceiling
  const maxCost = Math.min(recommendedCeiling, activityType === "MANUFACTURING" ? 5000000 : 2500000);

  // Typical project sizes for micro enterprises
  const bankFinancePercent = 60; // typical

  return {
    totalProjectCostRange: [100000, maxCost],
    subsidyRate,
    bankFinancePercent,
    ownContributionPercent,
    recommendedCeiling: maxCost,
  };
}

/**
 * Check if a NIC code is on the negative list.
 */
export function isOnNegativeList(nicCode: string): NegativeListEntry | null {
  const prefix = extractNicPrefix(nicCode);
  const data = negativeListData as { excludedActivities: Array<{ nicCode: string; description: string; reason: string }> };

  // Exact NIC code match
  const exact = data.excludedActivities.find(
    (e) => e.nicCode && e.nicCode === nicCode
  );
  if (exact) return exact;

  // 4-digit prefix match
  const prefixMatch = data.excludedActivities.find(
    (e) => e.nicCode && e.nicCode.startsWith(prefix)
  );
  if (prefixMatch) return prefixMatch;

  return null;
}

/**
 * Check if a description matches any negative list keyword.
 */
export function matchesNegativeKeyword(description: string): string | null {
  const keywords = getNegativeKeywords();
  const lower = description.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

/**
 * Get subsidy information for a given category and area.
 */
export function getSubsidyInfo(
  category: ApplicantCategory,
  area: UrbanRural,
  isWomen: boolean = false,
  isHillBorderArea: boolean = false
): SubsidyInfo {
  const specialCategories = new Set<string>([
    "SC", "ST", "OBC", "MINORITY", "EX_SERVICEMEN", "PH", "NER",
  ]);
  const isSpecial = specialCategories.has(category) || isWomen || isHillBorderArea;

  let subsidyRate: number;
  let maxProjectCost: number;
  let ownContributionPercent: number;

  if (isSpecial) {
    subsidyRate = area === "RURAL" ? 35 : 25;
    maxProjectCost = 5000000;
    ownContributionPercent = 5;
  } else {
    subsidyRate = area === "RURAL" ? 25 : 15;
    maxProjectCost = 2500000;
    ownContributionPercent = 10;
  }

  return {
    subsidyRate,
    maxProjectCost,
    ownContributionPercent,
    category: isSpecial ? "SPECIAL" : "GENERAL",
    isSpecial,
  };
}

/**
 * Get location-aware information for a given state and district.
 */
export function getLocationInfo(
  state: string,
  district: string
): LocationInfo {
  const aspirational = getAspirationalDistricts();
  const hillBorder = getHillBorderStates();

  const isAspirationalDistrict = aspirational.has(district.toLowerCase().trim());

  let isHillBorderArea = false;
  const stateEntry = hillBorder[state];
  if (stateEntry?.isHillBorder) {
    if (stateEntry.allDistricts) {
      isHillBorderArea = true;
    } else if (stateEntry.districts) {
      isHillBorderArea = stateEntry.districts.some(
        d => d.toLowerCase() === district.toLowerCase().trim()
      );
    }
  }

  const locData = locationData as { stateIndustries: Record<string, string[]> };
  const suggestedIndustries = locData.stateIndustries[state] ?? [];

  return {
    isAspirationalDistrict,
    isHillBorderArea,
    suggestedIndustries,
  };
}

/**
 * Get all project size suggestions for a given NIC prefix.
 * Returns small/medium/large ranges from activity defaults.
 */
export function getProjectSizeOptions(nicCode: string): {
  small: { range: [number, number]; description: string };
  medium: { range: [number, number]; description: string };
  large: { range: [number, number]; description: string };
} | null {
  const prefix = extractNicPrefix(nicCode);
  const defaults = getActivityDefaults();
  const entry = defaults[prefix];
  return entry?.projectSize ?? null;
}

/**
 * Get default working parameters for a given NIC code.
 */
export function getWorkingDefaults(nicCode: string): {
  workingDaysPerMonth: number;
  workingHoursPerDay: number;
  shifts: number;
} {
  const prefix = extractNicPrefix(nicCode);
  const defaults = getActivityDefaults();
  const entry = defaults[prefix];

  if (!entry) {
    return { workingDaysPerMonth: 25, workingHoursPerDay: 8, shifts: 1 };
  }

  return {
    workingDaysPerMonth: entry.capacity.workingDaysPerMonth,
    workingHoursPerDay: entry.capacity.workingHoursPerDay,
    shifts: entry.capacity.shifts,
  };
}

/**
 * Get the full negative list.
 */
export function getNegativeList(): NegativeListEntry[] {
  const data = negativeListData as { excludedActivities: Array<{ nicCode: string; description: string; reason: string }> };
  return data.excludedActivities.map(e => ({ nicCode: e.nicCode, description: e.description, reason: e.reason }));
}

/**
 * Get typical interest rate and repayment period ranges from scheme notes.
 */
export function getSchemeDefaults(): {
  interestRateRange: [number, number];
  repaymentPeriodRange: [number, number];
  moratoriumMonths: number;
  bankFinanceRange: [number, number];
  manufacturingCeiling: number;
  serviceCeiling: number;
} {
  const data = subsidyMatrixData as { notes: Record<string, unknown> };
  const notes = data.notes;
  return {
    interestRateRange: (notes.interestRateTypicalRange as [number, number]) ?? [8, 12],
    repaymentPeriodRange: (notes.repaymentPeriodRange as [number, number]) ?? [3, 7],
    moratoriumMonths: (notes.moratoriumMonths as number) ?? 6,
    bankFinanceRange: (notes.bankFinanceRange as [number, number]) ?? [55, 65],
    manufacturingCeiling: (notes.manufacturingCeiling as number) ?? 5000000,
    serviceCeiling: (notes.serviceCeiling as number) ?? 2500000,
  };
}

// ── Scheme Parameters (re-export for engine consumption) ──────────────────
export * from './scheme-params';
