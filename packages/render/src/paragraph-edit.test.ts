import { describe, expect, it } from "vitest"
import { joinParagraph, replaceSelection, splitParagraph } from "./paragraph-edit.js"

const value = [
  {
    from: 2,
    runs: [
      { from: 0, text: "Pressurized " },
      { from: 1, text: "delivers" },
      { from: 2, text: " heat" },
    ],
  },
]

describe("replaceSelection", () => {
  it("keeps the format of a run whose whole text is replaced", () => {
    const [next, caret] = replaceSelection(value, { paragraph: 0, offset: 12 }, { paragraph: 0, offset: 20 }, [
      "supplies",
    ])
    expect(next[0]?.runs).toEqual([
      { from: 0, text: "Pressurized " },
      { from: 1, text: "supplies" },
      { from: 2, text: " heat" },
    ])
    expect(caret).toEqual({ paragraph: 0, offset: 20 })
  })

  it("keeps the format of a run whose start is replaced", () => {
    const [next] = replaceSelection(value, { paragraph: 0, offset: 12 }, { paragraph: 0, offset: 17 }, ["X"])
    expect(next[0]?.runs).toEqual([
      { from: 0, text: "Pressurized " },
      { from: 1, text: "Xers" },
      { from: 2, text: " heat" },
    ])
  })

  it("stays in the run a selection starts inside", () => {
    const [next] = replaceSelection(value, { paragraph: 0, offset: 14 }, { paragraph: 0, offset: 20 }, ["X"])
    expect(next[0]?.runs).toEqual([
      { from: 0, text: "Pressurized " },
      { from: 1, text: "deX" },
      { from: 2, text: " heat" },
    ])
  })

  it("takes the format of the first run of a selection across runs", () => {
    const [next] = replaceSelection(value, { paragraph: 0, offset: 12 }, { paragraph: 0, offset: 25 }, ["X"])
    expect(next[0]?.runs).toEqual([
      { from: 0, text: "Pressurized " },
      { from: 1, text: "X" },
    ])
  })

  it("keeps a caret's text in the run before it when nothing is selected", () => {
    const [next] = replaceSelection(value, { paragraph: 0, offset: 12 }, { paragraph: 0, offset: 12 }, ["a", "b"])
    expect(next[0]?.runs).toEqual([{ from: 0, text: "Pressurized a" }])
    expect(next[1]?.runs).toEqual([
      { from: 1, text: "bdelivers" },
      { from: 2, text: " heat" },
    ])
  })

  it("starts a new paragraph for each further line", () => {
    const [next, caret] = replaceSelection(value, { paragraph: 0, offset: 12 }, { paragraph: 0, offset: 20 }, [
      "a",
      "b",
    ])
    expect(next.map((paragraph) => paragraph.runs.map((run) => run.text).join(""))).toEqual(["Pressurized a", "b heat"])
    expect(caret).toEqual({ paragraph: 1, offset: 1 })
  })
})

describe("joinParagraph", () => {
  it.fails("keeps the format of a run from another paragraph of the file", () => {
    const joined = joinParagraph(
      [
        { from: 2, runs: [{ from: 0, text: "a" }] },
        { from: 3, runs: [{ from: 1, text: "b" }] },
      ],
      1,
    )
    expect(joined[0]?.runs.at(-1)?.from).toBe(1)
  })
})

it("continues a paragraph with the run style at the split", () => {
  const run = { from: 0, text: "Hello", size: 3200, strike: true, letterSpacing: -64 }
  const next = splitParagraph([{ from: 0, list: "numbers", runs: [run] }], { paragraph: 0, offset: 5 })
  expect(next[1]).toEqual({ from: 0, list: "numbers", runs: [{ ...run, text: "" }] })
})
