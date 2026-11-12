import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "tests/journeys",
  retries: 0,
  fullyParallel: true,
  reporter: process.env.JOURNEYS_REPORT ? [["line"], ["json", { outputFile: process.env.JOURNEYS_REPORT }]] : "line",
  globalSetup: "./tests/journeys/launch.ts",
  use: {
    browserName: "chromium",
    viewport: { width: 1470, height: 923 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
  },
})
