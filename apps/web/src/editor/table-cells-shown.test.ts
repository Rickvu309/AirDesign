import { changedTable, openingTable, sizeDefault, type TableValue } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { cellsShown } from "@/editor/table-cells-shown"

function typed(rows: readonly (readonly string[])[]): TableValue {
  let table = openingTable(rows.length, rows[0]?.length ?? 1)
  rows.forEach((row, at) =>
    row.forEach((text, column) => {
      table = changedTable(table, { change: "cell", row: at, column, text }) ?? table
    }),
  )
  return table
}

const whole = { rows: [0, 1], columns: [0, 1] } as const

describe("cells shown in the Cells section", () => {
  it("shows the one value every picked cell shares", () => {
    const table = changedTable(
      typed([
        ["A", "B"],
        ["C", "D"],
      ]),
      {
        change: "style",
        cells: whole,
        style: { size: 12, bold: true },
      },
    )!
    const shown = cellsShown(table, whole)
    expect(shown.size).toEqual({ value: 12, mixed: false })
    expect(shown.bold).toEqual({ value: true, mixed: false })
    expect(shown.italic).toEqual({ value: false, mixed: false })
    expect(shown.align).toEqual({ value: "left", mixed: false })
  })

  it("shows Mixed when the picked cells differ, and one cell's own value when only it is picked", () => {
    const table = changedTable(
      typed([
        ["A", "B"],
        ["C", "D"],
      ]),
      {
        change: "style",
        cells: { rows: [1, 1], columns: [1, 1] },
        style: { size: 12, align: "center" },
      },
    )!
    const shown = cellsShown(table, whole)
    expect(shown.size.mixed).toBe(true)
    expect(shown.align.mixed).toBe(true)
    expect(shown.bold.mixed).toBe(false)
    expect(cellsShown(table, { rows: [1, 1], columns: [1, 1] }).size).toEqual({ value: 12, mixed: false })
  })

  it("leaves empty cells out of the text values, and shows the default size when no picked cell holds text", () => {
    const table = changedTable(
      typed([
        ["A", ""],
        ["", ""],
      ]),
      {
        change: "style",
        cells: whole,
        style: { size: 14 },
      },
    )!
    expect(cellsShown(table, whole).size).toEqual({ value: 14, mixed: false })
    expect(cellsShown(table, { rows: [1, 1], columns: [0, 1] }).size).toEqual({ value: sizeDefault, mixed: false })
  })

  it("shows Mixed fill when only some picked cells are filled", () => {
    const filled = changedTable(
      typed([
        ["A", "B"],
        ["C", "D"],
      ]),
      {
        change: "fill",
        cells: { rows: [0, 0], columns: [0, 1] },
        fill: { solid: { scheme: "accent1" } },
      },
    )!
    expect(cellsShown(filled, { rows: [0, 0], columns: [0, 1] }).fill).toEqual({
      value: { scheme: "accent1" },
      mixed: false,
    })
    expect(cellsShown(filled, whole).fill.mixed).toBe(true)
  })
})
