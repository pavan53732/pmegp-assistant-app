// ─── Import / Export Engine ────────────────────────────────────────────────
// Serializes a single project's data (profile + computed financials +
// eligibility snapshot + attachment list) into a portable JSON envelope, and
// provides full-database encrypted backup / restore.
//
// Boundary-safe (doc 02 / doc 14 §7): imports only from `@/shared/*`,
// `@/engines/*`, `@/database/*`. NEVER imports from `@/features/*` or
// `@/providers/*`.
//
// Determinism note (doc 02): `exportedAt` and `backupDatabase`'s `createdAt`
// use `new Date()` — these are *metadata timestamps*, not calculations. All
// other fields are pass-through snapshots of already-computed data. For the
// SAME input at the SAME wall-clock instant, output is identical.
//
// Security note: the AI provider API key lives ONLY in Secure Storage
// (Android Keystore) — it is never present in the `ai_provider_config` table
// (which stores only base_url / model_name / is_active / updated_at) and is
// therefore never present in an export or a backup.
// ───────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import type { ProjectProfile } from "@/shared/types/project-profile";
import type { FinancialResult } from "@/engines/financial-engine";
import type { EligibilityResult } from "@/engines/eligibility-engine";
import { getDB } from "@/database/sqlite";
import type {
  ProjectRow,
  AiProviderConfigRow,
  AppMetaRow,
} from "@/database/sqlite";

// ── Public types ──────────────────────────────────────────────────────────

/**
 * Lightweight attachment reference carried in an export envelope.
 *
 * Defined locally (rather than imported from `@/features/*` or even from
 * `@/shared/types/project-profile`, whose `AttachmentRef` carries richer
 * OCR / linkage fields) because the export envelope only needs identity +
 * filename + mime — and because engines must not pull types from the features
 * layer. The caller is responsible for projecting the richer attachment model
 * down to this shape before calling `exportProject`.
 */
export interface AttachmentRef {
  id: string;
  /** Free-form string (e.g. "QUOTATION", "IDENTITY_PROOF") — not the enum. */
  type: string;
  filename: string;
  mimeType: string;
}

export interface ExportProjectResult {
  schemaVersion: "1.0";
  schemeCode: "PMEGP";
  knowledgeVersion: string;
  exportedAt: string;
  project: ProjectProfile;
  financialsSnapshot: FinancialResult;
  eligibilitySnapshot: EligibilityResult;
  attachments: AttachmentRef[];
}

// ── Backup key management ─────────────────────────────────────────────────
//
// Engines must NOT touch Secure Storage (the encryption key lives in the
// platform keystore and is surfaced by the features/providers layer — touching
// it from engines would violate the architecture boundary in doc 02). The
// host application calls `setBackupKey()` once at startup with a `CryptoKey`
// (AES-256-GCM, 256-bit) that it loaded from Secure Storage.

let _backupKey: CryptoKey | null = null;

/**
 * Register the AES-256-GCM key used by `backupDatabase` / `restoreDatabase`.
 *
 * The features layer is responsible for loading this key from Secure Storage
 * (Android Keystore) and passing it in. Until this is called, backup / restore
 * will throw.
 */
export function setBackupKey(key: CryptoKey): void {
  _backupKey = key;
}

// ── Constants ─────────────────────────────────────────────────────────────

const SCHEMA_VERSION = "1.0" as const;
const SCHEME_CODE = "PMEGP" as const;

/** AES-GCM IV length — 12 bytes (96 bits), the NIST SP 800-38D recommendation. */
const GCM_IV_LENGTH = 12;

// ── Export ────────────────────────────────────────────────────────────────

/**
 * Build a portable JSON envelope for a single project.
 *
 * `exportedAt` is the wall-clock time at export (metadata). `knowledgeVersion`
 * is read from the `app_meta` table so the envelope records which Knowledge
 * Package revision the export was produced against.
 *
 * NEVER includes the user's AI API key — that lives only in Secure Storage
 * and is never passed into this function.
 */
export async function exportProject(
  profile: ProjectProfile,
  financials: FinancialResult,
  eligibility: EligibilityResult,
  attachments?: AttachmentRef[],
): Promise<ExportProjectResult> {
  const knowledgeVersion = await readKnowledgeVersion();

  return {
    schemaVersion: SCHEMA_VERSION,
    schemeCode: SCHEME_CODE,
    knowledgeVersion,
    exportedAt: new Date().toISOString(),
    project: profile,
    financialsSnapshot: financials,
    eligibilitySnapshot: eligibility,
    attachments: attachments ?? [],
  };
}

