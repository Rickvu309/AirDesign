import { describe, expect, it } from "vitest"
import { score, suite } from "./index.js"

describe("suite", () => {
  it("scores the reference and the wrong attempt for every task", () => {
    expect(suite).toHaveLength(40)
    for (const row of suite) {
      const passed = score(row.task, row.reference)
      expect(passed.pass, row.task.id).toBe(true)
      expect(passed.reason, row.task.id).toBe("ok")
      const failed = score(row.task, row.wrong.attempt)
      expect(failed.pass, row.task.id).toBe(false)
      expect(failed.reason, row.task.id).toBe(row.wrong.reason)
    }
  })
})
