import { describe, expect, it } from "vitest"
import { readPastedCells } from "./index.js"

function clipboard(items: Readonly<Record<string, string>>) {
  return { getData: (type: string) => items[type] ?? "" }
}

describe("pasted cells", () => {
  it("reads the cells of a spreadsheet's HTML table, its line breaks, spaces and spanned cells", () => {
    const html = [
      '<html><body><table border="0"><colgroup><col></colgroup>',
      '<tr><td class="xl1">Region&nbsp;name</td><td colspan="2">Sales</td></tr>',
      "<tr><td>North<br>East</td><td>12</td><td>\n  14 </td></tr>",
      "</table></body></html>",
    ].join("")
    expect(readPastedCells(clipboard({ "text/html": html, "text/plain": "ignored" }))).toEqual([
      ["Region name", "Sales", ""],
      ["North\nEast", "12", "14"],
    ])
  })

  it("reads tab-separated text when the HTML holds no table", () => {
    const pasted = clipboard({ "text/html": "<div>Region</div>", "text/plain": "Region\tSales\nNorth\t12\n" })
    expect(readPastedCells(pasted)).toEqual([
      ["Region", "Sales"],
      ["North", "12"],
    ])
  })

  it("reads plain text with no tab or line break as one cell, and nothing as nothing", () => {
    expect(readPastedCells(clipboard({ "text/plain": "North" }))).toEqual([["North"]])
    expect(readPastedCells(clipboard({}))).toBeNull()
    expect(readPastedCells(null)).toBeNull()
  })
})
