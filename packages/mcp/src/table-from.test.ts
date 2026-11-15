import { elementId, writeTableValue } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { tableProblem } from "./table-from.js"

describe("tableProblem", () => {
  const blank = [{ from: 0, runs: [] }]
  const words = (text: string) => [{ from: 0, runs: [{ from: 0, text }] }]
  const file = writeTableValue({
    rows: [
      { from: 0, cells: [words("Region"), words("Sales")] },
      { from: 1, cells: [blank, blank] },
    ],
  })
  const table = elementId("258.4")
  const floors = new Map([[table, file]])
  const sent = (value: string) => tableProblem(floors, [{ node: table, value, readAt: 0 }])
  const accent = { solid: { scheme: "accent1" } } as const

  it("lets through a table value whose rows, columns and cell text come from the file or are new", () => {
    const filled = {
      rows: [
        { from: 0, cells: [words("North"), words("Sales")], fills: [accent, accent] },
        { from: -1, cells: [blank, blank] },
      ],
      columns: [0, 1],
    }
    expect(sent(writeTableValue(filled))).toBeUndefined()
    expect(sent(writeTableValue({ rows: [{ from: 1, cells: [blank, blank, blank] }], columns: [0, -1, 1] }))).toBe(
      undefined,
    )
  })

  it("names the rows, columns and runs the file has when a from is not one of them", () => {
    expect(sent(writeTableValue({ rows: [{ from: 2, cells: [blank, blank] }] }))).toEqual({
      code: "text-from",
      detail: "The file's table has rows 0 and 1. Use one of them, or -1 for a new row.",
    })
    expect(sent(writeTableValue({ rows: [{ from: 0, cells: [blank, blank] }], columns: [0, 2] }))).toEqual({
      code: "text-from",
      detail: "The file's table has columns 0 and 1. Use one of them, or -1 for a new column.",
    })
    const run = [{ from: 0, runs: [{ from: 3, text: "No" }] }]
    expect(sent(writeTableValue({ rows: [{ from: 0, cells: [blank, run] }] }))).toEqual({
      code: "text-from",
      detail: "Paragraph 0 of the file has runs 0. Use one of them, or -1 for a new run.",
    })
  })

  it("asks for a JSON table value when the value is not one", () => {
    expect(sent("Q3")).toEqual({
      code: "field",
      detail:
        "Send a JSON table value for this table, as airdesign_read_deck lists it. Each from must be one the file has, and -1 is a new one.",
    })
  })
})
