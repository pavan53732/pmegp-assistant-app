// ─── FirstRunNotice ────────────────────────────────────────────────────────
// One-time transparency notice shown on first app launch.
// Not a consent gate — a plain statement of data handling practices.
//
// DESIGN_PRINCIPLES §11: Privacy-first local storage.
// doc 13 §7: First-run transparency notice (not a cloud-style consent gate).
// ───────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, Lock, WifiOff, Database, FileText } from "lucide-react";

const STORAGE_KEY = "pmegp_first_run_acknowledged";

export function useFirstRunNotice(): {
  showNotice: boolean;
  dismissNotice: () => void;
} {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    // Check if the notice has already been acknowledged
    try {
      const acknowledged = localStorage.getItem(STORAGE_KEY);
      if (!acknowledged) {
        setShowNotice(true);
      }
    } catch {
      // localStorage unavailable — show notice anyway
      setShowNotice(true);
    }
  }, []);

  const dismissNotice = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // localStorage unavailable — ignore
    }
    setShowNotice(false);
  };

  return { showNotice, dismissNotice };
}

export function FirstRunNotice({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDismiss()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-emerald-600" />
            Welcome to PMEGP Assistant
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Before you begin, here is how this app handles your data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <NoticeItem
            icon={<Lock className="h-4 w-4" />}
            title="Your data stays on your device"
            description="All project profiles, financial calculations, and documents are stored locally in an encrypted SQLite database. Nothing is uploaded to our servers."
          />
          <NoticeItem
            icon={<WifiOff className="h-4 w-4" />}
            title="Works completely offline"
            description="This app functions without internet. The only optional network call is to your own AI provider (if configured)."
          />
          <NoticeItem
            icon={<Database className="h-4 w-4" />}
            title="Encrypted at rest"
            description="Your database is protected by SQLCipher encryption. Your AI API key is stored in Android Secure Storage (Keystore)."
          />
          <NoticeItem
            icon={<FileText className="h-4 w-4" />}
            title="You control your backups"
            description="Export your projects anytime as encrypted JSON files. Backups never include your AI API key."
          />
        </div>

        <DialogFooter>
          <Button onClick={onDismiss} className="w-full">
            I Understand — Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoticeItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex-shrink-0 text-emerald-600">{icon}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
