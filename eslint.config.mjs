import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// Flat ESLint config for the Vite + React + TypeScript Capacitor app.
// Next.js config removed (no more eslint-config-next).
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "android/**",
      ".next/**",
      "build/**",
      "examples/**",
      "mini-services/**",
      "src/components/ui/**",
      "src/_legacy/**",
      "skills/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { window: "readonly", document: "readonly", console: "readonly", fetch: "readonly" },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "react-refresh/only-export-components": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "prefer-const": "off",
      "no-case-declarations": "off",
    },
  },
  // ── Import boundary enforcement (doc 02, doc 14 §7) ──────────────────────
  // engines/ must NEVER import from features/ or providers/.
  {
    files: ["src/engines/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/providers/*", "../features/*", "../providers/*", "../../features/*", "../../providers/*"],
              message: "engines/ must not import from features/ or providers/ (architecture boundary, doc 02).",
            },
          ],
        },
      ],
    },
  }
);
