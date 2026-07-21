// ─── Biometric Service (internal) ───────────────────────────────────────────
// Platform-aware helpers that back the BiometricGate + BiometricSettings
// components. All native-only Capacitor plugins are dynamically imported inside
// `Capacitor.isNativePlatform()` guards so the vite dev server never tries to
// register a plugin that doesn't exist in the browser.
//
//   - `@capacitor/core` (Capacitor.isNativePlatform) — platform-agnostic, has
//     an identical web shim. Safe to import statically (mirrors the pattern
//     already used in src/database/sqlite/connection.ts and src/engines/ocr-engine).
//   - `@capacitor/preferences` — has a web implementation (localStorage) so it
//     is technically safe to import statically, but we dynamic-import it here
//     for consistency with the rest of this folder.
//   - `@capgo/capacitor-native-biometric` — native-only. The web shim is a
//     dummy that always reports `isAvailable: true` and a no-op
//     `verifyIdentity`. We therefore ONLY call it when `isNativePlatform()`
//     is true; on web the gate is skipped entirely (see BiometricGate.tsx).
//
// API deviation from the task brief, documented:
//   The brief said `verifyIdentity()` returns `{ verified: boolean }`. The
//   actual @capgo/capacitor-native-biometric v8.6.2 TypeScript signature is
//   `Promise<void>` — it RESOLVES on success and REJECTS on failure / cancel.
//   `verifyBiometric()` below translates that into the `{ verified, error }`
//   shape the gate consumes, so the gate logic reads as the brief intended.
// ───────────────────────────────────────────────────────────────────────────

import { Capacitor } from "@capacitor/core";

// ── Preferences keys ────────────────────────────────────────────────────────

export const PREF_BIOMETRIC_ENABLED = "biometric_enabled";
export const PREF_BIOMETRIC_PIN_HASH = "biometric_pin_hash";

// ── NativeBiometric option set (shared by gate + settings so they agree) ────
//
// Property names follow the actual BiometricOptions interface of
// @capgo/capacitor-native-biometric v8.6.2 (NOT the brief's
// `fallbackButtonTitle`, which does not exist on the type). `useFallback`
// and `fallbackTitle` are iOS-only; `negativeButtonText` is Android-only.
// Passing all three is harmless — each platform ignores the others.

export const BIOMETRIC_VERIFY_OPTIONS = {
  reason: "Unlock PMEGP Assistant",
  title: "Biometric Unlock",
  subtitle: "Authenticate to access your projects",
  description: "Use your fingerprint or face to unlock",
  useFallback: true, // iOS: fall back to passcode on biometric failure
  fallbackTitle: "Use PIN", // iOS: label for the fallback button
  negativeButtonText: "Cancel", // Android: cancel button text
  maxAttempts: 5, // Android: max biometric attempts (platform cap)
};

// ── Preferences helpers ─────────────────────────────────────────────────────

async function preferencesGet(key: string): Promise<string | null> {
  const { Preferences } = await import("@capacitor/preferences");
  const { value } = await Preferences.get({ key });
  return value;
}

async function preferencesSet(key: string, value: string): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key, value });
}

async function preferencesRemove(key: string): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.remove({ key });
}

// ── biometric_enabled flag ──────────────────────────────────────────────────

export async function isBiometricEnabled(): Promise<boolean> {
  return (await preferencesGet(PREF_BIOMETRIC_ENABLED)) === "true";
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await preferencesSet(PREF_BIOMETRIC_ENABLED, enabled ? "true" : "false");
}

// ── PIN hash (Wave 6: NOT production-secure — see SECURITY NOTE below) ──────

export async function getPinHash(): Promise<string | null> {
  return preferencesGet(PREF_BIOMETRIC_PIN_HASH);
}

export async function setPinHash(hash: string): Promise<void> {
  await preferencesSet(PREF_BIOMETRIC_PIN_HASH, hash);
}

export async function clearPinHash(): Promise<void> {
  await preferencesRemove(PREF_BIOMETRIC_PIN_HASH);
}

// ── NativeBiometric availability + verify ───────────────────────────────────

export interface Availability {
  /** Whether biometric authentication is available on this device right now. */
  available: boolean;
  /** Whether the device has a secure lock screen (PIN/pattern/password). */
  deviceIsSecure: boolean;
  /**
   * Platform the check ran on — `"native"` (Android/iOS) or `"web"`. On web
   * the gate is always skipped, so `available` is reported as `false` here
   * even though the plugin's web shim would dummy-report `true`.
   */
  platform: "native" | "web";
}

export async function checkBiometricAvailability(): Promise<Availability> {
  if (!Capacitor.isNativePlatform()) {
    // Web (dev): the plugin's web shim is a dummy that always returns
    // `isAvailable: true`. We deliberately report `false` here so the gate
    // never tries to use it on web — the gate is skipped on web regardless
    // (see BiometricGate.tsx), but Settings should also reflect reality.
    return { available: false, deviceIsSecure: false, platform: "web" };
  }
  const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
  const result = await NativeBiometric.isAvailable({ useFallback: true });
  return {
    available: result.isAvailable,
    deviceIsSecure: result.deviceIsSecure,
    platform: "native",
  };
}

export interface VerifyResult {
  verified: boolean;
  /** Present when `verified` is false. User-facing message. */
  error?: string;
}

export async function verifyBiometric(): Promise<VerifyResult> {
  if (!Capacitor.isNativePlatform()) {
    // Defensive: the gate should never call this on web. Resolve as verified
    // so a mis-routed call doesn't lock the user out.
    return { verified: true };
  }
  const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
  try {
    // The plugin's TS signature is `Promise<void>` — resolves on success,
    // rejects on failure / cancel. Translate to the { verified } shape.
    await NativeBiometric.verifyIdentity(BIOMETRIC_VERIFY_OPTIONS);
    return { verified: true };
  } catch (err) {
    // The plugin throws a Capacitor exception with a `code` field on
    // documented failures (USER_CANCEL, AUTHENTICATION_FAILED, etc.) and a
    // plain Error otherwise. Surface the message verbatim — it is already
    // user-readable on both platforms.
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Authentication failed";
    return { verified: false, error: message };
  }
}

// ── PIN hashing ─────────────────────────────────────────────────────────────
//
// SECURITY NOTE (Wave 6 — not production-secure):
//   This is a single-round SHA-256 of a 4-digit PIN (only 10,000 possible
//   inputs). It is trivially brute-forceable and is intended ONLY as a
//   development / hardware-fallback gate for devices without biometric
//   support. It is NOT a real security boundary.
//
//   For production, replace this with one of:
//     1. PBKDF2/scrypt/argon2 with a per-install random salt + high iteration
//        count (use Web Crypto's PBKDF2 via `crypto.subtle.deriveBits`).
//     2. Better: use NativeBiometric's `setSecureData` / `getSecureData`
//        (Keystore / Keychain backed) so the PIN never lives in Preferences
//        in any hashed form — `getSecureData` itself triggers a biometric
//        prompt. This is the recommended path for Wave 7.
//
//   The seam for that swap is `setPinHash` / `getPinHash` above + this
//   `hashPin` function. The BiometricGate calls only these helpers, so a
//   drop-in replacement requires no UI changes.

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  // Uint8Array → lowercase hex string.
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string compare to avoid early-exit timing leaks. */
export function safeEqualHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
