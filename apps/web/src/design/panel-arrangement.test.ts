import * as doom from "@airdesign/doom"
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

it("places size, formatting and paragraph strips in order", () => {
  expect(sectionStrips.text.map((strip) => strip.map(({ field }) => field))).toEqual([
    ["style"],
    ["font"],
    ["weight", "size"],
    ["bold", "italic", "underline", "strike"],
    ["align", "list"],
    ["fill"],
  ])
})

it("draws an icon for every text alignment a paragraph can hold, justify included", () => {
  const align = sectionStrips.text.flat().find((control) => control.field === "align")
  expect(Object.keys(align?.options ?? {})).toEqual([...doom.paragraphAligns])
})
