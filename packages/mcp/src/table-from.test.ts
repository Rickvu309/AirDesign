import { readTableValue, type TableValue } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { cellProblem } from "./text-from.js"

function table(rows: readonly unknown[], columns?: readonly number[]): TableValue {
  const read = readTableValue(JSON.stringify(columns === undefined ? { rows } : { rows, columns }))
  if (read === null) throw new Error("table")
  return read
}

const file = table([{ from: 0, cells: [[{ from: 0, runs: [{ from: 0, text: "Owner" }] }], [{ from: 0, runs: [] }]] }])

describe("a table value names only the paragraphs and runs its cells have", () => {
  it("takes kept runs, new runs and a repeated paragraph", () => {
    const sent = table([
      {
        from: 0,
        cells: [
          [
            { from: 0, runs: [{ from: 0, text: "Lead" }] },
            { from: 0, runs: [{ from: -1, text: "again" }] },
          ],
          [{ from: 0, runs: [{ from: -1, text: "CFO" }] }],
        ],
      },
    ])
    expect(cellProblem(file, sent)).toBeUndefined()
  })

  it("refuses a run an empty cell does not have, and names the cell", () => {
    const sent = table([{ from: 0, cells: [[{ from: 0, runs: [] }], [{ from: 0, runs: [{ from: 0, text: "CFO" }] }]] }])
    expect(cellProblem(file, sent)).toEqual({
      code: "text-from",
      detail: "Row 0, cell 1: Paragraph 0 of the file has no runs. Use -1 for a new run.",
    })
  })

  it("refuses a paragraph a cell does not have", () => {
    const sent = table([
      { from: 0, cells: [[{ from: 1, runs: [{ from: -1, text: "Two" }] }], [{ from: 0, runs: [] }]] },
    ])
    expect(cellProblem(file, sent)?.detail).toBe("Row 0, cell 0: The file has paragraphs 0.")
  })

  it("reads a cell of a new row or column as one empty paragraph", () => {
    const grown = table(
      [
        { from: 0, cells: [[{ from: 0, runs: [] }], [{ from: 0, runs: [{ from: 0, text: "x" }] }]] },
        { from: -1, cells: [[{ from: 0, runs: [{ from: -1, text: "New" }] }], [{ from: 0, runs: [] }]] },
      ],
      [0, -1],
    )
    expect(cellProblem(file, grown)?.detail).toBe(
      "Row 0, cell 1: Paragraph 0 of the file has no runs. Use -1 for a new run.",
    )
  })
})
