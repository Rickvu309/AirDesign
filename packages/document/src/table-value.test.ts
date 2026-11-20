import { describe, expect, it } from "vitest"
import {
  cellText,
  changedTable,
  limits,
  openingTable,
  readTableValue,
  writeTableValue,
  type TableValue,
} from "./index.js"

const empty = [{ from: 0, runs: [] }]

describe("table value", () => {
  it("opens a new table with one empty cell per row and column, each row its own", () => {
    const table = openingTable(2, 3)
    expect(table.rows.map((row) => row.from)).toEqual([0, 1])
    expect(table.rows.every((row) => row.cells.length === 3 && row.cells.every((cell) => cellText(cell) === ""))).toBe(
      true,
    )
    expect(readTableValue(writeTableValue(table))).toEqual(table)
  })

  it("refuses a value that is not a table a row can be written from", () => {
    const cell = JSON.stringify(empty)
    const read = (rows: string) => readTableValue(`{"rows":${rows}}`)
    expect(read(`[{"from":0,"cells":[${cell}]}]`)).not.toBeNull()
    expect(read("[]")).toBeNull()
    expect(read(`[{"from":0,"cells":[]}]`)).toBeNull()
    expect(read(`[{"from":0,"cells":[${cell}]},{"from":1,"cells":[${cell},${cell}]}]`)).toBeNull()
    expect(read(`[{"from":1,"cells":[${cell}]},{"from":0,"cells":[${cell}]}]`)).toBeNull()
    expect(read(`[{"from":0,"cells":[${cell}]},{"from":0,"cells":[${cell}]}]`)).toBeNull()
    expect(read(`[{"from":-2,"cells":[${cell}]}]`)).toBeNull()
    expect(read(`[{"from":0,"cells":["x"]}]`)).toBeNull()
    expect(read(`[{"from":0,"cells":[${cell}],"h":1}]`)).toBeNull()
    expect(readTableValue(cell)).toBeNull()
    expect(readTableValue("Hello")).toBeNull()
    expect(readTableValue(writeTableValue(openingTable(limits.tableRows + 1, 1)))).toBeNull()
    expect(readTableValue(writeTableValue(openingTable(1, limits.tableColumns + 1)))).toBeNull()
  })

  it("types into one cell and keeps the formatting source of its paragraph and run", () => {
    const formatted: TableValue = { rows: [{ from: 0, cells: [[{ from: 2, runs: [{ from: 1, text: "Old" }] }]] }] }
    const typed = changedTable(formatted, { change: "cell", row: 0, column: 0, text: "New\nLine" })
    expect(typed?.rows[0]?.cells[0]).toEqual([
      { from: 2, runs: [{ from: 1, text: "New" }] },
      { from: 2, runs: [{ from: -1, text: "Line" }] },
    ])
    expect(changedTable(formatted, { change: "cell", row: 0, column: 0, text: "Old" })).toBe(formatted)
    expect(changedTable(formatted, { change: "cell", row: 1, column: 0, text: "x" })).toBeNull()
    expect(changedTable(formatted, { change: "cell", row: 0, column: 1, text: "x" })).toBeNull()
  })

  it("adds an empty row above or below a row and removes any row but the last", () => {
    const table = changedTable(openingTable(2, 2), { change: "cell", row: 1, column: 0, text: "B" })!
    const above = changedTable(table, { change: "row", row: 1, place: "above" })!
    expect(above.rows.map((row) => row.from)).toEqual([0, -1, 1])
    expect(above.rows[1]?.cells).toEqual([empty, empty])
    const below = changedTable(table, { change: "row", row: 1, place: "below" })!
    expect(below.rows.map((row) => row.from)).toEqual([0, 1, -1])
    expect(readTableValue(writeTableValue(below))).toEqual(below)
    const removed = changedTable(below, { change: "remove-row", row: 0 })!
    expect(removed.rows.map((row) => row.from)).toEqual([1, -1])
    expect(cellText(removed.rows[0]!.cells[0]!)).toBe("B")
    const last = changedTable(openingTable(1, 2), { change: "remove-row", row: 0 })
    expect(last).toBeNull()
    expect(changedTable(table, { change: "row", row: 2, place: "below" })).toBeNull()
    expect(changedTable(openingTable(limits.tableRows, 1), { change: "row", row: 0, place: "below" })).toBeNull()
  })
})

