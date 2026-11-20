import { createHash } from "node:crypto"
import { availableParallelism } from "node:os"
import { defineConfig } from "@playwright/test"
import { onCi, workerLimit, workerOverrideName } from "./tests/browser-workers.ts"

const checkout = createHash("sha256").update(process.cwd()).digest().readUInt16BE(0)
const port = Number(process.env.AIRDESIGN_PORT || 4400 + (checkout % 600))
const origin = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: "tests/browser",
  globalSetup: "./tests/browser/launch.ts",
  retries: 0,
  forbidOnly: onCi(process.env),
  globalTimeout: onCi(process.env) ? 10 * 60_000 : 0,
  workers: workerLimit({
    cores: availableParallelism(),
    ci: onCi(process.env),
    override: process.env[workerOverrideName],
  }),
  reporter: [["line"], ["./scripts/browser-timings.mjs"]],
  use: {
    baseURL: origin,
    browserName: "chromium",
    screenshot: "only-on-failure",
    storageState: {
      cookies: [
        {
          name: "airdesign.account",
          value: "0123456789abcdef0123456789abcdef",
          domain: "127.0.0.1",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  },
  webServer: {
    command: `node tests/browser/font-preview.mjs ${port}`,
    stdout: "pipe",
    stderr: "pipe",
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
