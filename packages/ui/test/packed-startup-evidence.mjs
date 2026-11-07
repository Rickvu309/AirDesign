import assert from "node:assert/strict"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

export function recordPackedStartup(file, measurement, context, budgetMs) {
  assert(typeof measurement.startup === "string" && measurement.startup.trim() !== "", "startup-missing")
  const browserStartupMs = Number(measurement.startup)
  assert(Number.isFinite(browserStartupMs) && browserStartupMs >= 0, "startup-missing")
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ ...context, ...measurement, browserStartupMs }, null, 2)}\n`)
  assert(browserStartupMs < budgetMs, `packed shell startup ${browserStartupMs}ms must be < ${budgetMs}ms`)
}
