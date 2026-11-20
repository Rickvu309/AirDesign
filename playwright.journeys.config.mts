import { defineConfig, type ReporterDescription } from "@playwright/test"
import { journeyGrep } from "./tests/journeys/journey-shards.mjs"

const reporter: ReporterDescription[] = [["line"], ["./tests/journeys/journey-timings.mjs"]]
if (process.env.JOURNEYS_REPORT) reporter.push(["json", { outputFile: process.env.JOURNEYS_REPORT }])

export default defineConfig({
  testDir: "tests/journeys",
  retries: 0,
  fullyParallel: true,
  grep: journeyGrep({
    root: import.meta.dirname,
    changed: process.env.JOURNEYS_CHANGED,
    shard: process.env.JOURNEYS_SHARD,
  }),
  reporter,
  globalSetup: "./tests/journeys/launch.ts",
  use: {
    browserName: "chromium",
    viewport: { width: 1470, height: 923 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
  },
})
