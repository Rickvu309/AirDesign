import { describe, expect, it } from "vitest"
import { placedText } from "./added-text.js"
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
})
