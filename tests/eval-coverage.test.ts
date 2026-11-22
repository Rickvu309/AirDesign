import fs from "node:fs"
import path from "node:path"
import { score, suite, type SuiteRow } from "@airdesign/mcp/evals"
import { describe, expect, it } from "vitest"

const recorded = () => {
  const metrics = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "metrics.json"), "utf8"))
  return metrics["eval-coverage"]
}

const proven = async (rows: readonly SuiteRow[]) => {
  const tasks = new Set<string>()
  for (const row of rows) {
    const passing = await score(row.task, row.reference)
    const failing = await score(row.task, row.wrong.attempt)
    if (passing.pass && !failing.pass && failing.reason === row.wrong.reason) tasks.add(row.task.id)
  }
  return tasks.size
}

describe("eval-coverage", () => {
  it("is recorded as the number of tasks the scorer proves both ways", async () => {
    const now = await proven(suite)
    expect(
      recorded().now,
      `eval-coverage is ${now} and metrics.json says ${recorded().now}. Record ${now} in metrics.json.`,
    ).toBe(now)
  })

  it("does not count a task whose wrong attempt passes", async () => {
    const [row] = suite
    expect(await proven([row])).toBe(1)
    expect(await proven([{ ...row, wrong: { ...row.wrong, attempt: row.reference } }])).toBe(0)
  })

  it("does not count a task whose wrong attempt fails for another reason", async () => {
    const [row] = suite
    const other = row.wrong.reason === "calls" ? "tool" : "calls"
    expect(await proven([{ ...row, wrong: { ...row.wrong, reason: other } }])).toBe(0)
  })

  it("does not count a task whose reference fails", async () => {
    const [row] = suite
    expect(await proven([{ ...row, reference: row.wrong.attempt }])).toBe(0)
  })

  it("counts a task once however often it is listed", async () => {
    const [row] = suite
    expect(await proven([row, row])).toBe(1)
  })
})
