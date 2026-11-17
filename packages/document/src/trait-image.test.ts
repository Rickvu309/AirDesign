import { expect, it } from "vitest"
import { image } from "./trait-image.js"
import { readValue } from "./value-kind.js"

it("stores one picture placement and refuses simultaneous modes", () => {
  for (const mode of ["fill", "fit", "crop", "tile", "stretch"]) expect(readValue(image.fields.mode, mode)).toBe(mode)
  expect(readValue(image.fields.mode, { fill: true, fit: true })).toBeNull()
  expect(readValue(image.fields.mode, ["crop", "tile"])).toBeNull()
})
