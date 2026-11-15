import path from "node:path"
import { defineConfig } from "vitest/config"
import { splitUnitTests } from "./scripts/test-isolation.mjs"

const root = import.meta.dirname

const { shared: sharedTests, isolated: isolatedTests } = splitUnitTests(root)

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
    setupFiles: ["scripts/vitest-assertions.mjs"],
    reporters: ["default", "scripts/vitest-metrics.mjs"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: isolatedTests,
        },
      },
      {
        extends: true,
        test: {
          name: "shared",
          include: sharedTests,
          isolate: false,
          setupFiles: ["scripts/vitest-assertions.mjs", "scripts/vitest-kept-globals.mjs"],
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
