import { describe, expect, it } from "vitest"
import type { CanvasText, PaintBox } from "./record.js"
import { fitted, grownBox, heldFit, shrinkSteps } from "./text-fit.js"

const style = { font: "Arial", size: 254_000, points: 2_000, bold: false, italic: false, color: null }

const text = (fit: CanvasText["fit"], lineSpacing: CanvasText["paragraphs"][number]["lineSpacing"] = null) =>
  ({
    paragraphs: [{ from: 0, align: "left", lineSpacing, runs: [{ from: 0, text: "a", ...style }], endStyle: style }],
    anchor: "top",
    insets: { left: 0, top: 0, right: 0, bottom: 0 },
    wrap: true,
    ...(fit === undefined ? {} : { fit }),
  }) satisfies CanvasText

describe("shrink steps", () => {
  it("narrows the lines by 10 then 20 percent at each size before the size drops by 7.5 percent, down to a quarter, as PowerPoint does", () => {
    const steps = shrinkSteps({ kind: "shrink", scale: 1, reduction: 0 })
    expect(steps.slice(0, 5)).toEqual([
      [1, 0],
      [1, 0.1],
      [1, 0.2],
      [0.925, 0],
      [0.925, 0.1],
    ])
    expect(steps.at(-1)).toEqual([0.25, 0.2])
    expect(steps).toHaveLength(33)
  })

  it("starts from the scale the file stores and only goes smaller", () => {
    expect(shrinkSteps({ kind: "shrink", scale: 0.85, reduction: 0.2 }).slice(0, 2)).toEqual([
      [0.85, 0.2],
      [0.775, 0],
    ])
    expect(shrinkSteps({ kind: "shrink", scale: 0.9, reduction: 0 }).slice(0, 4)).toEqual([
      [0.9, 0],
      [0.9, 0.1],
      [0.9, 0.2],
      [0.85, 0],
    ])
  })

  it("keeps only the stored scale while the file's fit is held, as PowerPoint paints it until the text or box changes", () => {
    expect(shrinkSteps({ kind: "shrink", scale: 0.775, reduction: 0.2, held: true })).toEqual([[0.775, 0.2]])
  })

  it("lets go of the stored fit once the text a person sees differs from the text it was painted with", () => {
    const held = { kind: "shrink", scale: 0.775, reduction: 0.2, held: true } as const
    expect(heldFit(held, "Limiting resupply", "Limiting resupply")).toBe(held)
    expect(heldFit(held, "Limiting resupply.", "Limiting resupply")).toEqual({
      kind: "shrink",
      scale: 0.775,
      reduction: 0.2,
    })
    expect(heldFit({ kind: "grow" }, "a", "b")).toEqual({ kind: "grow" })
  })
})

describe("fitted text", () => {
  it("scales each size from the stored scale and takes the further reduction off the line spacing, as ECMA-376 subtracts it", () => {
    const shown = fitted(text({ kind: "shrink", scale: 0.5, reduction: 0.1 }, { percent: 0.7 }), [0.25, 0.2])
    const paragraph = shown.paragraphs[0]
    expect(paragraph?.runs[0]?.size).toBe(127_000)
    expect(paragraph?.runs[0]?.points).toBe(2_000)
    expect(paragraph?.endStyle.size).toBe(127_000)
    expect(paragraph?.lineSpacing).toEqual({ percent: 0.6 })
    expect(shown.fit).toEqual({ kind: "shrink", scale: 0.25, reduction: 0.2 })
  })

  it("keeps line spacing set in points, which the reduction does not apply to", () => {
    const shown = fitted(text({ kind: "shrink", scale: 1, reduction: 0 }, { length: 254_000 }), [1, 0.2])
    expect(shown.paragraphs[0]?.lineSpacing).toEqual({ length: 254_000 })
  })

  it("narrows single lines that the file leaves at their standard spacing", () => {
    const shown = fitted(text({ kind: "shrink", scale: 1, reduction: 0 }), [1, 0.1])
    expect(shown.paragraphs[0]?.lineSpacing).toEqual({ percent: 0.9 })
  })
})

describe("grown box", () => {
  const box: PaintBox = { x: 100, y: 100, width: 200, height: 50, rotation: 0, flipH: false, flipV: false }

  it("keeps the top edge for text at the top, the middle for text in the middle and the bottom edge for text at the bottom", () => {
    expect(grownBox(box, "top", 30)).toMatchObject({ y: 100, height: 80 })
    expect(grownBox(box, "middle", 30)).toMatchObject({ y: 85, height: 80 })
    expect(grownBox(box, "bottom", 30)).toMatchObject({ y: 70, height: 80 })
  })

  it("grows a turned box along its own height", () => {
    const turned = grownBox({ ...box, rotation: 90 }, "top", 30)
    expect(turned.height).toBe(80)
    expect(turned.x + turned.width / 2).toBeCloseTo(200 - 15)
    expect(turned.y + turned.height / 2).toBeCloseTo(125)
  })
})
