import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Vite configuration for the PMEGP Assistant Capacitor 7 Android app.
// webDir "dist" matches capacitor.config.ts. Dev server runs on port 3000
// to stay compatible with the sandbox Caddy gateway (reverse-proxies :3000).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
