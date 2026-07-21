"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

function useMounted() {
  const mountedRef = useRef(false);
  const subscribe = (onStoreChange: () => void) => {
    mountedRef.current = true;
    onStoreChange();
    return () => {};
  };
  const getSnapshot = () => mountedRef.current;
  const getServerSnapshot = () => false;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();

  const isDark = resolvedTheme === "dark";

  // ── Listen for global theme toggle shortcut ───────────────────
  useEffect(() => {
    function onToggleTheme() {
      setTheme(isDark ? "light" : "dark");
    }
    window.addEventListener("pmegp:toggle-theme", onToggleTheme);
    return () => window.removeEventListener("pmegp:toggle-theme", onToggleTheme);
  }, [isDark, setTheme]);

  if (!mounted) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="w-12 h-12 rounded-full bg-muted" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="w-12 h-12 rounded-full shadow-lg border-border/60 hover:border-emerald-400/60 transition-colors"
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div
              key="sun"
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Sun className="w-5 h-5 text-amber-400" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ rotate: 90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Moon className="w-5 h-5 text-slate-700" />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>
    </div>
  );
}