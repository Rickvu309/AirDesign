import { spawnSync } from "node:child_process"
import path from "node:path"
import { defineConfig } from "vitest/config"
import { commitVariable } from "./scripts/property-seed.mjs"
import { sourceOnly } from "./scripts/source-only.mjs"
import LongestFirst from "./scripts/vitest-longest-first.mjs"
import { testFilesByProject } from "./scripts/unit-test-files.mjs"

const root = import.meta.dirname
const testFiles = testFilesByProject(root)
const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout?.trim() ?? ""

const alias = [
  {
    find: /^@airdesign\/([a-z0-9-]+)$/,
    replacement: path.join(import.meta.dirname, "packages/$1/src/index.ts"),
  },
  {
    find: /^@airdesign\/([a-z0-9-]+)\/([a-z0-9-]+)$/,
    replacement: path.join(import.meta.dirname, "packages/$1/src/$2.ts"),
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
    isolate: true,
    sequence: { sequencer: LongestFirst },
    allowOnly: !process.env.CI,
    env: commit === "" ? {} : { [commitVariable]: commit },
    setupFiles: ["scripts/vitest-clean-environment.mjs", "scripts/vitest-assertions.mjs"],
    reporters: ["default", "scripts/vitest-metrics.mjs"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: testFiles.unit,
        },
      },
      {
        extends: true,
        test: {
          name: "api",
          include: testFiles.api,
          globalSetup: ["apps/api/src/testing/postgres-setup.ts"],
          setupFiles: ["scripts/vitest-api-database.mjs"],
        },
      },
      {
        extends: true,
        test: {
          name: "render",
          environment: "jsdom",
          setupFiles: ["scripts/vitest-act-environment.mjs"],
          include: testFiles.render,
        },
      },
    ],
  },
})
