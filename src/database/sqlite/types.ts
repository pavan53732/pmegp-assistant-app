// ─── SQLite Row Types ─────────────────────────────────────────────────────
// Row shapes returned by the `DbAdapter.query<T>()` calls. Column names are
// snake_case to match the SQL schema in `schema.ts`.
//
// Money fields are NOT columns here — all financial data lives inside the
// `profile_data` JSON column (integer rupees throughout, never float-coerced).
// ───────────────────────────────────────────────────────────────────────────

/** Row of the `projects` table. */
export interface ProjectRow {
  id: string;
  name: string;
  /** ProjectStatus stored as string; CHECK-constrained by the schema. */
  status: string;
  /** Serialized `ProjectProfile` JSON. */
  profile_data: string;
  /** Serialized `ProvenanceMetadata` JSON. */
  provenance_data: string;
  /** Serialized `Completion` JSON. */
  completion_data: string;
  /** Serialized `ChatMessageRecord[]` JSON. */
  chat_history: string;
  /** ISO timestamp. */
  created_at: string;
  /** ISO timestamp. */
  updated_at: string;
}

/** Row of the `ai_provider_config` table (singleton — `id` is always 1). */
export interface AiProviderConfigRow {
  id: number;
  base_url: string;
  model_name: string;
  /** Stored as INTEGER 0|1; boolean at the application layer. */
  is_active: number;
  updated_at: string;
}

/** Row of the `app_meta` key/value table. */
export interface AppMetaRow {
  key: string;
  value: string;
}
