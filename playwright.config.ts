import { requirePinnedNode } from "./scripts/node-version.mjs"
import { availableParallelism } from "node:os"
import { defineConfig } from "@playwright/test"
import { onCi, workerLimit, workerOverrideName } from "./tests/browser-workers.ts"
import { previewOrigin, previewPortPattern, startingPort } from "./tests/browser/preview-port.ts"

requirePinnedNode()

const start = startingPort(process.cwd(), process.env)
const workers = workerLimit({
  cores: availableParallelism(),
  ci: onCi(process.env),
  override: process.env[workerOverrideName],
})

export default defineConfig({
  testDir: "tests/browser",
  globalSetup: "./tests/browser/launch.ts",
  retries: 0,
  forbidOnly: onCi(process.env),
  globalTimeout: onCi(process.env) ? 10 * 60_000 : 0,
  ...(workers === undefined ? {} : { workers }),
  reporter: [["line"], ["./scripts/browser-timings.mjs"]],
  use: {
    baseURL: previewOrigin(process.env),
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
    command: `node tests/browser/font-preview.mjs ${String(start)}`,
    stdout: "pipe",
    stderr: "pipe",
    wait: { stdout: previewPortPattern },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
