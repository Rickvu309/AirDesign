import path from "node:path"
import { defineConfig } from "vitest/config"

const sharedWorker = ["catalog", "device", "document", "engine", "oauth", "usage"].map(
  (name) => `packages/${name}/**/*.test.ts`,
)

const alias = [
  {
    find: /^@airdesign\/([a-z0-9-]+)$/,
    replacement: path.join(import.meta.dirname, "packages/$1/src/index.ts"),
  },
  {
    find: /^@\//,
    replacement: `${path.join(import.meta.dirname, "apps/web/src")}/`,
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
    reporters: ["default", "scripts/vitest-metrics.mjs"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: [
            "apps/**/*.test.ts",
            "apps/**/*.test.tsx",
            "packages/**/*.test.ts",
            "tests/**/*.test.ts",
            ".agents/skills/**/*.test.mjs",
          ],
          exclude: [
            "tests/browser/**",
            "**/node_modules/**",
            "**/dist/**",
            "packages/render/**/*.test.ts",
            "apps/api/**/*.test.ts",
            ...sharedWorker,
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "shared",
          include: sharedWorker,
          exclude: ["**/node_modules/**", "**/dist/**"],
          isolate: false,
        },
      },
      {
        extends: true,
        test: {
          name: "api",
          include: ["apps/api/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**"],
          globalSetup: ["apps/api/src/postgres-setup.ts"],
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
