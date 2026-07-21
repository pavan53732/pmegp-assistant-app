"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  Trash2,
  CheckCheck,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  read: boolean;
}

// ── In-memory store ────────────────────────────────────────────────────────

let storeSnapshot: NotificationItem[] = [];
let storeListeners: Set<() => void> = new Set();
let storeVersion = 0;

function generateId(): string {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emitChange() {
  storeVersion += 1;
  storeListeners.forEach((fn) => fn());
}

function addNotification(
  title: string,
  message: string,
  type: NotificationType = "info"
) {
  const item: NotificationItem = {
    id: generateId(),
    title,
    message,
    type,
    timestamp: new Date(),
    read: false,
  };
  storeSnapshot = [item, ...storeSnapshot].slice(0, 50);
  emitChange();
}

function clearAllNotifications() {
  storeSnapshot = [];
  emitChange();
}

function markAllAsRead() {
  storeSnapshot = storeSnapshot.map((n) => ({ ...n, read: true }));
  emitChange();
}

function markSingleNotificationRead(id: string) {
  storeSnapshot = storeSnapshot.map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
  emitChange();
}

function subscribeToStore(callback: () => void) {
  storeListeners.add(callback);
  return () => {
    storeListeners.delete(callback);
  };
}

function getStoreSnapshot(): NotificationItem[] {
  return storeSnapshot;
}

function getStoreVersion(): number {
  return storeVersion;
}

// Public API
export const notificationCenter = {
  add: addNotification,
  clear: clearAllNotifications,
  markAllRead: markAllAsRead,
};

// ── Seed sample data ───────────────────────────────────────────────────────

function seedSampleData(): NotificationItem[] {
  const now = Date.now();
  return [
    {
      id: "seed-1",
      title: "Project Created",
      message: 'New project "Papad Making Unit" was created successfully.',
      type: "success",
      timestamp: new Date(now - 2 * 60 * 1000),
      read: false,
    },
    {
      id: "seed-2",
      title: "Eligibility Checked",
      message: "Eligibility check completed for General category, Rural area.",
      type: "info",
      timestamp: new Date(now - 15 * 60 * 1000),
      read: false,
    },
    {
      id: "seed-3",
      title: "Document Missing",
      message: "Aadhaar card and caste certificate are still pending.",
      type: "warning",
      timestamp: new Date(now - 45 * 60 * 1000),
      read: true,
    },
    {
      id: "seed-4",
      title: "Project Deleted",
      message: 'Project "Old Test Project" was permanently deleted.',
      type: "error",
      timestamp: new Date(now - 2 * 60 * 60 * 1000),
      read: true,
    },
    {
      id: "seed-5",
      title: "Project Renamed",
      message: 'Project "Untitled" was renamed to "Agarbatti Manufacturing".',
      type: "info",
      timestamp: new Date(now - 3 * 60 * 60 * 1000),
      read: true,
    },
  ];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  NotificationType,
  {
    icon: typeof CheckCircle2;
    dotClass: string;
    iconClass: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    dotClass: "bg-emerald-500",
    iconClass: "text-emerald-500",
  },
  error: {
    icon: XCircle,
    dotClass: "bg-red-500",
    iconClass: "text-red-500",
  },
  info: {
    icon: Info,
    dotClass: "bg-sky-500",
    iconClass: "text-sky-500",
  },
  warning: {
    icon: AlertTriangle,
    dotClass: "bg-amber-500",
    iconClass: "text-amber-500",
  },
};

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Trigger Button (exported separately for layout integration) ────────────

function useNotificationStore() {
  // Seed data on first call
  useEffect(() => {
    if (storeSnapshot.length === 0) {
      storeSnapshot = seedSampleData();
      emitChange();
    }
  }, []);

  return useSyncExternalStore(subscribeToStore, getStoreSnapshot, getStoreSnapshot);
}

export function NotificationTrigger() {
  const notifications = useNotificationStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg hover:bg-accent/50 transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full animate-dot-blink"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 space-y-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base font-semibold">
                Notifications
              </SheetTitle>
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                >
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                onClick={clearAllNotifications}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear all
              </Button>
            </div>
          </div>
          <SheetDescription className="text-[11px]">
            Recent project activity and updates
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <NotificationList notifications={notifications} />
      </SheetContent>
    </Sheet>
  );
}

// ── Notification List ──────────────────────────────────────────────────────

function NotificationList({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const handleMarkSingleRead = (id: string) => {
    if (!storeSnapshot.find((n) => n.id === id && !n.read)) return;
    markSingleNotificationRead(id);
  };

  if (notifications.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <BellOff className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">
            No notifications yet
          </h3>
          <p className="text-xs text-muted-foreground/70 max-w-[200px]">
            Project activity and updates will appear here
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-3 py-2">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/50" />

        <AnimatePresence initial={false}>
          {notifications.map((notification, idx) => {
            const config = TYPE_CONFIG[notification.type];
            const Icon = config.icon;

            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, height: 0, marginTop: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                className="relative pl-9 pr-1 py-2.5 group"
                onClick={() => handleMarkSingleRead(notification.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleMarkSingleRead(notification.id);
                  }
                }}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute left-[11px] top-[18px] w-[9px] h-[9px] rounded-full border-2 border-background z-10 transition-colors ${config.dotClass}`}
                />

                {/* Card */}
                <div
                  className={`
                    rounded-lg border p-3 transition-colors cursor-pointer
                    ${
                      notification.read
                        ? "bg-transparent border-border/40 hover:bg-muted/30"
                        : "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-800/40 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    }
                  `}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${config.iconClass}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-xs font-semibold truncate ${
                            notification.read
                              ? "text-foreground/70"
                              : "text-foreground"
                          }`}
                        >
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <p
                        className={`text-[11px] mt-0.5 line-clamp-2 leading-relaxed ${
                          notification.read
                            ? "text-muted-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                        {relativeTime(notification.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}