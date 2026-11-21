import { describe, expect, it } from "vitest"
import { paragraphedTable, paragraphedText } from "./line-breaks.js"
import { readTableValue } from "./table-value.js"
import { readTextValue, writeTextValue } from "./text-value.js"

describe("a line break starts a new paragraph, as Enter does", () => {
  it("splits plain text into paragraphs that keep the first run's look", () => {
    expect(readTextValue(paragraphedText("Line one\nLine two"))).toEqual([
      { from: 0, runs: [{ from: 0, text: "Line one" }] },
      { from: 0, runs: [{ from: 0, text: "Line two" }] },
    ])
  })

  it("reads Windows and old Mac breaks the same way and keeps an empty line", () => {
    expect(readTextValue(paragraphedText("a\r\n\rb"))).toEqual([
      { from: 0, runs: [{ from: 0, text: "a" }] },
      { from: 0, runs: [] },
      { from: 0, runs: [{ from: 0, text: "b" }] },
    ])
  })

  it("splits a run inside a JSON value and carries the paragraph and run look to the new paragraph", () => {
    const typed = writeTextValue([
      {
        from: 1,
        align: "center",
        runs: [
          { from: 0, text: "Q3 ", bold: true },
          { from: -1, text: "review\nfor the board" },
        ],
      },
    ])
    expect(readTextValue(paragraphedText(typed))).toEqual([
      {
        from: 1,
        align: "center",
        runs: [
          { from: 0, text: "Q3 ", bold: true },
          { from: -1, text: "review" },
        ],
      },
      { from: 1, align: "center", runs: [{ from: -1, text: "for the board" }] },
    ])
  })

  it("keeps a soft line break the file already has", () => {
    const kept = writeTextValue([
      {
        from: 0,
        runs: [
          { from: 0, text: "a" },
          { from: 1, text: "\n" },
          { from: 2, text: "b" },
        ],
      },
    ])
    expect(paragraphedText(kept)).toBe(kept)
  })

  it("leaves text with no line break as it was sent", () => {
    expect(paragraphedText("Revenue")).toBe("Revenue")
    expect(paragraphedText("")).toBe("")
    const json = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Revenue" }] }])
    expect(paragraphedText(json)).toBe(json)
  })

  it("splits the words of each table cell", () => {
    const table = JSON.stringify({
      rows: [{ from: 0, cells: [[{ from: 0, runs: [{ from: -1, text: "Owner\nCFO" }] }], [{ from: 0, runs: [] }]] }],
    })
    expect(readTableValue(paragraphedTable(table))?.rows[0]?.cells[0]).toEqual([
      { from: 0, runs: [{ from: -1, text: "Owner" }] },
      { from: 0, runs: [{ from: -1, text: "CFO" }] },
    ])
  })

  it("leaves a table with no line break as it was sent", () => {
    const table = JSON.stringify({ rows: [{ from: 0, cells: [[{ from: 0, runs: [{ from: -1, text: "Owner" }] }]] }] })
    expect(paragraphedTable(table)).toBe(table)
  })
})
