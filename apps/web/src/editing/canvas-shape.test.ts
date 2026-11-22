import type { PaintLine } from "@airdesign/pptx"
import { describe, expect, it } from "vitest"
import { canvasLine } from "@/editing/canvas-shape"

const css = (hex: string): string => `#${hex}`

const line: PaintLine = {
  fill: { type: "solid", color: { hex: "334455", alpha: 1 } },
  width: 12_700,
  dash: null,
  head: null,
  tail: null,
}

describe("canvasLine", () => {
  it("adds nothing the file did not give", () => {
    expect(canvasLine({ ...line, head: "triangle", headWidth: "med", headLength: "med" })).toEqual({
      color: css("334455"),
      width: 12_700,
      dash: null,
      head: "triangle",
    })
  })

  it.each([
    ["rnd", "round"],
    ["sq", "square"],
    ["flat", "butt"],
  ])("maps the cap %s to %s", (cap, expected) => {
    expect(canvasLine({ ...line, cap })?.cap).toBe(expected)
  })

  it.each([
    [{ kind: "round" as const }, { kind: "round" }],
    [{ kind: "bevel" as const }, { kind: "bevel" }],
    [
      { kind: "miter" as const, limit: 8 },
      { kind: "miter", limit: 8 },
    ],
  ])("carries the join %j", (join, expected) => {
    expect(canvasLine({ ...line, join })?.join).toEqual(expected)
  })

  it.each(["dbl", "thickThin", "thinThick", "tri"])("carries the compound %s", (compound) => {
    expect(canvasLine({ ...line, compound })?.compound).toBe(compound)
  })

  it("leaves a single line unchanged", () => {
    expect(canvasLine({ ...line, compound: "sng" })).not.toHaveProperty("compound")
  })

  it("flattens a custom dash into line widths and prefers it to a preset dash", () => {
    const dashes = [
      { dash: 4, space: 1 },
      { dash: 0.5, space: 2.5 },
    ]
    expect(canvasLine({ ...line, dash: "dash", dashes })?.dash).toEqual([4, 1, 0.5, 2.5])
  })

  it("paints a custom dash of no length as a solid line", () => {
    expect(canvasLine({ ...line, dashes: [{ dash: 0, space: 0 }] })?.dash).toBeNull()
  })

  it.each([
    ["sm", 2],
    ["lg", 5],
  ])("scales an arrow of size %s to %s line widths", (size, scale) => {
    const painted = canvasLine({
      ...line,
      head: "triangle",
      headWidth: size,
      tail: "oval",
      tailLength: size,
    })
    expect(painted?.headSize).toEqual({ width: scale, length: 3 })
    expect(painted?.tailSize).toEqual({ width: 3, length: scale })
  })

  it("keeps the size of an end that has no arrowhead out of the line", () => {
    expect(canvasLine({ ...line, headWidth: "lg" })).not.toHaveProperty("headSize")
  })
})
