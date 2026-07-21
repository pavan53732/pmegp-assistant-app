// ─── Versioned Migration Runner ────────────────────────────────────────────
// Reads `schema_version` from `app_meta`; applies pending migrations inside a
// transaction. Future migrations add `if (version < N) { ... }` blocks below
// and bump `CURRENT_SCHEMA_VERSION`.
// ───────────────────────────────────────────────────────────────────────────

import type { DbAdapter } from "./connection";
import { SCHEMA_STATEMENTS } from "./schema";

/** Bump when adding a new migration block. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Default `app_meta` keys seeded on first run (schema version < 1).
 *
 *   - knowledge_version : marks which Knowledge Package revision is bundled.
 *   - first_run_ack      : "false" until the user dismisses the onboarding.
 *   - schema_version     : mirrors CURRENT_SCHEMA_VERSION after migration.
 *   - last_update_check  : "never" until the Update Engine runs.
 */
const DEFAULT_APP_META: Readonly<Record<string, string>> = Object.freeze({
  knowledge_version: "bundled",
  first_run_ack: "false",
  schema_version: "1",
  last_update_check: "never",
});

/**
 * Apply all pending migrations to the given adapter.
 *
 * Safe to call multiple times: reads the current `schema_version` from
 * `app_meta` and only applies blocks whose version is higher. Wraps each
 * migration step in a transaction so a partial failure leaves the DB clean.
 */
export async function runMigrations(db: DbAdapter): Promise<void> {
  // Read the current schema version. On a fresh database the `app_meta`
  // table does not exist yet — the query will throw, and we treat that as
  // version 0.
  let version = 0;
  try {
    const rows = await db.query<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = ?;",
      ["schema_version"]
    );
    if (rows.length > 0) {
      const parsed = parseInt(rows[0].value, 10);
      if (Number.isFinite(parsed)) version = parsed;
    }
  } catch {
    // `app_meta` doesn't exist yet — first run; version stays 0.
  }

  if (version >= CURRENT_SCHEMA_VERSION) return;

  await db.executeTransaction(async (tx) => {
    // ── Migration block: version 0 → 1 ────────────────────────────────────
    // Creates all base tables and seeds default `app_meta` keys.
    if (version < 1) {
      for (const stmt of SCHEMA_STATEMENTS) {
        await tx.execute(stmt);
      }
      for (const [key, value] of Object.entries(DEFAULT_APP_META)) {
        await tx.run(
          "INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?);",
          [key, value]
        );
      }
      // Ensure `schema_version` is recorded even if the seed row above
      // collided with a pre-existing value (it shouldn't, but be defensive).
      await tx.run(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);",
        ["schema_version", String(CURRENT_SCHEMA_VERSION)]
      );
      version = 1;
    }

    // ── Future migrations go here ──────────────────────────────────────────
    // if (version < 2) { ... ; version = 2; }
  });
}
