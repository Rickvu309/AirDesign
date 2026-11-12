import { refusals } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { editCodes, editNext, runNext } from "./edit-next.js"

describe("editNext", () => {
  it("gives every refusal that can reach an agent a sentence", () => {
    for (const code of refusals) expect(editCodes).toContain(code)
    for (const code of editCodes) {
      const sentence = editNext[code]
      expect(sentence.length, code).toBeGreaterThan(0)
      expect(sentence, code).not.toBe(code)
      expect(sentence.endsWith("."), code).toBe(true)
      if (code === "stale") continue
      expect(sentence, code).not.toContain("send the change again")
      expect(sentence, code).not.toContain("version")
    }
    expect(new Set(editCodes.map((code) => editNext[code])).size).toBe(editCodes.length)
    expect(editNext.stale).toContain("send the change again")
    expect(editNext["person-protected"]).toContain("Do not send this change again")
    expect(editNext["run-fenced"]).toContain("airdesign_stop_run")
    expect(editNext["run-fenced"]).not.toContain("in its own call")
    expect(editNext.base).not.toContain("behind")
    expect(editNext.limit).toContain("8,000 bytes")
    expect(editNext.limit).not.toContain("Send less")
    expect(editNext["text-from"]).not.toContain("current value")
  })

  it("gives a stop its own next step where the edit sentence would mislead", () => {
    for (const code of editCodes) expect(runNext[code].endsWith("."), code).toBe(true)
    for (const code of ["stale", "run-fenced", "limit"] as const) {
      expect(runNext[code], code).not.toBe(editNext[code])
      expect(runNext[code], code).not.toContain("send the change again")
      expect(runNext[code], code).not.toContain("shorter value")
    }
    expect(runNext["run-fenced"]).toContain("runId")
    expect(runNext.owner).toBe(editNext.owner)
  })
})
