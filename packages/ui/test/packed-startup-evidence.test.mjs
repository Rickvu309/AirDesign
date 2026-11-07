import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, expect, it } from "vitest"
import { performanceBudgets } from "../../contract-rules/src/budgets.ts"
import { recordPackedStartup } from "./packed-startup-evidence.mjs"

const directories = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function evidenceFile() {
  const directory = mkdtempSync(path.join(tmpdir(), "packed-startup-proof-"))
  directories.push(directory)
  return path.join(directory, "evidence.json")
}

const diagnostics = {
  navigation: { availability: "available", entries: [{ startTime: 0, responseEnd: 25 }] },
  resources: { availability: "available", entries: [{ name: "fixture.js", duration: 15 }] },
  scheduling: { availability: "unavailable", limitation: "fixture has no observer" },
  errors: { availability: "available", count: 1, entries: ["fixture error"] },
}
const context = { revision: "fixture-revision", sampleCount: 1, limiter: "unknown", packedJsBytes: 123 }

it.each([3888, 3000])("fails at %ims and retains complete readable diagnostics", (startup) => {
  const file = evidenceFile()
  expect(() => recordPackedStartup(file, { startup: String(startup), ...diagnostics }, context, performanceBudgets.shellStartupMs)).toThrow(/must be < 3000ms/)
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ ...context, startup: String(startup), ...diagnostics, browserStartupMs: startup })
})

it("passes strictly under budget and preserves success evidence", () => {
  const file = evidenceFile()
  recordPackedStartup(file, { startup: "2999", ...diagnostics }, context, performanceBudgets.shellStartupMs)
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ ...context, startup: "2999", ...diagnostics, browserStartupMs: 2999 })
})

it.each(["", " ", "NaN", "Infinity", "-1", undefined, null])("rejects invalid timestamp %s", (startup) => {
  expect(() => recordPackedStartup(evidenceFile(), { startup, ...diagnostics }, context, performanceBudgets.shellStartupMs)).toThrow(/startup-missing/)
})
