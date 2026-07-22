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
    fs: {
      // Explicitly allow the project root so that `?raw` imports (e.g. the
      // Update Engine's `public-key.pem`) are served by the dev server.
      allow: [path.resolve(__dirname, ".")],
      // Vite's default deny list blocks `*.pem` to protect private keys.
      // The Update Engine bundles a PUBLIC Ed25519 key as `public-key.pem`
      // and imports it via `?raw` — it's safe to serve. We keep all other
      // sensitive extensions denied.
      deny: [".env", ".env.*", "*.crt", "*.key", "*.p12", "*.cer"],
    },
    // Prevent Vite's dependency scanner from crawling the `skills/` directory
    // (design templates that import `three` etc. — not part of this app).
    watch: {
      ignored: ["**/skills/**"],
    },
  },
  optimizeDeps: {
    // Don't try to pre-bundle `three` — it's only referenced by skills/
    // design templates, not by the PMEGP app itself.
    exclude: ["three"],
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
