import type { Refusal } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { editCodes, editNext, editSentence, type EditCode } from "./edit-next.js"

describe("editNext", () => {
  it("gives every refusal that can reach an agent a sentence", () => {
    const covered: Record<Refusal, string> = editNext
    for (const code of Object.keys(covered)) expect(editCodes).toContain(code)
    const reached: EditCode[] = [
      "field",
      "deck",
      "batch",
      "base",
      "payload",
      "stale",
      "person-protected",
      "run-fenced",
      "dead",
      "present",
      "limit",
      "text-from",
      "owner",
      "store",
    ]
    expect([...editCodes].sort()).toEqual([...reached].sort())
    for (const code of editCodes) {
      const sentence = editSentence(code)
      expect(sentence.length, code).toBeGreaterThan(0)
      expect(sentence, code).not.toBe(code)
      expect(sentence.endsWith("."), code).toBe(true)
      if (code === "stale") continue
      expect(sentence, code).not.toContain("send the change again")
      expect(sentence, code).not.toContain("version")
    }
    expect(new Set(editCodes.map((code) => editSentence(code))).size).toBe(editCodes.length)
    expect(editNext.stale).toContain("send the change again")
    expect(editNext["person-protected"]).toContain("Do not send this change again")
    expect(editNext["run-fenced"]).toContain("in its own call")
    expect(editNext.base).not.toContain("behind")
    expect(editNext.limit).toContain("8,000 bytes")
    expect(editNext.limit).not.toContain("Send less")
    expect(editNext["text-from"]).not.toContain("current value")
  })
})
