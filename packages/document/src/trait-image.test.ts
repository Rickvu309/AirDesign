import { expect, it } from "vitest"
import { image } from "./trait-image.js"
import { readValue } from "./value-kind.js"

it("stores one picture placement and refuses simultaneous modes", () => {
  for (const mode of ["fill", "fit", "crop", "tile", "stretch"]) expect(readValue(image.fields.mode, mode)).toBe(mode)
  expect(readValue(image.fields.mode, { fill: true, fit: true })).toBeNull()
  expect(readValue(image.fields.mode, ["crop", "tile"])).toBeNull()
})

const black = { rgb: "000000", transforms: [{ op: "alpha", val: 50_000 }] }

it("stores a colour laid over a picture and a blur amount, and refuses a blur past the whole picture", () => {
  expect(readValue(image.fields.overlay, { none: true })).toEqual({ none: true })
  expect(readValue(image.fields.overlay, { solid: black })).toEqual({ solid: black })
  expect(readValue(image.fields.overlay, { solid: true })).toBeNull()
  expect(readValue(image.fields.overlay, { none: true, solid: black })).toBeNull()
  expect(readValue(image.fields.blur, 0)).toBe(0)
  expect(readValue(image.fields.blur, 40_000)).toBe(40_000)
  expect(readValue(image.fields.blur, 100_000)).toBe(100_000)
  expect(readValue(image.fields.blur, 100_001)).toBeNull()
  expect(readValue(image.fields.blur, -1)).toBeNull()
})
