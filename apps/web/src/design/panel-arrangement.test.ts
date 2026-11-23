import { alignNames } from "@airdesign/document"
import { expect, it } from "vitest"
import { sectionStrips } from "./panel-arrangement"

it("gives every control in a strip the same name placement", () => {
  const faults = Object.entries(sectionStrips).flatMap(([trait, strips]) =>
    strips.flatMap((strip) =>
      new Set(strip.map((control) => control.name.show)).size > 1
        ? [trait + "." + strip.map(({ field }) => field).join(",")]
        : [],
    ),
  )
  expect(faults).toEqual([])
})

it("places Figma's size, spacing, format and paragraph strips in order", () => {
  expect(sectionStrips.text.map((strip) => strip.map(({ field }) => field))).toEqual([
    ["value"],
    ["style"],
    ["font"],
    ["weight", "size"],
    ["lineHeight", "letterSpacing"],
    ["bold", "italic", "underline", "strike"],
    ["align", "list"],
    ["case"],
    ["fill"],
    ["color"],
    ["spaceBefore", "spaceAfter"],
  ])
})

it("draws an icon for every text alignment a paragraph can hold, justify included", () => {
  const align = sectionStrips.text.flat().find((control) => control.field === "align")
  expect(Object.keys(align?.options ?? {})).toEqual([...alignNames])
})
