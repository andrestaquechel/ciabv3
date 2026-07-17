import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Maps the "@/*" import alias to src/ (our tsconfig has no baseUrl, so we
    // set this explicitly rather than deriving it from tsconfig paths).
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // jsdom for component tests. Pure Node modules (crypto, sqlite) can opt out
    // per-file with a `// @vitest-environment node` docblock at the top.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}"],
    },
  },
});
