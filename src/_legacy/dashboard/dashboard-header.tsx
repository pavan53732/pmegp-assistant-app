"use client";

import { IndianRupee } from "lucide-react";
import { NotificationTrigger } from "@/components/notification-center";
import { SettingsDialog } from "@/components/dashboard/settings-dialog";

/**
 * Sticky top header bar for the dashboard view.
 *
 * Renders the PMEGP Assistant branding, a keyboard-shortcut hint,
 * the notification bell, and the settings gear. Entirely self-contained
 * with no required props.
 */
export function DashboardHeader() {
  return (
    <header className="border-b border-border/60 bg-card/90 backdrop-blur-xl sticky top-0 z-30 shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]">
      <div className="max-w-6xl mx-auto px-4 py-3.5 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-600/25 ring-1 ring-white/10">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                PMEGP Assistant
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block leading-tight">
                Prime Minister&apos;s Employment Generation Programme
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationTrigger />
            <span className="text-[10px] text-muted-foreground/60 hidden sm:flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/50">
              <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border/80 rounded-md shadow-[0_1px_0_0_rgb(0_0_0/0.05)]">
                ⌘K
              </kbd>
              <span>shortcuts</span>
            </span>
            <SettingsDialog />
          </div>
        </div>
      </div>
    </header>
  );
}