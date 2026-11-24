import { expect, it } from "vitest"
import { fontFamily, resolveFont, fontFaces } from "./index.js"

it("resolves catalog families exactly without guessing and keeps the chosen name", () => {
  expect(resolveFont("Montserrat")).toMatchObject({ family: "Montserrat", license: "OFL", folder: "ofl/montserrat" })
  expect(resolveFont("montserrat")).toEqual(resolveFont("Montserrat"))
  expect(resolveFont("Montserat")).toBeUndefined()
  expect(resolveFont("../montserrat")).toBeUndefined()
  expect(fontFamily("Calibri")).toBe(fontFamily("Carlito"))
  expect(fontFamily("Calibri")).not.toContain('"Calibri"')
  expect(fontFamily("DejaVu Serif")).toBe(fontFamily(null))
  expect(fontFamily(null)).not.toContain('"Geist"')
  expect(resolveFont("Arial Narrow")).toMatchObject({
    family: "Liberation Sans Narrow",
    license: "GPL-2.0-with-font-exception",
  })
})

it("reads only a family's declared faces and variable weight range", () => {
  const metadata = `name: "Montserrat"
license: "OFL"
fonts {
 name: "Montserrat"
 style: "normal"
 weight: 400
 filename: "Montserrat[wght].ttf"
}
fonts {
 name: "Montserrat"
 style: "italic"
 weight: 400
 filename: "Montserrat-Italic[wght].ttf"
}
axes {
 tag: "wght"
 min_value: 100
 max_value: 900
}`
  const family = resolveFont("Montserrat")
  if (family === undefined) throw new Error("font")
  expect(fontFaces(family, metadata)).toEqual([
    { file: "Montserrat[wght].ttf", style: "normal", weight: "100 900" },
    { file: "Montserrat-Italic[wght].ttf", style: "italic", weight: "100 900" },
  ])
  expect(() =>
    fontFaces(family, metadata.replace('filename: "Montserrat[wght].ttf"', 'filename: "../private"')),
  ).toThrow()
  expect(() => fontFaces(family, metadata.replace('license: "OFL"', 'license: "proprietary"'))).toThrow()
})

it("resolves every metric twin with its redistribution license", async () => {
  const { default: twins } = await import("./twins.json", { with: { type: "json" } })
  for (const twin of twins)
    expect(resolveFont(twin.family)).toMatchObject({ family: twin.prefer, license: twin.license })
})
