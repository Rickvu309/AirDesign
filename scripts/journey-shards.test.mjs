import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const journeyFolder = new URL("../.agents/skills/verify-airdesign/journeys/", import.meta.url)
const list = (env = {}) =>
  execFileSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "-c",
      "playwright.journeys.config.mts",
      "--list",
      "--reporter=list",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, JOURNEYS_CHANGED: "", JOURNEYS_SHARD: "", JOURNEYS_REPORT: "", ...env },
    },
  )
    .split("\n")
    .filter((line) => line.includes(" › "))
    .map((line) => line.split(" › ").at(-1).trim())
    .sort()

const all = list()
assert.deepEqual(
  all,
  fs
    .readdirSync(journeyFolder)
    .filter((file) => file.endsWith(".mjs"))
    .map((file) => file.slice(0, -4))
    .sort(),
  "the suite drives every journey once",
)
for (const total of [2, 3, 4]) {
  const shares = Array.from({ length: total }, (_, i) => list({ JOURNEYS_SHARD: [i + 1, total].join("/") }))
  assert.ok(
    shares.every((share) => share.length > 0),
    "each shard ran a share",
  )
  assert.deepEqual(shares.flat().sort(), all, "the shards drive every journey once")
}
assert.deepEqual(
  list({ JOURNEYS_CHANGED: '["aira-panel","auto-layout-text","theme"]', JOURNEYS_SHARD: "1/1" }),
  ["aira-panel", "auto-layout-text", "theme"],
  "a journey-only change runs those exact tests",
)
