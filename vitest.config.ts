import { defineConfig } from "vitest/config";
import path from "path";

// Default environment stays "node" — the existing 99 tests are pure logic
// with no DOM, and switching them all to jsdom would only add overhead.
// New component tests (focus trapping, SSE hook lifecycle) opt into jsdom
// per-file via a `// @vitest-environment jsdom` docblock instead.
export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
  // tsconfig.json sets jsx:"preserve" (required for Next.js's own compiler)
  // — Vitest's esbuild transform respects that by default, which means it
  // never converts JSX to React.createElement calls for test files,
  // producing "React is not defined". Overriding esbuild's jsx mode here,
  // scoped to the test runner only, doesn't touch the Next.js build.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
