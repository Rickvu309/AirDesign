import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { affectedReport } from "./affected-report.mjs"
import { proofPlan } from "../.agents/skills/verify-airdesign/bin/prove-plan.mjs"

const root = new URL("../", import.meta.url).pathname
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
const gate = { plan: proofPlan({ changed: ["pnpm-lock.yaml"] }), related: [], tests: [], tooling: [] }
const local = await affectedReport({ root, base: head, gate })
const ci = await affectedReport({ root, base: head, head })
assert.equal(ci.complete, true, ci.incomplete.join("\n"))
assert.deepEqual(
  Object.fromEntries(local.unit.groups.map(({ name, files }) => [name, files])),
  Object.fromEntries(ci.unit.groups.map(({ name, files }) => [name, files])),
  "gate classifier groups must agree with the real Vitest config",
)
console.log("affected-report: local shared groups match the real Vitest projects")
