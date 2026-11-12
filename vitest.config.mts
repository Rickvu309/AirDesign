import fs from "node:fs"
import path from "node:path"
import { defineConfig } from "vitest/config"

const root = import.meta.dirname

const mocksModules = /\bvi\.(mock|doMock|stubGlobal|stubEnv|spyOn|useFakeTimers|setSystemTime)\(/

const unitTests = fs
  .globSync(
    [
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
      "packages/**/*.test.ts",
      "tests/**/*.test.ts",
      ".agents/skills/**/*.test.mjs",
    ],
    {
      cwd: root,
      exclude: (name) => name === "node_modules" || name === "dist",
    },
  )
  .filter(
    (file) =>
      !file.startsWith("tests/browser/") && !file.startsWith("packages/render/") && !file.startsWith("apps/api/"),
  )
  .sort()

const holdsModules = (file: string) => mocksModules.test(fs.readFileSync(path.join(root, file), "utf8"))
const readsGlobals = (file: string) => file.startsWith("apps/web/") || file.startsWith("apps/site/")
const sharedTests = unitTests.filter((file) => !holdsModules(file) && !readsGlobals(file))
const isolatedTests = unitTests.filter((file) => !sharedTests.includes(file))

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
          include: isolatedTests,
        },
      },
      {
        extends: true,
        test: {
          name: "shared",
          include: sharedTests,
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
