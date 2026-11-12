import { describe, expect, it } from "vitest"
import { pageMatches, readAllow, staleEntries } from "./allow.mjs"

const entry = {
  page: "agent-*",
  detector: "empty-region",
  selector: "[role=log]",
  reason: "An empty log is the design.",
}

describe("allow", () => {
  it("matches state names and screen paths with a star", () => {
    expect(pageMatches("agent-*", "agent-working")).toBe(true)
    expect(pageMatches("agent-*", "agents-empty")).toBe(false)
    expect(pageMatches("/screens/s42-*", "/screens/s42-01-editor-agent-working")).toBe(true)
  })

  it("refuses an entry without a reason or with an unknown detector", () => {
    expect(() => readAllow(JSON.stringify([{ ...entry, reason: " " }]))).toThrow(/entry 1 needs a reason/)
    expect(() => readAllow(JSON.stringify([{ ...entry, detector: "nice-colors" }]))).toThrow(/names no detector/)
    expect(readAllow(JSON.stringify([entry]))).toEqual([{ ...entry, index: 0 }])
  })

  it("names every entry that silenced nothing", () => {
    const entries = readAllow(JSON.stringify([entry, { ...entry, page: "decks-*" }]))
    expect(staleEntries(entries, new Set([0]))).toEqual([
      "look/allow.json entry 2 (decks-*, empty-region, [role=log]) silences nothing. Remove it.",
    ])
  })

  it("holds only valid entries", () => {
    expect(() => readAllow()).not.toThrow()
  })
})
