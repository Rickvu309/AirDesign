import path from "node:path"
import { defineConfig } from "vitest/config"
import { sourceOnly } from "./scripts/source-only.mjs"
import LongestFirst from "./scripts/vitest-longest-first.mjs"
import { apiTestFiles, renderTestFiles, splitTests, splitUnitTests } from "./scripts/test-isolation.mjs"

const root = import.meta.dirname

const { shared: sharedTests, isolated: isolatedTests } = splitUnitTests(root)
const { shared: sharedRenderTests, isolated: isolatedRenderTests } = splitTests(root, renderTestFiles(root))
const { shared: sharedApiTests, isolated: isolatedApiTests } = splitTests(root, apiTestFiles(root))

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
  plugins: [sourceOnly(root)],
  resolve: {
    alias,
  },
  test: {
    retry: 0,
    sequence: { sequencer: LongestFirst },
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
          include: isolatedApiTests,
          globalSetup: ["apps/api/src/postgres-setup.ts"],
          setupFiles: ["scripts/vitest-api-database.mjs"],
        },
      },
      {
        extends: true,
        test: {
          name: "api-shared",
          include: sharedApiTests,
          isolate: false,
          globalSetup: ["apps/api/src/postgres-setup.ts"],
          setupFiles: ["scripts/vitest-kept-globals.mjs", "scripts/vitest-api-database.mjs"],
        },
      },
      {
        extends: false,
        plugins: [sourceOnly(root)],
        resolve: {
          alias,
        },
        test: {
          name: "render",
          retry: 0,
          environment: "jsdom",
          setupFiles: ["scripts/vitest-assertions.mjs", "scripts/vitest-act-environment.mjs"],
          include: isolatedRenderTests,
        },
      },
      {
        extends: false,
        plugins: [sourceOnly(root)],
        resolve: {
          alias,
        },
        test: {
          name: "render-shared",
          retry: 0,
          environment: "jsdom",
          isolate: false,
          setupFiles: [
            "scripts/vitest-assertions.mjs",
            "scripts/vitest-act-environment.mjs",
            "scripts/vitest-kept-globals.mjs",
          ],
          include: sharedRenderTests,
        },
      },
    ],
  },
})
