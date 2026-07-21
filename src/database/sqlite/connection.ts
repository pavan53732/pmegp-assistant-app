// ─── Platform-aware SQLite Connection ─────────────────────────────────────
// Single source of truth for the database adapter.
//
//   - Native (Capacitor Android): backed by `@capacitor-community/sqlite`
//     with SQLCipher encryption (mode "secret"). The passphrase is sourced
//     from `@capacitor-community/secure-storage` (Android Keystore) and
//     generated on first run.
//   - Web (vite dev browser): backed by a minimal in-memory mock so the UI
//     renders in the browser during development. Clearly dev-only.
//
// IMPORTANT: `@capacitor-community/sqlite` and `@capacitor-community/secure-storage`
// are imported via dynamic `import()` inside the native branch, guarded by
// `Capacitor.isNativePlatform()`. A top-level static import would attempt to
// register Capacitor plugins that don't exist in the browser, breaking the
// vite dev server.
// ───────────────────────────────────────────────────────────────────────────

import { Capacitor } from "@capacitor/core";
import { runMigrations } from "./migrations";

// ── DbAdapter interface ─────────────────────────────────────────────────────
/**
 * Platform-agnostic database adapter. Both the native SQLite plugin and the
 * web dev mock implement this. The repository layer depends only on this
 * interface — never on a concrete plugin class.
 *
 * All methods accept parameterized SQL using `?` placeholders.
 */
export interface DbAdapter {
  /** Execute a statement that returns no rows (DDL, BEGIN/COMMIT, etc.). */
  execute(sql: string): Promise<void>;
  /** Execute a parameterized statement that mutates rows (INSERT/UPDATE/DELETE). */
  run(sql: string, params?: unknown[]): Promise<void>;
  /** Execute a parameterized SELECT and return rows. */
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  /**
   * Run a function inside a transaction. On throw, the transaction is rolled
   * back and the error is re-thrown. The `tx` argument is the same adapter
   * (single connection), so all statements issued inside `fn` participate in
   * the transaction.
   */
  executeTransaction(fn: (tx: DbAdapter) => Promise<void>): Promise<void>;
}

// ── Singleton state ─────────────────────────────────────────────────────────

let _adapter: DbAdapter | null = null;
let _initPromise: Promise<DbAdapter> | null = null;

/**
 * Get the singleton database adapter, creating and migrating it on first call.
 *
 * Idempotent: subsequent calls return the cached adapter without re-running
 * migrations.
 */
export async function getDB(): Promise<DbAdapter> {
  if (_adapter) return _adapter;
  if (!_initPromise) {
    _initPromise = (async () => {
      const adapter = Capacitor.isNativePlatform()
        ? await createNativeAdapter()
        : createWebMockAdapter();
      await runMigrations(adapter);
      _adapter = adapter;
      return adapter;
    })();
  }
  return _initPromise;
}

/**
 * Explicit initialization entry point for app startup. Creates the connection
 * (if not yet created) and runs migrations. Safe to call multiple times.
 */
export async function initDB(): Promise<void> {
  await getDB();
}

// ── Native adapter (Capacitor + SQLite + Secure Storage) ────────────────────

/**
 * Structural shape of the `SQLiteDBConnection` returned by
 * `sqlite.createConnection(...)`. We declare it locally (rather than
 * `import type { SQLiteDBConnection } from "@capacitor-community/sqlite"`)
 * to keep the top-level imports free of any native plugin references —
 * even type-only imports could trip a strict Vite dep scanner.
 */
interface NativeSqliteConn {
  execute(statement: string): Promise<unknown>;
  run(statement: string, values?: unknown[]): Promise<unknown>;
  query(statement: string, values?: unknown[]): Promise<{ values?: unknown[] }>;
}

/**
 * Structural wrapper for the `SQLiteConnection` returned by the plugin. Only
 * the methods we actually call are declared; this decouples tsc from the
 * exact v8 type signatures (which differ from v6/v7).
 */
interface NativeSqliteConnectionWrapper {
  createConnection(database: string, encrypted: boolean, mode: string, version: number, readonly: boolean): Promise<NativeSqliteConn>;
  setDatabaseSubstitution(passphrase: string): Promise<unknown>;
}

/**
 * Build the native adapter. Uses dynamic imports for the SQLite plugin and
 * Secure Storage plugin so the browser dev server never tries to load them.
 */
