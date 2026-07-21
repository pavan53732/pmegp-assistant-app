// ─── sign-manifest.mjs ───────────────────────────────────────────────────────
// Signs a PMEGP Update Engine manifest with the project's Ed25519 private key.
//
// Usage:
//   bun scripts/sign-manifest.mjs <manifest.json> [--priv-key <path>]
//
// What it does:
//   1. Reads the manifest JSON from <manifest.json>.
//   2. Strips the `signature` field (if present).
//   3. Serializes the remaining object to CANONICAL JSON (object keys sorted
//      recursively ascending, arrays in order, no inter-token whitespace). This
//      MUST byte-match the canonicalizer in
//      `src/engines/update-engine/index.ts` (`canonicalJsonStringify`) —
//      otherwise the engine's `verifyAsync` will reject the signature.
//   4. Signs the UTF-8 canonical bytes with Ed25519 via Node's `crypto.sign`
//      (algorithm = `null` → Ed25519 raw, 64-byte signature).
//   5. Base64-encodes the signature and writes it back into the manifest's
//      `signature` field. Also prints the signature to stdout.
//
// The private key is read from `.secrets/update-signing-private-key.pem`
// (gitignored) by default; override with `--priv-key <path>`.
//
// Run from project root: `bun scripts/sign-manifest.mjs path/to/manifest.json`.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// ── Canonical JSON ───────────────────────────────────────────────────────────
// MUST be byte-identical to the canonicalizer in
// `src/engines/update-engine/index.ts`. Both signer and verifier must agree on
// the exact byte representation that the signature covers.
export function canonicalJsonStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJsonStringify).join(",") + "]";
  }
  const obj = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalJsonStringify(obj[k]))
      .join(",") +
    "}"
  );
}

// ── Signing ──────────────────────────────────────────────────────────────────

/**
 * Compute the canonical bytes that the manifest signature covers.
 * Strips the `signature` field, then canonicalizes. Returns a UTF-8 Buffer.
 *
 * @param {Record<string, unknown>} manifest
 * @returns {Buffer}
 */
export function canonicalBytesForSignature(manifest) {
  const { signature: _stripped, ...rest } = manifest;
  return Buffer.from(canonicalJsonStringify(rest), "utf8");
}

/**
 * Sign a manifest object with an Ed25519 private key (PEM, PKCS8).
 * Returns the base64 signature string. Does NOT mutate the input.
 *
 * @param {Record<string, unknown>} manifest  Manifest object (with or without `signature`).
 * @param {string} privKeyPem                  PKCS8 PEM-encoded Ed25519 private key.
 * @returns {string} base64-encoded 64-byte Ed25519 signature.
 */
export function signManifest(manifest, privKeyPem) {
  const priv = crypto.createPrivateKey(privKeyPem);
  if (priv.asymmetricKeyType !== "ed25519") {
    throw new Error(
      `Private key is not Ed25519 (got: ${priv.asymmetricKeyType}). ` +
        "Generate with `crypto.generateKeyPairSync('ed25519')`."
    );
  }
  const message = canonicalBytesForSignature(manifest);
  // For Ed25519, Node's `crypto.sign` requires the algorithm argument to be
  // `null` or `undefined` (Ed25519 does not take a separate hash). Returns a
  // 64-byte Buffer.
  const sigBytes = crypto.sign(null, message, priv);
  return sigBytes.toString("base64");
}

/**
 * Read & sign a manifest file in place: writes the signature back into the
 * manifest's `signature` field and returns `{ signature, manifest }`.
 *
 * @param {string} manifestPath  Absolute or project-relative path to manifest JSON.
 * @param {string} [privKeyPem]  Optional PEM string. If omitted, reads from
 *                                `<project>/.secrets/update-signing-private-key.pem`.
 * @returns {{ signature: string, manifest: Record<string, unknown> }}
 */
export function signManifestFile(manifestPath, privKeyPem) {
  const absManifestPath = resolve(process.cwd(), manifestPath);
  const manifest = JSON.parse(readFileSync(absManifestPath, "utf8"));
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    throw new Error(`Manifest at ${absManifestPath} is not a JSON object`);
  }
  const pem =
    privKeyPem ??
    readFileSync(
      resolve(PROJECT_ROOT, ".secrets", "update-signing-private-key.pem"),
      "utf8"
    );
  const signature = signManifest(manifest, pem);
  manifest.signature = signature;
  writeFileSync(absManifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return { signature, manifest };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function printUsage() {
  console.error(
    [
      "Usage: bun scripts/sign-manifest.mjs <manifest.json> [--priv-key <path>]",
      "",
      "Signs the manifest in place: writes the base64 Ed25519 signature into",
      "the manifest's `signature` field and echoes it to stdout.",
      "",
      "Options:",
      "  --priv-key <path>  Override the private key path (default: .secrets/update-signing-private-key.pem)",
      "  --help, -h         Show this help",
    ].join("\n")
  );
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  /** @type {string | undefined} */
  let manifestPath;
  /** @type {string | undefined} */
  let privKeyOverride;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--priv-key") {
      privKeyOverride = args[++i];
      if (!privKeyOverride) {
        console.error("Error: --priv-key requires a path argument");
        process.exit(2);
      }
    } else if (!manifestPath) {
      manifestPath = a;
    } else {
      console.error(`Error: unexpected argument: ${a}`);
      printUsage();
      process.exit(2);
    }
  }
  if (!manifestPath) {
    printUsage();
    process.exit(1);
  }

  try {
    const pem =
      privKeyOverride !== undefined
        ? readFileSync(resolve(process.cwd(), privKeyOverride), "utf8")
        : undefined;
    const { signature, manifest } = signManifestFile(manifestPath, pem);
    const manifestAbsPath = resolve(process.cwd(), manifestPath);
    console.log(`Signed manifest: ${manifestAbsPath}`);
    console.log(`  version:     ${manifest.version ?? "(missing)"}`);
    console.log(`  schemeCode:  ${manifest.schemeCode ?? "(missing)"}`);
    console.log(`  publicKeyId: ${manifest.publicKeyId ?? "(missing)"}`);
    console.log(`  signature:   ${signature}`);
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

// Run only when invoked as a CLI, not when imported.
const isMain = process.argv[1] &&
  resolve(process.argv[1]) === __filename;
if (isMain) {
  main(process.argv);
}
