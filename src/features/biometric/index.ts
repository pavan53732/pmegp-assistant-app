// Barrel export for the biometric feature.
//
// Public API:
//   <BiometricGate>       — wrap the app's routed content to require
//                            biometric / PIN unlock on native (see App.tsx).
//   <BiometricSettings>   — embed in the Settings screen as a Card section
//                            to toggle the gate and configure the PIN
//                            fallback.
//
// The service helpers in `./biometric-service` are NOT re-exported here —
// they're an internal seam. Tests should import them directly from
// `@/features/biometric/biometric-service` if needed.

export { BiometricGate } from "./BiometricGate";
export { BiometricSettings } from "./BiometricSettings";