describe("cell fills and borders", () => {
  const accent = { solid: { scheme: "accent1" } } as const
  const thin = { width: 12700, fill: { solid: { scheme: "tx1" } } } as const
  const whole = { rows: [0, 1], columns: [0, 2] } as const

  it("reads and writes each cell's fill and four borders inside its row, and nothing for a row without them", () => {
    const table: TableValue = {
      rows: [
        { from: 0, cells: [empty, empty], fills: [accent, null], borders: [{ bottom: thin }, null] },
        { from: 1, cells: [empty, empty] },
      ],
    }
    const written = writeTableValue(table)
    expect(readTableValue(written)).toEqual(table)
    expect(JSON.parse(written).rows[1]).toEqual({ from: 1, cells: [empty, empty] })
    const plain = { rows: [{ from: 0, cells: [empty], fills: [null], borders: [null] }] }
    expect(writeTableValue(plain)).toBe(writeTableValue({ rows: [{ from: 0, cells: [empty] }] }))
  })

  it("refuses fills and borders that do not match the row's cells or are not a line's fill, width and dash", () => {
    const cell = JSON.stringify(empty)
    const read = (extra: string) => readTableValue(`{"rows":[{"from":0,"cells":[${cell},${cell}]${extra}}]}`)
    expect(read(`,"fills":[{"solid":{"scheme":"accent1"}},null]`)).not.toBeNull()
    expect(read(`,"fills":[{"solid":{"scheme":"accent1"}}]`)).toBeNull()
    expect(read(`,"fills":[{"solid":"accent1"},null]`)).toBeNull()
    expect(read(`,"fills":[{"group":true},null]`)).toBeNull()
    expect(read(`,"borders":[{"top":{"width":12700,"dash":"dot"}},null]`)).not.toBeNull()
    expect(read(`,"borders":[{"top":{}},null]`)).toBeNull()
    expect(read(`,"borders":[{"middle":{"width":1}},null]`)).toBeNull()
    expect(read(`,"borders":[{"top":{"width":-1}},null]`)).toBeNull()
    expect(read(`,"borders":[{"top":{"cap":"rnd"}},null]`)).toBeNull()
  })

  it("fills the cells of a range and leaves the rest as they are", () => {
    const table = openingTable(3, 3)
    const filled = changedTable(table, { change: "fill", cells: { rows: [0, 0], columns: [0, 2] }, fill: accent })!
    expect(filled.rows[0]?.fills).toEqual([accent, accent, accent])
    expect(filled.rows[1]?.fills ?? [null, null, null]).toEqual([null, null, null])
    expect(changedTable(filled, { change: "fill", cells: { rows: [0, 0], columns: [0, 2] }, fill: accent })).toBe(
      filled,
    )
    expect(changedTable(table, { change: "fill", cells: { rows: [0, 3], columns: [0, 0] }, fill: accent })).toBeNull()
    expect(changedTable(table, { change: "fill", cells: { rows: [1, 0], columns: [0, 0] }, fill: accent })).toBeNull()
  })

  it("borders the chosen edges of a range on both cells that share each edge", () => {
    const table = openingTable(3, 3)
    const below = changedTable(table, {
      change: "border",
      cells: { rows: [0, 0], columns: [0, 2] },
      sides: "bottom",
      border: thin,
    })!
    expect(below.rows[0]?.borders).toEqual([{ bottom: thin }, { bottom: thin }, { bottom: thin }])
    expect(below.rows[1]?.borders).toEqual([{ top: thin }, { top: thin }, { top: thin }])
    expect(below.rows[2]?.borders ?? [null, null, null]).toEqual([null, null, null])
    const outside = changedTable(table, { change: "border", cells: whole, sides: "outside", border: thin })!
    expect(outside.rows[0]?.borders?.[1]).toEqual({ top: thin })
    expect(outside.rows[1]?.borders?.[0]).toEqual({ left: thin, bottom: thin })
    expect(outside.rows[2]?.borders?.[2]).toEqual({ top: thin })
    const inside = changedTable(table, { change: "border", cells: whole, sides: "inside", border: thin })!
    expect(inside.rows[0]?.borders?.[0]).toEqual({ right: thin, bottom: thin })
    expect(inside.rows[1]?.borders?.[1]).toEqual({ top: thin, left: thin, right: thin })
    const dotted = changedTable(below, {
      change: "border",
      cells: { rows: [0, 0], columns: [0, 0] },
      sides: "bottom",
      border: { dash: "dot" },
    })!
    expect(dotted.rows[0]?.borders?.[0]).toEqual({ bottom: { ...thin, dash: "dot" } })
  })

  it("keeps each cell's fill and borders beside it when rows and columns move and when its text is typed", () => {
    const table = changedTable(openingTable(2, 2), {
      change: "fill",
      cells: { rows: [0, 0], columns: [1, 1] },
      fill: accent,
    })!
    const column = changedTable(table, { change: "column", column: 0, place: "after" })!
    expect(column.rows[0]?.fills).toEqual([null, null, accent])
    const removed = changedTable(column, { change: "remove-column", column: 0 })!
    expect(removed.rows[0]?.fills).toEqual([null, accent])
    const row = changedTable(removed, { change: "row", row: 0, place: "above" })!
    expect(row.rows[1]?.fills).toEqual([null, accent])
    const typed = changedTable(row, { change: "cell", row: 1, column: 1, text: "Q3" })!
    expect(typed.rows[1]?.fills).toEqual([null, accent])
  })

  it("keeps a run's format when a person types over it", () => {
    const bold: TableValue = {
      rows: [{ from: 0, cells: [[{ from: 0, runs: [{ from: 0, text: "Old", bold: true, size: 2400 }] }]] }],
    }
    const typed = changedTable(bold, { change: "cell", row: 0, column: 0, text: "New" })
    expect(typed?.rows[0]?.cells[0]).toEqual([{ from: 0, runs: [{ from: 0, text: "New", bold: true, size: 2400 }] }])
  })
})

