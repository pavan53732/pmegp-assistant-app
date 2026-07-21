// ─── BiometricGate ──────────────────────────────────────────────────────────
// App-entry unlock gate. Wraps the app's routed content. On native platforms,
// when the user has enabled biometric unlock in Settings, requires a
// fingerprint / face scan (or a 4-digit PIN fallback on devices without
// biometric hardware) before rendering children. On web (dev) the gate is
// always bypassed.
//
// State machine:
//   loading      → reading Preferences + checking availability (initial)
//   open         → not enabled OR not native → render children directly
//   biometric    → enabled + native + biometric available → show "Unlock"
//   pin          → enabled + native + biometric NOT available → show PIN pad
//   unlocked     → authenticated → render children
//
// Fail-open policy:
//   If the user enabled biometric but their device has no biometric hardware
//   AND no PIN has been set, we fail open (render children) with a console
//   warning. This prevents a misconfiguration from permanently locking the
//   user out of their own data. The Settings screen warns when enabling
//   without either biometric or a PIN set.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Fingerprint,
  Lock,
  Loader2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

import {
  checkBiometricAvailability,
  isBiometricEnabled,
  getPinHash,
  verifyBiometric,
  hashPin,
  safeEqualHash,
} from "./biometric-service";

type GateState =
  | { kind: "loading" }
  | { kind: "open" }
  | { kind: "biometric" }
  | { kind: "pin" }
  | { kind: "unlocked" };

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinInput, setPinInput] = useState("");

  // ── Initial gate evaluation (runs once on mount) ────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const native = Capacitor.isNativePlatform();
        const enabled = await isBiometricEnabled();

        // Web (dev) OR not enabled → no gate.
        if (!enabled || !native) {
          if (!cancelled) setState({ kind: "open" });
          return;
        }

        const avail = await checkBiometricAvailability();
        if (avail.available) {
          if (!cancelled) setState({ kind: "biometric" });
          return;
        }

        // Biometric not available on this device → PIN fallback.
        const storedHash = await getPinHash();
        if (!storedHash) {
          // Misconfiguration: enabled + no biometric + no PIN. Fail open
          // with a warning so the user isn't locked out. The Settings
          // screen is responsible for warning at enable-time.
          console.warn(
            "[BiometricGate] Biometric unlock is enabled but the device has " +
              "no biometric hardware and no PIN fallback is set. Failing open " +
              "to avoid a lockout. Set a PIN in Settings → Biometric.",
          );
          if (!cancelled) setState({ kind: "open" });
          return;
        }
        if (!cancelled) setState({ kind: "pin" });
      } catch (err) {
        // Any unexpected failure during gate evaluation → fail open + log.
        // Locking the user out because of a thrown exception is worse than
        // showing the data.
        console.error("[BiometricGate] Gate evaluation failed — failing open:", err);
        if (!cancelled) setState({ kind: "open" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Unlock handlers ─────────────────────────────────────────────────────

  const handleBiometricUnlock = async () => {
    setBusy(true);
    setError(null);
    const result = await verifyBiometric();
    setBusy(false);
    if (result.verified) {
      setState({ kind: "unlocked" });
    } else {
      setError(result.error ?? "Biometric verification failed. Try again.");
    }
  };

  const handlePinUnlock = async () => {
    if (pinInput.length !== 4) {
      setError("Enter a 4-digit PIN.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const storedHash = await getPinHash();
      const inputHash = await hashPin(pinInput);
      setBusy(false);
      if (storedHash && safeEqualHash(inputHash, storedHash)) {
        setPinInput("");
        setState({ kind: "unlocked" });
      } else {
        setPinInput("");
        setError("Incorrect PIN. Try again.");
      }
    } catch (err) {
      setBusy(false);
      setError(
        "PIN verification error: " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.kind === "open" || state.kind === "unlocked") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <LockScreen
        mode={state.kind}
        busy={busy}
        error={error}
        pinInput={pinInput}
        setPinInput={setPinInput}
        onBiometricUnlock={handleBiometricUnlock}
        onPinUnlock={handlePinUnlock}
      />
    </div>
  );
}

// ── Lock screen (biometric or PIN) ──────────────────────────────────────────

interface LockScreenProps {
  mode: "biometric" | "pin";
  busy: boolean;
  error: string | null;
  pinInput: string;
  setPinInput: (v: string) => void;
  onBiometricUnlock: () => void;
  onPinUnlock: () => void;
}

function LockScreen({
  mode,
  busy,
  error,
  pinInput,
  setPinInput,
  onBiometricUnlock,
  onPinUnlock,
}: LockScreenProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="size-4" /> Biometric unlock
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          PMEGP Assistant is locked. Authenticate to access your projects.
        </p>

        {mode === "biometric" ? (
          <div className="space-y-3">
            <Button
              onClick={onBiometricUnlock}
              disabled={busy}
              className="min-h-11 w-full"
              size="lg"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Fingerprint className="size-5" />
              )}
              Unlock with Biometric
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Fingerprint or face — your data stays on this device.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2">
              <label htmlFor="biometric-pin-input" className="text-xs text-muted-foreground">
                Enter 4-digit PIN
              </label>
              <Input
                id="biometric-pin-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pinInput}
                onChange={(e) => {
                  // digits only, max 4
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setPinInput(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onPinUnlock();
                }}
                placeholder="••••"
                className="min-h-12 text-center text-lg tracking-[0.5em]"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <Button
              onClick={onPinUnlock}
              disabled={busy || pinInput.length !== 4}
              className="min-h-11 w-full"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              Unlock
            </Button>
            <p className="text-xs text-muted-foreground">
              PIN fallback is active because this device has no biometric
              hardware enrolled.
            </p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Unlock failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
