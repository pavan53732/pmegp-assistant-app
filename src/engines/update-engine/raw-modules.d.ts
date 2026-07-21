// Ambient module declarations for Vite `?raw` imports used by the Update
// Engine. Kept inside `src/engines/update-engine/` to respect the directory
// boundary (no project-wide `vite-env.d.ts` is added).
//
// Vite inlines `?raw` imports as the file's literal string contents at build
// time; these declarations only exist to satisfy the TypeScript compiler.

declare module "*.pem?raw" {
  const content: string;
  export default content;
}