/**
 * Read the `knowledge_version` value from the `app_meta` table.
 *
 * Returns `"unknown"` if the DB is not yet initialized or the key is missing,
 * so an export attempted before `initDB()` completes still succeeds with a
 * clearly-marked version (rather than throwing).
 */
async function readKnowledgeVersion(): Promise<string> {
  try {
    const db = await getDB();
    const rows = await db.query<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = ?;",
      ["knowledge_version"],
    );
    if (rows.length > 0) return rows[0].value;
  } catch {
    // DB not yet initialized, or table missing — fall through to default.
  }
  return "unknown";
}

// ── Import ────────────────────────────────────────────────────────────────

/**
 * Lenient Zod envelope for the import payload.
 *
 * We validate only the OUTER structure — the presence of the four required
 * keys (`schemaVersion`, `project`, `financialsSnapshot`, `eligibilitySnapshot`).
 * The inner objects are accepted as-is (`z.unknown()`) so an import from a
 * future schema version that added extra fields doesn't fail. We never
 * partially apply invalid data: a failed parse returns `{ error }` and the
 * caller discards the input.
 */
const importSchema = z.object({
  schemaVersion: z.string(),
  schemeCode: z.string().optional(),
  knowledgeVersion: z.string().optional(),
  exportedAt: z.string().optional(),
  project: z.unknown(),
  financialsSnapshot: z.unknown(),
  eligibilitySnapshot: z.unknown(),
  attachments: z.array(z.unknown()).optional(),
});

/**
 * Parse and validate an exported project envelope.
 *
 * Returns the reconstructed `{ profile, financials, eligibility }` on success,
 * or `{ error }` on any failure (malformed JSON, schema mismatch, missing
 * required keys). NEVER partially applies — either the whole envelope is
 * valid or nothing is returned.
 */
export function importProject(json: string): {
  profile: ProjectProfile;
  financials: FinancialResult;
  eligibility: EligibilityResult;
} | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return {
      error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const result = importSchema.safeParse(parsed);
  if (!result.success) {
    return {
      error: `Schema validation failed: ${result.error.message}`,
    };
  }

  const env = result.data;
  return {
    profile: env.project as ProjectProfile,
    financials: env.financialsSnapshot as FinancialResult,
    eligibility: env.eligibilitySnapshot as EligibilityResult,
  };
}

// ── Backup ────────────────────────────────────────────────────────────────

/** Internal shape of the backup payload (before encryption). */
interface BackupPayload {
  schemaVersion: "1.0";
  schemeCode: "PMEGP";
  createdAt: string;
  tables: {
    projects: ProjectRow[];
    ai_provider_config: AiProviderConfigRow[];
    app_meta: AppMetaRow[];
  };
}

/** Column lists used for both SELECT (backup) and INSERT (restore). Keeps the
 *  round-trip well-defined regardless of future schema additions. */
const PROJECT_COLUMNS = [
  "id",
  "name",
  "status",
  "profile_data",
  "provenance_data",
  "completion_data",
  "chat_history",
  "created_at",
  "updated_at",
] as const;

const AI_PROVIDER_COLUMNS = [
  "id",
  "base_url",
  "model_name",
  "is_active",
  "updated_at",
] as const;

const APP_META_COLUMNS = ["key", "value"] as const;

/** Build a parameterized INSERT placeholder list, e.g. `(?, ?, ?)`. */
function placeholders(n: number): string {
  return `(${Array.from({ length: n }, () => "?").join(", ")})`;
}

/**
 * Snapshot the entire local database (projects, ai_provider_config, app_meta)
 * into an AES-256-GCM encrypted ArrayBuffer.
 *
 * Output format: 12-byte IV prefix + GCM ciphertext (which includes the
 * 128-bit authentication tag).
 *
 * The encryption key must be registered first via `setBackupKey()` — the
 * features layer loads it from Secure Storage (Android Keystore).
 *
 * Security: the `ai_provider_config` table does NOT store the API key (only
 * base_url / model_name / is_active / updated_at) — the API key lives in
 * Secure Storage and is never present in a backup.
 */
