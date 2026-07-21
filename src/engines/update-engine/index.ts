// ─── Update Engine ──────────────────────────────────────────────────────────
// Fetches, verifies, and applies signed Knowledge Package updates from a CDN.
//
// This is the SINGLE place in the codebase where outbound network calls are
// permitted from an engine (doc 12 Part B). Knowledge updates are sourced from
// a CDN; every other engine remains pure / side-effect-free.
//
// Trust model:
//   1. A manifest is fetched from a trusted manifest URL.
//   2. The manifest carries an Ed25519 signature over its canonical JSON (the
//      `signature` field stripped, all object keys sorted recursively).
//   3. The signature is verified against a public key bundled with the app
//      (`./public-key.pem`).
//   4. The pack bytes are downloaded and their SHA-256 is checked against the
//      manifest's `files[0].sha256` (single-file packs only).
//   5. The pack is parsed as JSON `{ knowledge_version, data }` and applied
//      inside a single DB transaction that ONLY touches `app_meta`.
//      Existing DPRs (rows in `projects`) are NEVER rewritten — they retain
//      the `knowledgeVersion` under which they were generated.
//
// Boundary: imports only `@/shared/*`, `@/engines/*`, `@/database/*`,
// `@noble/ed25519`, and uses `fetch` (inside `checkForUpdate` / `downloadPack`
// only). Never imports `@/features/*` or `@/providers/*`.
// ─────────────────────────────────────────────────────────────────────────────

// Vite `?raw` import — inlines the PEM file as a string at build time. The
// ambient module declaration lives in `./raw-modules.d.ts` (same directory,
// kept inside this engine's folder to respect the directory boundary).

import { verifyAsync } from "@noble/ed25519";
import { getDB } from "@/database/sqlite";
import publicKeyPem from "./public-key.pem?raw";

// ── Public Types ────────────────────────────────────────────────────────────

export interface DataPackFile {
  path: string;
  sha256: string;
}

export interface DataPackManifest {
  version: string;
  schemeCode: "PMEGP";
  files: DataPackFile[];
  signature: string; // base64 Ed25519 of canonical manifest JSON (minus signature field)
  publicKeyId: string;
}

// ── Internal Types ──────────────────────────────────────────────────────────

/**
 * Pack payload shape. The pack is a UTF-8 JSON object. `data` is an optional
 * record of additional `app_meta` keys to upsert alongside `knowledge_version`.
 * Non-string values are JSON-serialized before storage (the `app_meta.value`
 * column is `TEXT NOT NULL`).
 */
interface PackPayload {
  knowledge_version: string;
  data?: Record<string, unknown>;
}

// ── Cached knowledge version ────────────────────────────────────────────────
// `getCurrentKnowledgeVersion()` is sync. The DB read is async, so on first
// call we kick off a background refresh and return "bundled" (the seeded
// default from migrations.ts). Once the read resolves, subsequent calls return
// the real cached value. If the read fails (DB not yet initialized, etc.) the
// cache stays `null` and we keep returning "bundled"; the next call retries.

let _cached: string | null = null;
let _cachePromise: Promise<void> | null = null;

// ── Public key loading ──────────────────────────────────────────────────────
// Loaded once at module init. The PEM is expected to base64-decode to either:
//   • a raw 32-byte Ed25519 public key, OR
//   • a 44-byte SubjectPublicKeyInfo (SPKI) DER blob whose 12-byte prefix is
//     the standard Ed25519 algorithm OID — in which case we strip the prefix.
// If neither matches (e.g. the dev-only placeholder decodes wrong), we fall
// back to a 32-byte zero array. The fallback is INTENTIONALLY useless: no
// valid signature will verify against it, so signature checks fail closed.

const SPKI_ED25519_PREFIX = [
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
];

let _publicKey: Uint8Array | null = null;

/**
 * Decode the bundled PEM into a 32-byte raw Ed25519 public key.
 *
 * Strategy (robust to both raw-key and SPKI-wrapped PEMs):
 *   1. Strip the `-----BEGIN/END ...-----` lines and all whitespace.
 *   2. Base64-decode the body.
 *   3. If the result is 32 bytes → use directly (raw key).
 *   4. If the result is 44 bytes AND starts with the Ed25519 SPKI prefix →
 *      strip the 12-byte prefix and use the trailing 32 bytes.
 *   5. Otherwise → return a 32-byte zero array (DEV-ONLY fallback, clearly
 *      warned). Production replaces `public-key.pem` with a real key so step 5
 *      is never reached.
 */