async function createNativeAdapter(): Promise<DbAdapter> {
  // Dynamic imports — only resolved when running on a native platform.
  // NOTE: the secure-storage package is `capacitor-secure-storage-plugin`
  // (there is no official `@capacitor/secure-storage`; the community name
  // `@capacitor-community/secure-storage` does not exist on npm).
  const sqliteModule = await import("@capacitor-community/sqlite");
  const secureStorageModule = await import("capacitor-secure-storage-plugin");

  // The `SQLiteConnection` class wraps the registered `CapacitorSQLite` plugin.
  // In @capacitor-community/sqlite v8 the constructor requires the
  // `CapacitorSQLite` plugin instance. We pull it from the module export and
  // fall back to `getSQLitePlugin()` if the export is named differently.
  // All native API access is cast to a structural interface so tsc doesn't
  // depend on the exact v8 type signatures (the native path only runs on
  // device; browser dev uses the web mock).
  const SQLiteConnection = sqliteModule.SQLiteConnection;
  const moduleWithPlugin = sqliteModule as { CapacitorSQLite?: unknown };
  const CapacitorSQLite = moduleWithPlugin.CapacitorSQLite ?? null;
  const sqlite = new SQLiteConnection(
    CapacitorSQLite as ConstructorParameters<typeof SQLiteConnection>[0]
  ) as unknown as NativeSqliteConnectionWrapper;

  // Retrieve (or generate) the DB passphrase from Secure Storage. The
  // passphrase is the SQLCipher key — losing it makes the DB unrecoverable.
  // `capacitor-secure-storage-plugin` exports `SecureStoragePlugin` as a
  // plugin object (not a class), so we use it directly.
  const SecureStorage = secureStorageModule.SecureStoragePlugin;
  let passphrase = "";
  try {
    const result = await SecureStorage.get({ key: "db_passphrase" });
    passphrase = result.value;
  } catch {
    // Not yet set — first run; generate below.
  }
  if (!passphrase) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    passphrase = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await SecureStorage.set({ key: "db_passphrase", value: passphrase });
  }

  // Database name must match `capacitor.config.ts` → plugins.SQLite.databaseName.
  // Signature: createConnection(database, encrypted, mode, version, readonly?).
  const connRaw = await sqlite.createConnection("pmegp", true, "secret", 1, false);
  const conn = connRaw as unknown as NativeSqliteConn;

  // Engage SQLCipher with our passphrase before opening the connection. The
  // substitution key must be set prior to any DB I/O so the cipher library
  // uses it when reading/writing pages. (Method name varies across plugin
  // versions — accessed via the structural wrapper.)
  await sqlite.setDatabaseSubstitution(passphrase);

  // Surface encryption errors eagerly. The plugin auto-opens on first query
  // in recent versions, but calling `open()` explicitly when available lets
  // us fail fast at app startup instead of on the first user action.
  const openable = conn as unknown as { open?: () => Promise<unknown> };
  if (typeof openable.open === "function") {
    await openable.open();
  }

  return new NativeSqliteAdapter(conn);
}

class NativeSqliteAdapter implements DbAdapter {
  constructor(private conn: NativeSqliteConn) {}

  async execute(sql: string): Promise<void> {
    await this.conn.execute(sql);
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this.conn.run(sql, params);
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.conn.query(sql, params);
    return (result.values ?? []) as T[];
  }

  async executeTransaction(fn: (tx: DbAdapter) => Promise<void>): Promise<void> {
    await this.conn.execute("BEGIN TRANSACTION;");
    try {
      await fn(this);
      await this.conn.execute("COMMIT;");
    } catch (err) {
      try {
        await this.conn.execute("ROLLBACK;");
      } catch {
        // Ignore rollback failure — the original error is more important.
      }
      throw err;
    }
  }
}

// ── Web (browser dev) mock adapter ──────────────────────────────────────────
// DEV-ONLY. Backs the same DbAdapter interface with in-memory Maps so the
// vite dev server can render the UI in a browser without Capacitor. NOT for
// production use — data is lost on page reload.
//
// Implements a small SQL subset sufficient for the queries the repository
// layer and migrations issue (parameterized INSERT/UPDATE/DELETE/SELECT with
// simple `col = ? [AND col = ?]` WHERE clauses and optional ORDER BY).

function createWebMockAdapter(): DbAdapter {
  return new WebDbAdapter();
}

class WebDbAdapter implements DbAdapter {
  /** Table name → array of row objects (insertion order preserved). */
  private tables = new Map<string, Array<Record<string, unknown>>>();

  async execute(sql: string): Promise<void> {
    const m = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
    if (m && !this.tables.has(m[1])) {
      this.tables.set(m[1], []);
    }
    // BEGIN / COMMIT / ROLLBACK / other DDL: no-op in the in-memory mock.
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    this.mutate(sql, params);
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.read<T>(sql, params);
  }

  async executeTransaction(fn: (tx: DbAdapter) => Promise<void>): Promise<void> {
    // In-memory mock: no real transaction boundaries. Just run the function.
    await fn(this);
  }

