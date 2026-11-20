import type { LayoutGuide } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { gridLines, layoutBands, layoutSnapLines } from "./layout-guide-lines.js"

const tone = { color: "FF0000", opacity: 10, shown: true }
const lines = (change: Partial<LayoutGuide>): LayoutGuide => ({
  pattern: "columns",
  count: 4,
  align: "stretch",
  size: 0,
  offset: 0,
  gutter: 0,
  ...tone,
  ...change,
})

describe("layoutBands", () => {
  it("stretches columns between the margins with gutters between them", () => {
    expect(layoutBands(lines({ count: 3, offset: 100, gutter: 50 }), 1000)).toEqual([
      [100, 333.33333333333337],
      [383.33333333333337, 616.6666666666667],
      [666.6666666666667, 900],
    ])
  })

  it("starts fixed columns at the offset from the start, from the end, or centred", () => {
    const fixed = { count: 2, size: 200, gutter: 20, offset: 50 }
    expect(layoutBands(lines({ ...fixed, align: "start" }), 1000)).toEqual([
      [50, 250],
      [270, 470],
    ])
    expect(layoutBands(lines({ ...fixed, align: "end" }), 1000)).toEqual([
      [530, 730],
      [750, 950],
    ])
    expect(layoutBands(lines({ ...fixed, align: "center" }), 1000)).toEqual([
      [290, 490],
      [510, 710],
    ])
  })

  it("draws no band narrower than nothing", () => {
    expect(layoutBands(lines({ count: 5, offset: 400, gutter: 100 }), 1000)).toEqual([])
  })
})

describe("gridLines", () => {
  it("draws a line every size inside the slide", () => {
    expect(gridLines(300, 1000)).toEqual([300, 600, 900])
    expect(gridLines(0, 1000)).toEqual([])
  })
})

describe("layoutSnapLines", () => {
  it("gives every column edge, row edge and grid line as a snap line, shown or not", () => {
    const guides: readonly LayoutGuide[] = [
      lines({ count: 2, gutter: 100 }),
      lines({ pattern: "rows", count: 1, offset: 50, shown: false }),
      lines({ pattern: "grid", size: 400 }),
    ]
    expect(layoutSnapLines(guides, 1000, 600)).toEqual({
      x: [0, 450, 550, 1000, 400, 800],
      y: [50, 550, 400],
    })
  })
})
