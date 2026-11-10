import fs from "node:fs"
import path from "node:path"
import { score, suite, type SuiteRow } from "@airdesign/mcp"
import { describe, expect, it } from "vitest"

const recorded = () => {
  const metrics = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "metrics.json"), "utf8"))
  return metrics["eval-coverage"]
}

const proven = (rows: readonly SuiteRow[]) => {
  const tasks = new Set<string>()
  for (const row of rows) {
    const passing = score(row.task, row.reference)
    const failing = score(row.task, row.wrong.attempt)
    if (passing.pass && !failing.pass && failing.reason === row.wrong.reason) tasks.add(row.task.id)
  }
  return tasks.size
}

describe("eval-coverage", () => {
  it("is recorded as the number of tasks the scorer proves both ways", () => {
    const now = proven(suite)
    expect(
      recorded().now,
      `eval-coverage is ${now} and metrics.json says ${recorded().now}. Record ${now} in metrics.json.`,
    ).toBe(now)
  })

  it("does not count a task whose wrong attempt passes", () => {
    const [row] = suite
    expect(proven([row])).toBe(1)
    expect(proven([{ ...row, wrong: { ...row.wrong, attempt: row.reference } }])).toBe(0)
  })

  it("does not count a task whose wrong attempt fails for another reason", () => {
    const [row] = suite
    const other = row.wrong.reason === "calls" ? "tool" : "calls"
    expect(proven([{ ...row, wrong: { ...row.wrong, reason: other } }])).toBe(0)
  })

  it("does not count a task whose reference fails", () => {
    const [row] = suite
    expect(proven([{ ...row, reference: row.wrong.attempt }])).toBe(0)
  })

  it("counts a task once however often it is listed", () => {
    const [row] = suite
    expect(proven([row, row])).toBe(1)
  })
})
