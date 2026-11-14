import { describe, expect, it } from "vitest"
import { score, suite } from "./index.js"

describe("suite", () => {
  it("scores the reference and the wrong attempt for every task", () => {
    expect(suite).toHaveLength(49)
    for (const row of suite) {
      const passed = score(row.task, row.reference)
      expect(passed.pass, `${row.task.id}: ${JSON.stringify(passed.answers)} ${passed.reason}`).toBe(true)
      expect(passed.reason, row.task.id).toBe("ok")
      const failed = score(row.task, row.wrong.attempt)
      expect(failed.pass, row.task.id).toBe(false)
      expect(failed.reason, row.task.id).toBe(row.wrong.reason)
    }
  })

  it("sends a wrong attempt that reaches the scenario", () => {
    for (const row of suite) {
      if (row.task.want.steps.length === 0) continue
      expect(row.wrong.attempt.length, row.task.id).toBeGreaterThan(0)
      expect(row.wrong.attempt.length, row.task.id).toBeLessThanOrEqual(row.task.want.calls)
      expect(row.wrong.reason, row.task.id).not.toBe("calls")
      const outcomes = score(row.task, row.wrong.attempt).answers.map((answer) => answer.outcome)
      expect(outcomes, row.task.id).not.toContain("field")
    }
  })
})
