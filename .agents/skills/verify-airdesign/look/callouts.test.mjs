import { describe, expect, it } from "vitest"
import { readCallouts } from "./callouts.mjs"

const one = (callout, block = {}) =>
  JSON.stringify([{ state: "agent-empty", title: "Agent panel, empty", callouts: [callout], ...block }])

describe("callouts file", () => {
  it("reads a block with selectors, a box crop and clicks", () => {
    const { blocks, warnings } = readCallouts(
      one(
        { at: " h2 ", note: "Card corners  22px to 16px" },
        { crop: { x: 1, y: 2, width: 3, height: 4 }, click: ["button"] },
      ),
    )
    expect(warnings).toEqual([])
    expect(blocks).toEqual([
      {
        state: "agent-empty",
        title: "Agent panel, empty",
        crop: { x: 1, y: 2, width: 3, height: 4 },
        click: ["button"],
        callouts: [{ at: "h2", note: "Card corners 22px to 16px" }],
      },
    ])
  })

  it.each([
    ["{", "the callouts file is not JSON"],
    ["[]", "must be a JSON array"],
    [JSON.stringify([{ title: "x", callouts: [] }]), 'block 1 needs "state"'],
    [JSON.stringify([{ state: "a", callouts: [] }]), 'block 1 needs "title"'],
    [JSON.stringify([{ state: "a", title: "x" }]), 'block 1 needs "callouts"'],
    [one({ at: "h2", note: "  " }), "block 1 callout 1 has an empty note"],
    [one({ at: "h2" }), "block 1 callout 1 has an empty note"],
    [one({ at: "", note: "x" }), 'block 1 callout 1 "at" must be a CSS selector or a box'],
    [one({ at: { x: 0, y: 0, width: 0, height: 4 }, note: "x" }), "must be a CSS selector or a box"],
    [one({ at: "h2", note: "x", arrow: "left" }), "block 1 callout 1 has unknown keys: arrow"],
    [one({ at: "h2", note: "x" }, { crops: "main" }), "block 1 has unknown keys: crops"],
    [one({ at: "h2", note: "x" }, { click: "button" }), '"click" must be a list of CSS selectors'],
  ])("refuses %s with a clear message", (text, message) => {
    expect(() => readCallouts(text)).toThrow(message)
  })

  it("warns on a note over 90 characters and keeps it", () => {
    const note = "The panel now explains in a long and winding sentence what Aira does and what it cannot do yet"
    const { blocks, warnings } = readCallouts(one({ at: "h2", note }))
    expect(blocks[0].callouts[0].note).toBe(note)
    expect(warnings).toEqual([`block 1 callout 1 note is ${String(note.length)} characters; keep it under 90`])
  })
})
