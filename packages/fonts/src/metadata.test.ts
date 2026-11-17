import { expect, it } from "vitest"
import { fontFaces, resolveFont } from "./index.js"

it("refuses nested and unterminated face blocks", () => {
  const family = resolveFont("Montserrat")
  if (family === undefined) throw new Error("font")
  for (const block of [
    'fonts {{\nstyle: "normal"\nweight: 400\nfilename: "Montserrat.ttf"\n}',
    'fonts {\nstyle: "normal"\nweight: 400\nfilename: "Montserrat.ttf"',
  ]) {
    expect(() => fontFaces(family, `name: "Montserrat"\nlicense: "OFL"\n${block}`)).toThrow()
  }
})
