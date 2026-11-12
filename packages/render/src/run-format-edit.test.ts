import { describe, expect, it } from "vitest"
import { insertLines, joinParagraph, replaceSelection, splitParagraph } from "./paragraph-edit.js"

const bold = [
  {
    from: 0,
    runs: [
      { from: 0, text: "Hello" },
      { from: 0, text: " world", bold: true },
    ],
  },
]

describe("a run's format through an edit", () => {
  it("stays on both halves of a split run", () => {
    expect(splitParagraph(bold, { paragraph: 0, offset: 8 })).toEqual([
      {
        from: 0,
        runs: [
          { from: 0, text: "Hello" },
          { from: 0, text: " wo", bold: true },
        ],
      },
      { from: 0, runs: [{ from: 0, text: "rld", bold: true }] },
    ])
  })

  it("goes on with typed text at the end of a formatted run", () => {
    const [next] = insertLines(bold, { paragraph: 0, offset: 11 }, ["!"])
    expect(next[0]?.runs).toEqual([
      { from: 0, text: "Hello" },
      { from: 0, text: " world!", bold: true },
    ])
  })

  it("does not join two runs of one from that differ in format", () => {
    const split = splitParagraph(bold, { paragraph: 0, offset: 5 })
    expect(joinParagraph(split, 1)).toEqual(bold)
  })

  it("keeps the format of the run a replaced range started in", () => {
    const [next] = replaceSelection(bold, { paragraph: 0, offset: 6 }, { paragraph: 0, offset: 11 }, ["there"])
    expect(next[0]?.runs).toEqual([
      { from: 0, text: "Hello" },
      { from: 0, text: " there", bold: true },
    ])
  })
})
