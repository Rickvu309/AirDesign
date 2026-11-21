import { describe, expect, it } from "vitest"
import { placedTable, placedText } from "./added-text.js"
import { readTableValue } from "./table-value.js"
import { readTextValue, writeTextValue } from "./text-value.js"

describe("an added layer has no file, so each from is a place", () => {
  it("makes every run new and every paragraph a copy of the layer's one paragraph", () => {
    const typed = writeTextValue([
      {
        from: 0,
        runs: [
          { from: 0, text: "Revenue", bold: true },
          { from: 1, text: " $16.8M" },
        ],
      },
      { from: 1, align: "right", runs: [{ from: 0, text: "+24%" }] },
    ])
    expect(readTextValue(placedText(typed))).toEqual([
      {
        from: 0,
        runs: [
          { from: -1, text: "Revenue", bold: true },
          { from: -1, text: " $16.8M" },
        ],
      },
      { from: 0, align: "right", runs: [{ from: -1, text: "+24%" }] },
    ])
  })

  it("leaves plain text and a value already in places as sent", () => {
    expect(placedText("Revenue")).toBe("Revenue")
    const placed = writeTextValue([{ from: 0, runs: [{ from: -1, text: "Revenue" }] }])
    expect(placedText(placed)).toBe(placed)
  })

  it("places the words of every cell of an added table", () => {
    const table = JSON.stringify({
      rows: [0, 1].map((from) => ({
        from,
        cells: [
          [
            { from: 0, runs: [{ from: 0, text: `Owner ${String(from)}` }] },
            { from: 1, runs: [] },
          ],
        ],
      })),
    })
    expect(readTableValue(placedTable(table))?.rows.map((row) => row.cells[0])).toEqual([
      [
        { from: 0, runs: [{ from: -1, text: "Owner 0" }] },
        { from: 0, runs: [] },
      ],
      [
        { from: 0, runs: [{ from: -1, text: "Owner 1" }] },
        { from: 0, runs: [] },
      ],
    ])
  })
})
