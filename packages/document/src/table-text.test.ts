import { describe, expect, it } from "vitest"
import {
  cellText,
  changedTable,
  limits,
  openingTable,
  pastedTable,
  readTabbed,
  tabbedHtml,
  writeTabbed,
} from "./index.js"

const texts = (rows: readonly { readonly cells: readonly Parameters<typeof cellText>[0][] }[]) =>
  rows.map((row) => row.cells.map(cellText))

describe("tab-separated cells", () => {
  it("reads rows and cells, drops the last line break and pads short rows", () => {
    expect(readTabbed("Region\tSales\r\nNorth\t12\nSouth\n")).toEqual([
      ["Region", "Sales"],
      ["North", "12"],
      ["South", ""],
    ])
  })

  it("reads a quoted cell that holds a line break, a tab or a doubled quote", () => {
    expect(readTabbed('"two\nlines"\t"a\tb"\t"say ""hi"""\tplain "x"')).toEqual([
      ["two\nlines", "a\tb", 'say "hi"', 'plain "x"'],
    ])
  })

  it("writes what it reads, quoting only the cells that need it", () => {
    const rows = [
      ["Region", "two\nlines"],
      ['"quoted"', "a\tb"],
    ]
    expect(writeTabbed(rows)).toBe('Region\t"two\nlines"\n"""quoted"""\t"a\tb"')
    expect(readTabbed(writeTabbed(rows))).toEqual(rows)
  })

  it("writes an HTML table with escaped text and a line break per new line", () => {
    expect(tabbedHtml([["a & b", "<c>\nd"]])).toBe(
      '<meta charset="utf-8"><table><tr><td>a &amp; b</td><td>&lt;c&gt;<br>d</td></tr></table>',
    )
  })
})

describe("pasted cells in a table", () => {
  it("makes a table of the pasted rows and columns with their text", () => {
    const table = pastedTable([
      ["Region", "Sales"],
      ["North", "12"],
      ["South", ""],
    ])!
    expect(texts(table.rows)).toEqual([
      ["Region", "Sales"],
      ["North", "12"],
      ["South", ""],
    ])
  })

  it("refuses a paste with more rows or columns than a table holds", () => {
    expect(pastedTable(Array.from({ length: limits.tableRows + 1 }, () => ["a"]))).toBeNull()
    expect(pastedTable([Array.from({ length: limits.tableColumns + 1 }, () => "a")])).toBeNull()
    expect(pastedTable([])).toBeNull()
  })

  it("fills cells from the one pasted into and adds the rows and columns the block needs", () => {
    const start = changedTable(openingTable(2, 2), { change: "cell", row: 0, column: 0, text: "Kept" })!
    const filled = changedTable(start, {
      change: "paste",
      row: 1,
      column: 1,
      cells: [
        ["a", "b"],
        ["c", "d"],
      ],
    })!
    expect(texts(filled.rows)).toEqual([
      ["Kept", "", ""],
      ["", "a", "b"],
      ["", "c", "d"],
    ])
    expect(
      changedTable(start, {
        change: "paste",
        row: 0,
        column: 0,
        cells: [Array.from({ length: limits.tableColumns + 1 }, () => "x")],
      }),
    ).toBeNull()
    expect(changedTable(start, { change: "paste", row: 2, column: 0, cells: [["x"]] })).toBeNull()
  })
})