function decodePublicKeyFromPem(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");

  try {
    const decoded = base64ToBytes(body);
    if (decoded.length === 32) {
      return decoded;
    }
    if (
      decoded.length === 44 &&
      SPKI_ED25519_PREFIX.every((b, i) => decoded[i] === b)
    ) {
      return decoded.slice(12);
    }
  } catch {
    // Fall through to the dev-only zero fallback.
  }

  // DEV-ONLY FALLBACK. Replace `public-key.pem` with a real Ed25519 public
  // key in production builds. Signature verification will fail against this
  // zero key by design (no real signature signs over the zero key) — fails
  // closed.
  console.warn(
    "[update-engine] public-key.pem did not decode to a valid 32-byte Ed25519 key; " +
      "using dev-only 32-byte zero fallback. Replace with a real public key before release."
  );
  return new Uint8Array(32);
}

/** Lazily compute and cache the public key on first use. */
function getPublicKey(): Uint8Array {
  if (_publicKey === null) {
    _publicKey = decodePublicKeyFromPem(publicKeyPem);
  }
  return _publicKey;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Base64 → Uint8Array using the platform `atob` (browser / Capacitor WebView). */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Canonical JSON: object keys sorted recursively (ascending lexicographic),
 * arrays preserve order, primitive serialization via `JSON.stringify`. No
 * whitespace between tokens. Used to compute the exact bytes the manifest
 * signature covers (signer and verifier MUST agree on this representation).
 */
function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJsonStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJsonStringify(obj[k]))
      .join(",") +
    "}"
  );
}

/** SHA-256 hex digest of the given bytes via the WebCrypto `subtle` API. */
async function sha256Hex(
  bytes: ArrayBuffer | Uint8Array
): Promise<string> {
  // Both `ArrayBuffer` and `Uint8Array` are valid `BufferSource` inputs for
  // `crypto.subtle.digest` at runtime. TS 5.7+ widens `Uint8Array` to
  // `Uint8Array<ArrayBufferLike>` (which includes `SharedArrayBuffer`), so a
  // cast through `BufferSource` is required to satisfy the lib's strict
  // `ArrayBufferView<ArrayBuffer>` parameter type. No runtime cost.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as BufferSource
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Async DB read that populates `_cached` on success; silently no-ops on failure. */
async function refreshCachedKnowledgeVersion(): Promise<void> {
  try {
    const db = await getDB();
    const rows = await db.query<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = ?;",
      ["knowledge_version"]
    );
    if (rows.length > 0 && typeof rows[0].value === "string" && rows[0].value) {
      _cached = rows[0].value;
    }
  } catch {
    // DB not yet initialized or read failed — leave _cached as-is (null →
    // getCurrentKnowledgeVersion() keeps returning "bundled"; next call retries).
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the currently-applied Knowledge Package version. Sync.
 *
 * On first call, returns `"bundled"` (the default seeded by migrations) and
 * kicks off an async DB read that populates the cache for subsequent calls.
 * If the DB read fails, the cache stays `"bundled"` and the next call retries.
 */
export function getCurrentKnowledgeVersion(): string {
  if (_cached !== null) return _cached;
  if (!_cachePromise) {
    // Fire-and-forget; dedupe concurrent callers against the same promise.
    _cachePromise = refreshCachedKnowledgeVersion().finally(() => {
      _cachePromise = null;
    });
  }
  return "bundled";
}

/**
 * Fetch the manifest at `manifestUrl` and compare its `version` to the
 * currently-applied knowledge version. Network call is allowed here — this is
 * the documented exception for the Update Engine.
 *
 * Returns `{ available: true, manifest }` when an update is available, or
 * `{ available: false }` otherwise. Throws on network / parse failure.
 */
export async function checkForUpdate(
  manifestUrl: string
): Promise<{ available: boolean; manifest?: DataPackManifest }> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch manifest from ${manifestUrl}: ${response.status} ${response.statusText}`
    );
  }
  const manifest = (await response.json()) as DataPackManifest;

  // Basic shape validation — surface malformed manifests early rather than
  // letting verification fail with a cryptic crypto error.
  if (
    !manifest ||
    typeof manifest.version !== "string" ||
    manifest.schemeCode !== "PMEGP" ||
    !Array.isArray(manifest.files) ||
    typeof manifest.signature !== "string" ||
    typeof manifest.publicKeyId !== "string"
  ) {
    throw new Error("Manifest failed shape validation");
  }

  const available = manifest.version !== getCurrentKnowledgeVersion();
  return available ? { available: true, manifest } : { available: false };
}

/**
 * Download the pack bytes at `packUrl`. Network call is allowed here — this is
 * the documented exception for the Update Engine. Returns the raw pack bytes;
 * the caller passes them to `verifyAndApply` for signature + integrity checks.
 */
export async function downloadPack(packUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(packUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download pack from ${packUrl}: ${response.status} ${response.statusText}`
    );
  }
  return response.arrayBuffer();
}

