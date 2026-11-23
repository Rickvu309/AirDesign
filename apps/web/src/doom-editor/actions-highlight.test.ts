import { describe, expect, it } from "vitest"
import { stepHighlight } from "./actions-highlight"

const layout = { rows: 3, icons: 19, columns: 8 }

describe("the Actions highlight", () => {
  it("starts on the first result from either arrow", () => {
    expect(stepHighlight(layout, null, "ArrowDown")).toBe(0)
    expect(stepHighlight(layout, null, "ArrowUp")).toBe(0)
  })

  it("stops at both ends instead of wrapping", () => {
    expect(stepHighlight(layout, 0, "ArrowUp")).toBe(0)
    expect(stepHighlight(layout, 3 + 18, "ArrowDown")).toBe(3 + 18)
  })

  it("steps through the rows one at a time and into the first icon", () => {
    expect(stepHighlight(layout, 1, "ArrowDown")).toBe(2)
    expect(stepHighlight(layout, 2, "ArrowDown")).toBe(3)
    expect(stepHighlight(layout, 3, "ArrowUp")).toBe(2)
  })

  it("moves a whole icon row with Down and Up", () => {
    expect(stepHighlight(layout, 3 + 2, "ArrowDown")).toBe(3 + 10)
    expect(stepHighlight(layout, 3 + 10, "ArrowUp")).toBe(3 + 2)
    expect(stepHighlight(layout, 3 + 6, "ArrowUp")).toBe(2)
    expect(stepHighlight({ rows: 0, icons: 19, columns: 8 }, 6, "ArrowUp")).toBe(6)
  })

  it("lands on the last icon when the row below is short", () => {
    expect(stepHighlight(layout, 3 + 14, "ArrowDown")).toBe(3 + 18)
  })

  it("moves within an icon row with Left and Right and stops at its edges", () => {
    expect(stepHighlight(layout, 3 + 9, "ArrowRight")).toBe(3 + 10)
    expect(stepHighlight(layout, 3 + 9, "ArrowLeft")).toBe(3 + 8)
    expect(stepHighlight(layout, 3 + 8, "ArrowLeft")).toBe(3 + 8)
    expect(stepHighlight(layout, 3 + 7, "ArrowRight")).toBe(3 + 7)
    expect(stepHighlight(layout, 3 + 18, "ArrowRight")).toBe(3 + 18)
  })

  it("leaves Left and Right to the text caret outside the icon grid", () => {
    expect(stepHighlight(layout, null, "ArrowLeft")).toBeNull()
    expect(stepHighlight(layout, 1, "ArrowRight")).toBeNull()
  })

  it("has nothing to highlight when nothing matches", () => {
    expect(stepHighlight({ rows: 0, icons: 0, columns: 8 }, null, "ArrowDown")).toBeNull()
  })
})
