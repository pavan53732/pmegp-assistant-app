// ─── BiometricSettings ──────────────────────────────────────────────────────
// Settings panel for the app-entry biometric unlock gate. Embeds as a single
// `<Card>` section in the Settings screen. Three controls:
//
//   1. "Enable biometric unlock" switch — on enable, calls
//      `NativeBiometric.isAvailable()` (via the service). If available,
//      persists `biometric_enabled = "true"`. If not, shows an inline notice
//      and leaves the switch off.
//   2. "Set PIN fallback" — a 4-digit InputOTP. On "Save", hashes the PIN
//      with SHA-256 (Web Crypto) and stores the hex digest in Preferences.
//      On "Clear", removes the stored hash. Shows whether a PIN is set.
//   3. Status line — shows the current platform / availability summary so
//      the user understands when the gate will actually fire.
//
// Platform behaviour:
//   - Web (vite dev): the toggle CAN be flipped (the service reports
//     `available: false` on web so the toggle shows the "not available"
//     notice). Even if it could be flipped, the BiometricGate is bypassed
//     on web — see BiometricGate.tsx.
//   - Native: flipping the toggle ON probes real hardware. The PIN fallback
//     is offered regardless of biometric availability so the user can
//     configure it pre-emptively.
//
// Wave 6 caveat: the PIN hash is single-round SHA-256 of a 4-digit PIN —
// NOT production-secure. See `biometric-service.ts` for the upgrade path.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Fingerprint,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  KeyRound,
  Trash2,
  Save,
  Smartphone,
  Globe,
} from "lucide-react";

import {
  checkBiometricAvailability,
  isBiometricEnabled,
  setBiometricEnabled,
  getPinHash,
  setPinHash,
  clearPinHash,
  hashPin,
  type Availability,
} from "./biometric-service";

type Notice =
  | { kind: "none" }
  | { kind: "ok"; message: string }
  | { kind: "warn"; message: string }
  | { kind: "error"; message: string };

