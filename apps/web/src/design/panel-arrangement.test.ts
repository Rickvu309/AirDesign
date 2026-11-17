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
