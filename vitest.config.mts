import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    retry: 0,
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/browser/**", "**/node_modules/**", "**/dist/**"],
  },
});
