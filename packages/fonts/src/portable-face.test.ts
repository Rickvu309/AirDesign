import { expect, it } from "vitest"
import { portableFace, portableFaces } from "./portable-face.js"
import { resolveFont } from "./source.js"

it("resolves only verified static family names without renaming the stored typeface", () => {
  expect(portableFace("Lato Light")).toEqual({
    family: "Lato",
    typeface: "Lato Light",
    name: "Light",
    file: "Lato-Light.ttf",
    italic: "Lato-LightItalic.ttf",
  })
  for (const face of portableFaces("Lato")) expect(resolveFont(face.typeface)?.family).toBe("Lato")
  expect(portableFaces("Inter")).toEqual([])
  expect(portableFace("Inter Medium")).toBeUndefined()
})
