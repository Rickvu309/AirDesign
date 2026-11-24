import { requirePinnedNode } from "./scripts/node-version.cjs"
import { defineConfig } from "@playwright/test"
import { deployed, type Production } from "./tests/browser/production.ts"

requirePinnedNode()

export default defineConfig<object, { production: Production | undefined }>({
  testDir: "tests/browser",
  testMatch: "editor-trust.spec.ts",
  globalSetup: "./tests/browser/production.ts",
  retries: 0,
  workers: 1,
  timeout: 90_000,
  reporter: "line",
  use: {
    baseURL: deployed.web,
    browserName: "chromium",
    screenshot: "only-on-failure",
    storageState: deployed.state,
    production: deployed,
  },
})