export function BiometricSettings() {
  const [enabled, setEnabled] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>({ kind: "none" });

  // PIN management state
  const [pinDraft, setPinDraft] = useState("");
  const [pinIsSet, setPinIsSet] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinNotice, setPinNotice] = useState<Notice>({ kind: "none" });

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [en, avail, storedHash] = await Promise.all([
          isBiometricEnabled(),
          checkBiometricAvailability(),
          getPinHash(),
        ]);
        if (cancelled) return;
        setEnabled(en);
        setAvailability(avail);
        setPinIsSet(storedHash !== null);
      } catch (err) {
        if (!cancelled) {
          setNotice({
            kind: "error",
            message:
              "Failed to read biometric settings: " +
              (err instanceof Error ? err.message : String(err)),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Toggle handler ───────────────────────────────────────────────────────
  const handleToggle = async (next: boolean) => {
    setBusy(true);
    setNotice({ kind: "none" });
    try {
      if (next) {
        // Probe availability before persisting — don't claim "enabled" on a
        // device with no biometric hardware.
        const avail = await checkBiometricAvailability();
        setAvailability(avail);
        if (!avail.available) {
          setNotice({
            kind: "warn",
            message:
              avail.platform === "web"
                ? "Biometric unlock is enforced only in the native Android/iOS build. On web (dev) the gate is always skipped."
                : "Biometric not available on this device. Set a PIN fallback below to use the gate, or enroll a fingerprint in Android Settings.",
          });
          // Still allow enabling if a PIN is set, so the gate can use the PIN
          // fallback path on this device. Otherwise leave the switch off.
          if (!pinIsSet) {
            setEnabled(false);
            setBusy(false);
            return;
          }
        }
        await setBiometricEnabled(true);
        setEnabled(true);
        setNotice({
          kind: "ok",
          message: avail.available
            ? "Biometric unlock enabled. The app will require fingerprint or face unlock on next launch."
            : "Biometric unlock enabled with PIN fallback. The app will require your PIN on next launch.",
        });
      } else {
        await setBiometricEnabled(false);
        setEnabled(false);
        setNotice({ kind: "ok", message: "Biometric unlock disabled." });
      }
    } catch (err) {
      setNotice({
        kind: "error",
        message:
          "Failed to update setting: " +
          (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setBusy(false);
    }
  };

  // ── PIN handlers ─────────────────────────────────────────────────────────
  const handleSavePin = async () => {
    if (pinDraft.length !== 4) {
      setPinNotice({ kind: "warn", message: "PIN must be exactly 4 digits." });
      return;
    }
    setPinBusy(true);
    setPinNotice({ kind: "none" });
    try {
      const hash = await hashPin(pinDraft);
      await setPinHash(hash);
      setPinIsSet(true);
      setPinDraft("");
      setPinNotice({ kind: "ok", message: "PIN saved." });
    } catch (err) {
      setPinNotice({
        kind: "error",
        message:
          "Failed to save PIN: " +
          (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setPinBusy(false);
    }
  };

  const handleClearPin = async () => {
    setPinBusy(true);
    setPinNotice({ kind: "none" });
    try {
      await clearPinHash();
      setPinIsSet(false);
      setPinDraft("");
      setPinNotice({ kind: "ok", message: "PIN cleared." });
    } catch (err) {
      setPinNotice({
        kind: "error",
        message:
          "Failed to clear PIN: " +
          (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setPinBusy(false);
    }
  };

  const isNative = Capacitor.isNativePlatform();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Fingerprint className="size-4" /> Biometric unlock
        </CardTitle>
        <CardDescription>
          Require fingerprint / face unlock (or a 4-digit PIN fallback) before
          the app shows your project data. Enforced on native Android/iOS
          builds; skipped on web (dev).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Platform + availability summary */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary" className="gap-1">
            {isNative ? (
              <>
                <Smartphone className="size-3" /> Native
              </>
            ) : (
              <>
                <Globe className="size-3" /> Web (dev)
              </>
            )}
          </Badge>
          {availability && (
            <Badge
              variant={availability.available ? "default" : "outline"}
              className="gap-1"
            >
              {availability.available ? (
                <>
                  <CheckCircle2 className="size-3" /> Biometric available
                </>
              ) : (
                <>
                  <XCircle className="size-3" /> No biometric
                </>
              )}
            </Badge>
          )}
          {pinIsSet && (
            <Badge variant="outline" className="gap-1">
              <KeyRound className="size-3" /> PIN set
            </Badge>
          )}
        </div>

        {/* Enable toggle */}
        <div className="flex items-start justify-between gap-3 rounded-md border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="biometric-enable" className="text-sm font-medium">
              Enable biometric unlock
            </Label>
            <p className="text-xs text-muted-foreground">
              On next app launch, the gate will prompt for biometric / PIN.
            </p>
          </div>
          <Switch
            id="biometric-enable"
            checked={enabled}
            onCheckedChange={(v) => void handleToggle(v)}
            disabled={busy}
          />
        </div>

        {notice.kind !== "none" && (
          <Alert variant={notice.kind === "error" ? "destructive" : "default"}>
            {notice.kind === "ok" && <CheckCircle2 className="size-4 text-emerald-500" />}
            {notice.kind === "warn" && <AlertTriangle className="size-4 text-amber-500" />}
            {notice.kind === "error" && <XCircle className="size-4" />}
            <AlertTitle>
              {notice.kind === "ok"
                ? "Saved"
                : notice.kind === "warn"
                  ? "Heads up"
                  : "Error"}
            </AlertTitle>
            <AlertDescription>{notice.message}</AlertDescription>
          </Alert>
        )}

        {/* PIN fallback */}
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">PIN fallback</Label>
            <p className="text-xs text-muted-foreground">
              Used when biometric hardware is unavailable. Stored as a SHA-256
              hash — Wave 6 only, not production-secure (see code comment).
            </p>
          </div>

          {pinIsSet && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              A PIN is currently set. Enter a new one below to replace it, or
              clear it.
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="biometric-pin" className="text-xs text-muted-foreground">
              {pinIsSet ? "New PIN (4 digits)" : "Choose a 4-digit PIN"}
            </Label>
            <InputOTP
              id="biometric-pin"
              maxLength={4}
              value={pinDraft}
              onChange={(v) => setPinDraft(v.replace(/\D/g, "").slice(0, 4))}
              disabled={pinBusy}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={handleSavePin}
              disabled={pinBusy || pinDraft.length !== 4}
              size="sm"
              className="min-h-9"
            >
              {pinBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {pinIsSet ? "Replace PIN" : "Save PIN"}
            </Button>
            {pinIsSet && (
              <Button
                onClick={handleClearPin}
                disabled={pinBusy}
                size="sm"
                variant="outline"
                className="min-h-9"
              >
                <Trash2 className="size-4" /> Clear PIN
              </Button>
            )}
          </div>

          {pinNotice.kind !== "none" && (
            <Alert
              variant={pinNotice.kind === "error" ? "destructive" : "default"}
              className="py-2"
            >
              {pinNotice.kind === "ok" && (
                <CheckCircle2 className="size-4 text-emerald-500" />
              )}
              {pinNotice.kind === "warn" && (
                <AlertTriangle className="size-4 text-amber-500" />
              )}
              {pinNotice.kind === "error" && <XCircle className="size-4" />}
              <AlertDescription>{pinNotice.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
