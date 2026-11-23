import { expect, it } from "vitest"
import { namedFace, readStyleName, styleName } from "./named-face.js"
import { resolveFont } from "./source.js"

it("reads a weight from any served family's named face and keeps the stored typeface", () => {
  expect(namedFace("Inter SemiBold")).toEqual({
    family: "Inter",
    typeface: "Inter SemiBold",
    name: "SemiBold",
    weight: 600,
  })
  expect(namedFace("lato light")).toEqual({ family: "Lato", typeface: "lato light", name: "Light", weight: 300 })
  expect(namedFace("Open Sans Semi Bold")).toMatchObject({ family: "Open Sans", name: "SemiBold", weight: 600 })
  expect(namedFace("Montserrat ExtraBold")).toMatchObject({ family: "Montserrat", weight: 800 })
  expect(namedFace("Poppins Thin")).toMatchObject({ family: "Poppins", weight: 100 })
  expect(resolveFont("Inter Black")?.family).toBe("Inter")
})

it("leaves families, twins and unknown names alone", () => {
  expect(namedFace("Archivo Black")).toBeUndefined()
  expect(resolveFont("Archivo Black")?.family).toBe("Archivo Black")
  expect(namedFace("Inter")).toBeUndefined()
  expect(namedFace("Inter Bold")).toBeUndefined()
  expect(namedFace("Inter Regular")).toBeUndefined()
  expect(namedFace("Calibri Light")).toBeUndefined()
  expect(namedFace("Segoe UI Semibold")).toBeUndefined()
  expect(namedFace("Arial Medium")).toBeUndefined()
})

it("names each style as a font names it and reads the name back", () => {
  expect(styleName({ weight: 600, italic: false })).toBe("SemiBold")
  expect(styleName({ weight: 600, italic: true })).toBe("SemiBold Italic")
  expect(styleName({ weight: 400, italic: true })).toBe("Italic")
  expect(styleName({ weight: 400, italic: false })).toBe("Regular")
  for (const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900])
    for (const italic of [false, true]) expect(readStyleName(styleName({ weight, italic }))).toEqual({ weight, italic })
  expect(readStyleName("Heavy")).toBeUndefined()
})
