import { traitNames, traits } from "@airdesign/document"
import { expect, it } from "vitest"
import { sectionStrips } from "./panel-arrangement"

it("places every wire field exactly once, naming anything missing or repeated", () => {
  const faults = traitNames.flatMap((trait) => {
    const placed = sectionStrips[trait].flat().map(({ field }) => field)
    const fields = [...Object.entries(traits[trait].fields), ...Object.entries(traits[trait].inputs)]
      .filter(([, field]) => field.desc.kind !== "alpha")
      .map(([field]) => field)
    return fields.flatMap((field) => {
      const count = placed.filter((each) => each === field).length
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
