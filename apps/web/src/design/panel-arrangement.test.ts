import { slotted, traitNames, traits } from "@airdesign/document"
import { expect, it } from "vitest"
import { shownPlace } from "./panel"
import { sectionStrips } from "./panel-arrangement"

it("places every wire field exactly once, naming anything missing or repeated", () => {
  const faults = traitNames.flatMap((trait) => {
    const fields = [...Object.entries(traits[trait].fields), ...Object.entries(traits[trait].inputs)]
      .filter(([name, field]) => field.desc.kind !== "alpha" && !slotted(trait, name))
      .map(([field]) => field)
    return fields.flatMap((field) => {
      const place = shownPlace(trait, field)
      const count = sectionStrips[place.trait].flat().filter((each) => each.field === place.field).length
      return count === 1 ? [] : [`${trait}.${field}: placed ${count} times`]
    })
  })
  expect(faults).toEqual([])
})

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
