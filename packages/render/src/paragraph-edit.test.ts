import { describe, expect, it } from "vitest"
import { joinParagraph, replaceSelection, textValue, typedValue } from "./paragraph-edit.js"

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

  it("keeps the size of the run a line break is typed after", () => {
    const sized = [{ from: 0, runs: [{ from: 0, text: "Revenue", size: 3200 }] }]
    const [next] = replaceSelection(sized, { paragraph: 0, offset: 7 }, { paragraph: 0, offset: 7 }, ["", "Costs"])
    expect(next[1]?.runs[0]?.size).toBe(3200)
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

describe("typedValue", () => {
  const two = [
    {
      from: 0,
      runs: [
        { from: 0, text: "Revenue " },
        { from: 1, text: "39%", bold: true },
      ],
    },
    {
      from: 2,
      runs: [
        { from: 2, text: "Costs ", font: "Georgia" },
        { from: 3, text: "fell", italic: true },
      ],
    },
  ]

  it("joins two paragraphs when the line break between them is deleted", () => {
    expect(typedValue(two, "Revenue 39%Costs fell")).toEqual([
      {
        from: 0,
        runs: [
          { from: 0, text: "Revenue " },
          { from: 1, text: "39%", bold: true },
          { from: -1, text: "Costs ", font: "Georgia" },
          { from: -1, text: "fell", italic: true },
        ],
      },
    ])
  })

  it("keeps a run's format when all of its words are replaced", () => {
    expect(typedValue(two, "Revenue 41%\nCosts fell")[0]?.runs).toEqual([
      { from: 0, text: "Revenue " },
      { from: 1, text: "41%", bold: true },
    ])
  })

  it("replaces a whole emoji, never half of one", () => {
    const [next] = typedValue([{ from: 0, runs: [{ from: 0, text: "Go 😀", bold: true }] }], "Go 😁")
    expect(next?.runs).toEqual([{ from: 0, text: "Go 😁", bold: true }])
  })

  it("writes words into an empty text", () => {
    expect(typedValue(textValue(""), "Hello")).toEqual([{ from: 0, runs: [{ from: -1, text: "Hello" }] }])
  })
})

it("uses the supplied UTF-16 range for an emoji before a repeated survivor", () => {
  const kept = { from: 1, text: "1", bold: true }
  expect(typedValue([{ from: 0, runs: [{ from: 0, text: "😀" }, kept] }], "1", { start: 0, end: 2 })).toEqual([
    { from: 0, runs: [kept] },
  ])
})

it("inserts pasted lines at the selected repeated character through the run model", () => {
  const value = [
    {
      from: 0,
      runs: [
        { from: 0, text: "1" },
        { from: 1, text: "1", bold: true },
      ],
    },
  ]
  const next = typedValue(value, "a\nb1", { start: 0, end: 1 })
  expect(next).toEqual([
    { from: 0, runs: [{ from: 0, text: "a" }] },
    {
      from: 0,
      runs: [{ from: 1, text: "b1", bold: true }],
    },
  ])
})

it("keeps the visible words when a replacement range describes another span", () => {
  const before = [
    {
      from: 0,
      runs: [
        { from: 0, text: "helo " },
        { from: 1, text: "world", bold: true },
      ],
    },
  ]
  expect(typedValue(before, "hello world", { start: 10, end: 10 })).toEqual([
    {
      from: 0,
      runs: [
        { from: 0, text: "hello " },
        { from: 1, text: "world", bold: true },
      ],
    },
  ])
})
