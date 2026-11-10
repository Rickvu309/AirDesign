import path from "node:path"
import { defineConfig } from "vitest/config"

const alias = [
  {
    find: /^@airdesign\/([a-z0-9-]+)$/,
    replacement: path.join(import.meta.dirname, "packages/$1/src/index.ts"),
  },
  {
    find: /^fast-check$/,
    replacement: path.join(import.meta.dirname, "scripts/property-count.mjs"),
  },
]

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    retry: 0,
    setupFiles: ["scripts/vitest-assertions.mjs", "packages/pptx/markup-setup.ts"],
    reporters: ["default", "scripts/vitest-sticks.mjs"],
    include: ["apps/**/*.test.ts", "apps/**/*.test.tsx", "packages/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/browser/**", "**/node_modules/**", "**/dist/**"],
    projects: [
      {
        test: {
          name: "unit",
          exclude: ["packages/render/**/*.test.ts"],
        },
      },
      {
        extends: false,
        resolve: {
          alias,
        },
        test: {
          name: "render",
          retry: 0,
          environment: "jsdom",
          setupFiles: ["scripts/vitest-assertions.mjs"],
          include: ["packages/render/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**"],
        },
      },
    ],
  },
})
