import { createHash } from "node:crypto"
import { defineConfig } from "@playwright/test"

const checkout = createHash("sha256").update(process.cwd()).digest().readUInt16BE(0)
const port = Number(process.env.AIRDESIGN_PORT || 4400 + (checkout % 600))
const origin = `http://127.0.0.1:${port}`
const built = process.env.AIRDESIGN_WEB_BUILT === "1"

export default defineConfig({
  testDir: "tests/browser",
  globalSetup: "./tests/browser/launch.ts",
  retries: 0,
  reporter: "line",
  use: {
    baseURL: origin,
    browserName: "chromium",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `${built ? "" : "pnpm --filter web build && "}pnpm --filter web exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
