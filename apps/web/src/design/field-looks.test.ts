import { describe, expect, it } from "vitest"
import { fieldLooks, linesOf } from "./field-looks"
import type { PanelRow } from "./panel"

const row = (trait: PanelRow["trait"], field: string): PanelRow => ({
  trait,
  field,
  label: field,
  control: "length",
  desc: { kind: "flag" },
  value: 0,
  mixed: false,
  inherited: false,
  caption: true,
  reset: null,
  change: () => {
    throw new Error("unused")
  },
})

describe("property lines", () => {
  it("pairs position and size while keeping unknown fields on their own", () => {
    const rows = ["x", "y", "w", "h", "future"].map((field) => row("box", field))
    expect(linesOf(rows).map((line) => line.map(({ field }) => field))).toEqual([["x", "y"], ["w", "h"], ["future"]])
  })
  it("groups text controls and puts the font before size", () => {
    const rows = [
      "value",
      "color",
      "size",
      "font",
      "bold",
      "italic",
      "underline",
      "align",
      "bullet",
      "lineSpacing",
      "spaceBefore",
      "spaceAfter",
    ].map((field) => row("text", field))
    expect(linesOf(rows).map((line) => line.map(({ field }) => field))).toEqual([
      ["value"],
      ["font"],
      ["size", "lineSpacing"],
      ["bold", "italic", "underline"],
      ["align", "bullet"],
      ["color"],
      ["spaceBefore", "spaceAfter"],
    ])
  })
  it("declares icons without replacing the accessible field names", () => {
    for (const key of ["text.bold", "text.italic", "text.underline", "box.flipH", "box.flipV"])
      expect(fieldLooks[key]?.icon).toBeDefined()
    expect(fieldLooks["box.w"]?.short).toBe("W")
    expect(fieldLooks["line.fill"]?.options).toEqual(fieldLooks["fill.value"]?.options)
  })
})