export async function backupDatabase(): Promise<ArrayBuffer> {
  const key = requireBackupKey();

  const db = await getDB();
  const projects = await db.query<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS.join(", ")} FROM projects;`,
  );
  const aiProviderConfig = await db.query<AiProviderConfigRow>(
    `SELECT ${AI_PROVIDER_COLUMNS.join(", ")} FROM ai_provider_config;`,
  );
  const appMeta = await db.query<AppMetaRow>(
    `SELECT ${APP_META_COLUMNS.join(", ")} FROM app_meta;`,
  );

  const payload: BackupPayload = {
    schemaVersion: SCHEMA_VERSION,
    schemeCode: SCHEME_CODE,
    createdAt: new Date().toISOString(),
    tables: {
      projects,
      ai_provider_config: aiProviderConfig,
      app_meta: appMeta,
    },
  };

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));

  // Fresh 12-byte IV per encryption (NIST SP 800-38D).
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  // Prepend IV so the decryptor can recover it (IV is not secret).
  const output = new Uint8Array(GCM_IV_LENGTH + ciphertext.byteLength);
  output.set(iv, 0);
  output.set(new Uint8Array(ciphertext), GCM_IV_LENGTH);
  return output.buffer;
}

// ── Restore ───────────────────────────────────────────────────────────────

/**
 * Decrypt an encrypted backup and atomically replace the contents of
 * `projects`, `ai_provider_config`, and `app_meta` with the backup's rows.
 *
 * The replacement happens inside a single `executeTransaction` — on any error
 * (decryption failure, malformed JSON, INSERT failure) the transaction is
 * rolled back and the database is left untouched.
 *
 * Throws if the backup key has not been registered, if decryption fails
 * (wrong key, corrupted bytes, tampered ciphertext — GCM authenticates), or
 * if the decrypted payload is structurally invalid.
 */
export async function restoreDatabase(encryptedBackup: ArrayBuffer): Promise<void> {
  const key = requireBackupKey();

  const backupBytes = new Uint8Array(encryptedBackup);
  if (backupBytes.byteLength < GCM_IV_LENGTH) {
    throw new Error("Encrypted backup is too short to contain an IV.");
  }
  const iv = backupBytes.slice(0, GCM_IV_LENGTH);
  const ciphertext = backupBytes.slice(GCM_IV_LENGTH);

  // GCM auth check happens inside decrypt — a tampered or wrong-key ciphertext
  // throws here, before we touch the DB.
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  const plaintext = new TextDecoder().decode(plaintextBuffer);

  let payload: BackupPayload;
  try {
    payload = JSON.parse(plaintext) as BackupPayload;
  } catch (err) {
    throw new Error(
      `Decrypted backup is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!payload || !payload.tables) {
    throw new Error("Decrypted backup is missing the 'tables' field.");
  }
  const tables = payload.tables;
  if (!Array.isArray(tables.projects) || !Array.isArray(tables.ai_provider_config) || !Array.isArray(tables.app_meta)) {
    throw new Error("Decrypted backup has malformed table arrays.");
  }

  const db = await getDB();
  await db.executeTransaction(async (tx) => {
    // Wipe all three tables, then re-insert from the backup. Order matters
    // only if foreign keys ever get added (currently none) — but DELETE in
    // parent-first order is the safe default.
    await tx.run("DELETE FROM projects;");
    await tx.run("DELETE FROM ai_provider_config;");
    await tx.run("DELETE FROM app_meta;");

    for (const row of tables.projects) {
      await tx.run(
        `INSERT INTO projects (${PROJECT_COLUMNS.join(", ")}) VALUES ${placeholders(PROJECT_COLUMNS.length)};`,
        [
          row.id,
          row.name,
          row.status,
          row.profile_data,
          row.provenance_data,
          row.completion_data,
          row.chat_history,
          row.created_at,
          row.updated_at,
        ],
      );
    }

    for (const row of tables.ai_provider_config) {
      await tx.run(
        `INSERT INTO ai_provider_config (${AI_PROVIDER_COLUMNS.join(", ")}) VALUES ${placeholders(AI_PROVIDER_COLUMNS.length)};`,
        [
          row.id,
          row.base_url,
          row.model_name,
          row.is_active,
          row.updated_at,
        ],
      );
    }

    for (const row of tables.app_meta) {
      await tx.run(
        `INSERT INTO app_meta (${APP_META_COLUMNS.join(", ")}) VALUES ${placeholders(APP_META_COLUMNS.length)};`,
        [row.key, row.value],
      );
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function requireBackupKey(): CryptoKey {
  if (!_backupKey) {
    throw new Error(
      "Backup key not set. Call setBackupKey() before invoking backup / restore.",
    );
  }
  return _backupKey;
}
