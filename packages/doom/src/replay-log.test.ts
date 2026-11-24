import { describe, expect, it } from "vitest"

import { applyEdit, emptyDoom, foldToJson, isRefusal, propOf, replayLog, rev, type Doom, type Landed } from "./index.js"
import { ids, once, person, sampleDeck } from "./sample-deck.js"

const naming = (doom: Doom, name: string): Landed => ({
  once: once(),
  author: person,
  writes: [{ node: ids.title, prop: "name", value: name }],
  rev: rev(doom.rev + 1),
})

describe("replayLog", () => {
  it("rebuilds the deck as it stood after any edit of its log", () => {
    const start = sampleDeck()
    const one = naming(start, "One")
    const afterOne = applyEdit(start, one)
    if (isRefusal(afterOne)) throw new Error("refused")
    const two = naming(afterOne, "Two")
    const afterTwo = applyEdit(afterOne, two)
    if (isRefusal(afterTwo)) throw new Error("refused")
    const rows = [one, two].map((edit) => JSON.parse(JSON.stringify(edit)))
    expect(propOf(replayLog(rows.slice(0, 1), start)?.nodes.get(ids.title), "name")).toBe("One")
    expect(foldToJson(replayLog(rows, start)!)).toEqual(foldToJson(afterTwo))
    expect(replayLog([])).toBe(emptyDoom)
  })

  it("answers nothing when a row of the log does not read", () => {
    expect(replayLog([{ rev: 1 }])).toBeUndefined()
  })
})