describe("column widths and row heights", () => {
  const sized: TableValue = {
    rows: [
      { from: 0, cells: [empty, empty, empty], height: 400_000 },
      { from: 1, cells: [empty, empty, empty], height: 300_000 },
    ],
    widths: [1_000_000, 2_000_000, 3_000_000],
  }

  it("reads and writes a width per column and a height per row, and refuses a width list of the wrong length", () => {
    expect(readTableValue(writeTableValue(sized))).toEqual(sized)
    const cell = JSON.stringify(empty)
    expect(readTableValue(`{"rows":[{"from":0,"cells":[${cell}]}],"widths":[1,2]}`)).toBeNull()
    expect(readTableValue(`{"rows":[{"from":0,"cells":[${cell}]}],"widths":[0]}`)).toBeNull()
    expect(readTableValue(`{"rows":[{"from":0,"cells":[${cell}],"height":-1}]}`)).toBeNull()
    expect(readTableValue(`{"rows":[{"from":0,"cells":[${cell}],"height":1.5}]}`)).toBeNull()
  })

  it("sets every column's width or every row's height at once", () => {
    const wider = changedTable(sized, { change: "widths", widths: [1_500_000, 1_500_000, 3_000_000] })!
    expect(wider.widths).toEqual([1_500_000, 1_500_000, 3_000_000])
    const taller = changedTable(sized, { change: "heights", heights: [500_000, 200_000] })!
    expect(taller.rows.map((row) => row.height)).toEqual([500_000, 200_000])
    expect(changedTable(sized, { change: "widths", widths: [1, 2] })).toBeNull()
    expect(changedTable(sized, { change: "widths", widths: [0, 1, 1] })).toBeNull()
    expect(changedTable(sized, { change: "heights", heights: [1] })).toBeNull()
    expect(changedTable(sized, { change: "widths", widths: sized.widths! })).toBe(sized)
  })

  it("gives a new column its neighbour's width and a new row its neighbour's height, and drops a removed one's", () => {
    const column = changedTable(sized, { change: "column", column: 1, place: "after" })!
    expect(column.widths).toEqual([1_000_000, 2_000_000, 2_000_000, 3_000_000])
    expect(changedTable(column, { change: "remove-column", column: 0 })!.widths).toEqual([
      2_000_000, 2_000_000, 3_000_000,
    ])
    const row = changedTable(sized, { change: "row", row: 0, place: "below" })!
    expect(row.rows.map((each) => each.height)).toEqual([400_000, 400_000, 300_000])
    expect(changedTable(openingTable(2, 2), { change: "column", column: 0, place: "after" })!.widths).toBeUndefined()
  })
})
