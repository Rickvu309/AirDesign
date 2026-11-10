import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@airdesign\/([a-z0-9-]+)$/,
        replacement: path.join(import.meta.dirname, "packages/$1/src/index.ts"),
      },
    ],
  },
  test: {
    retry: 0,
    setupFiles: ["packages/pptx/markup-setup.ts"],
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/browser/**", "**/node_modules/**", "**/dist/**"],
  },
})