/**
 * Verify the pack against the manifest and apply it atomically.
 *
 * Steps:
 *   1. Recompute the canonical manifest JSON (keys sorted, `signature`
 *      omitted) and verify `manifest.signature` against the bundled public
 *      key using Ed25519. Throws `"Signature verification failed"` on mismatch.
 *   2. Compute SHA-256 of the pack bytes; for single-file packs compare to
 *      `manifest.files[0].sha256`. Throws on mismatch.
 *   3. Parse the pack as `{ knowledge_version, data? }` JSON.
 *   4. Inside a single DB transaction: upsert `knowledge_version` and any
 *      keys in `data` into `app_meta`. NEVER touches `projects` — DPRs retain
 *      their generation `knowledgeVersion`. On any error the transaction
 *      rolls back (the wrapper re-throws).
 *   5. Update the in-memory cache to the newly-applied version.
 *
 * Note on `verifyAsync` argument order: `@noble/ed25519` v2.x's signature is
 * `verifyAsync(signature, message, publicKey)` (confirmed in the package's
 * index.d.ts). The verification call below uses that order.
 */
export async function verifyAndApply(
  pack: ArrayBuffer,
  manifest: DataPackManifest
): Promise<void> {
  // ── 1. Signature verification ────────────────────────────────────────────
  const { signature, ...manifestWithoutSignature } = manifest;
  const canonicalJson = canonicalJsonStringify(manifestWithoutSignature);
  const messageBytes = new TextEncoder().encode(canonicalJson);
  const signatureBytes = base64ToBytes(signature);
  const publicKey = getPublicKey();

  const isValid = await verifyAsync(signatureBytes, messageBytes, publicKey);
  if (!isValid) {
    throw new Error("Signature verification failed");
  }

  // ── 2. Pack integrity (single-file packs) ────────────────────────────────
  if (manifest.files.length === 1) {
    const computed = await sha256Hex(pack);
    if (computed !== manifest.files[0].sha256) {
      throw new Error(
        `Pack SHA-256 mismatch: expected ${manifest.files[0].sha256}, got ${computed}`
      );
    }
  }

  // ── 3. Parse pack payload ────────────────────────────────────────────────
  const packJson = new TextDecoder().decode(pack);
  let packPayload: PackPayload;
  try {
    packPayload = JSON.parse(packJson) as PackPayload;
  } catch (err) {
    throw new Error(
      `Pack is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (
    !packPayload ||
    typeof packPayload.knowledge_version !== "string" ||
    !packPayload.knowledge_version
  ) {
    throw new Error("Pack payload missing required `knowledge_version` string");
  }

  // ── 4. Apply inside a single DB transaction ──────────────────────────────
  // ONLY `app_meta` is touched. The `projects` table is never rewritten —
  // existing DPRs keep the `knowledgeVersion` under which they were generated.
  const db = await getDB();
  await db.executeTransaction(async (tx) => {
    await tx.run(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);",
      ["knowledge_version", packPayload.knowledge_version]
    );
    await tx.run(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);",
      ["last_update_check", new Date().toISOString()]
    );
    if (packPayload.data) {
      for (const [key, value] of Object.entries(packPayload.data)) {
        // `app_meta.value` is TEXT — coerce non-strings via JSON.stringify.
        const serialized =
          typeof value === "string" ? value : JSON.stringify(value);
        await tx.run(
          "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);",
          [key, serialized]
        );
      }
    }
  });

  // ── 5. Refresh the in-memory cache ───────────────────────────────────────
  _cached = packPayload.knowledge_version;
}