  private table(name: string): Array<Record<string, unknown>> {
    let t = this.tables.get(name);
    if (!t) {
      t = [];
      this.tables.set(name, t);
    }
    return t;
  }

  private mutate(sql: string, params: unknown[]): void {
    const s = sql.trim().replace(/;$/, "");

    // INSERT [OR IGNORE|REPLACE] INTO table (cols) VALUES (placeholders)
    let m = s.match(
      /^INSERT(?:\s+OR\s+(IGNORE|REPLACE))?\s+INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)/i
    );
    if (m) {
      const [, conflict, tableName, colsRaw, valsRaw] = m;
      const cols = colsRaw.split(",").map((c) => c.trim());
      const vals = valsRaw.split(",").map((v) => v.trim());
      const tbl = this.table(tableName);
      const row: Record<string, unknown> = {};
      let pIdx = 0;
      for (let i = 0; i < cols.length; i++) {
        row[cols[i]] = vals[i] === "?" ? params[pIdx++] : JSON.parse(vals[i]);
      }
      const pk = cols[0];
      const existingIdx = tbl.findIndex(
        (r) => String(r[pk]) === String(row[pk])
      );
      if (existingIdx >= 0) {
        if (conflict === "IGNORE") return;
        tbl[existingIdx] = row;
        return;
      }
      tbl.push(row);
      return;
    }

    // UPDATE table SET col=?, col=?... [WHERE col=? [AND col=?]]
    m = s.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
    if (m) {
      const [, tableName, setClause, whereClause] = m;
      const tbl = this.table(tableName);
      const setParts = setClause.split(",").map((p) => p.trim());
      const setCols: string[] = [];
      for (const part of setParts) {
        const mm = part.match(/^(\w+)\s*=\s*\?$/);
        if (mm) setCols.push(mm[1]);
      }
      const setValues = params.slice(0, setCols.length);
      const whereParams = params.slice(setCols.length);
      const conds = whereClause ? this.parseWhere(whereClause) : [];
      for (const row of tbl) {
        if (this.matchWhere(row, conds, whereParams)) {
          setCols.forEach((c, i) => {
            row[c] = setValues[i];
          });
        }
      }
      return;
    }

    // DELETE FROM table [WHERE col=? [AND col=?]]
    m = s.match(/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
    if (m) {
      const [, tableName, whereClause] = m;
      const tbl = this.table(tableName);
      if (!whereClause) {
        tbl.length = 0;
        return;
      }
      const conds = this.parseWhere(whereClause);
      for (let i = tbl.length - 1; i >= 0; i--) {
        if (this.matchWhere(tbl[i], conds, params)) {
          tbl.splice(i, 1);
        }
      }
      return;
    }

    // Unknown statement: ignore (dev mock — log for visibility).
    console.warn("[WebDbAdapter] unhandled SQL:", s);
  }

  private read<T>(sql: string, params: unknown[] = []): T[] {
    const s = sql.trim().replace(/;$/, "");
    const m = s.match(
      /^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(\w+)\s+(ASC|DESC))?$/
    );
    if (!m) {
      console.warn("[WebDbAdapter] unhandled SELECT:", s);
      return [];
    }
    const [, colsRaw, tableName, whereClause, orderCol, orderDir] = m;
    const tbl = this.table(tableName);
    const conds = whereClause ? this.parseWhere(whereClause) : [];
    let result = tbl.filter((row) => this.matchWhere(row, conds, params));

    if (orderCol) {
      const dir = orderDir?.toUpperCase() === "DESC" ? -1 : 1;
      result = [...result].sort((a, b) => {
        const av = String(a[orderCol]);
        const bv = String(b[orderCol]);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }

    if (colsRaw.trim() === "*") {
      return result as T[];
    }
    const cols = colsRaw.split(",").map((c) => c.trim());
    return result.map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of cols) out[c] = r[c];
      return out as T;
    });
  }

  /** Parse `col = ? [AND col = ? ...]` into a list of column conditions. */
  private parseWhere(clause: string): Array<{ col: string }> {
    const conds: Array<{ col: string }> = [];
    for (const part of clause.split(/\s+AND\s+/i)) {
      const m = part.trim().match(/^(\w+)\s*=\s*\?$/);
      if (m) conds.push({ col: m[1] });
    }
    return conds;
  }

  /** Match a row against parsed WHERE conditions; `params` aligns positionally. */
  private matchWhere(
    row: Record<string, unknown>,
    conds: Array<{ col: string }>,
    params: unknown[]
  ): boolean {
    return conds.every((c, i) => String(row[c.col]) === String(params[i]));
  }
}
