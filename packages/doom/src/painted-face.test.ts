import { describe, expect, it } from "vitest"
import type { FontWidths } from "./line-breaks.js"
import { type Text, measureWith } from "./index.js"
import { boldWeightOf, paintedFace, storedFace } from "./painted-face.js"
import { textOf, theme } from "./sample-deck.js"

const plain = {
  ...theme(),
  fonts: { heading: "Inter SemiBold", body: "Inter" },
}
const words = (chars: string, extra: Partial<Text> = {}): Text => ({ ...textOf(chars), ...extra })
const widths: FontWidths = {
  "Inter SemiBold": { ascent: 1, descent: 0, advances: { M: 0.5 } },
  "Inter SemiBold|bold": { ascent: 1, descent: 0, advances: { M: 0.5 } },
  "Inter ExtraBold": { ascent: 1, descent: 0, advances: { M: 0.7 } },
  "Inter|bold": { ascent: 1, descent: 0, advances: { M: 0.8 } },
  Inter: { ascent: 1, descent: 0, advances: { M: 0.4 } },
}
const measure = measureWith(widths)

const named = [
  ["Thin", 100],
  ["ExtraLight", 200],
  ["Light", 300],
  ["Medium", 500],
  ["SemiBold", 600],
  ["ExtraBold", 800],
  ["Black", 900],
] as const

describe("paintedFace", () => {
  it("reads a named face as that weight, and Regular or Bold as the family with the bold flag", () => {
    expect(paintedFace("Inter", 600, false)).toEqual({ family: "Inter", font: "Inter", weight: 400, name: "Regular" })
    expect(paintedFace("Inter", 400, true)).toEqual({ family: "Inter", font: "Inter", weight: 700, name: "Bold" })
    expect(paintedFace("Inter SemiBold", 400, undefined)).toEqual({
      family: "Inter",
      font: "Inter SemiBold",
      weight: 600,
      name: "SemiBold",
    })
    for (const [name, weight] of named) {
      expect(paintedFace(`Inter ${name}`, 400, false)).toMatchObject({
        family: "Inter",
        weight,
        name,
        font: `Inter ${name}`,
      })
    }
    expect(paintedFace("Open Sans Semi Bold", 400, false)).toMatchObject({
      family: "Open Sans",
      weight: 600,
      name: "SemiBold",
    })
  })

  it("paints the bold flag on any named weight as Bold, and the named face again when the flag is off", () => {
    for (const [name] of named) {
      expect(paintedFace(`Inter ${name}`, 400, true)).toEqual({
        family: "Inter",
        font: "Inter",
        weight: 700,
        name: "Bold",
      })
      expect(paintedFace(`Inter ${name}`, 400, false).name).toBe(name)
    }
    expect(paintedFace("Inter", 600, undefined)).toMatchObject({ font: "Inter", weight: 600, name: "SemiBold" })
  })

  it("picks the bold face within 100 of 700, the heavier one on a tie, and 700 when the family holds it", () => {
    expect(boldWeightOf([600, 800])).toBe(800)
    expect(boldWeightOf([600])).toBe(600)
    expect(boldWeightOf([900])).toBe(700)
    expect(boldWeightOf([100, 200, 300, 400, 500, 600, 700, 800, 900])).toBe(700)
    expect(paintedFace("Inter SemiBold", 400, true, [600, 800])).toEqual({
      family: "Inter",
      font: "Inter ExtraBold",
      weight: 800,
      name: "ExtraBold",
    })
  })

  it("does not split a catalog family whose name ends in a weight", () => {
    for (const family of ["Archivo Black", "Love Light", "Shadows Into Light"]) {
      expect(paintedFace(family, 400, false).family).toBe(family)
      expect(paintedFace(family, 400, true)).toMatchObject({ family, font: family, weight: 700, name: "Bold" })
    }
  })

  it("stores Bold as the bold flag and every other weight as its named face", () => {
    expect(storedFace("Inter", "Bold")).toEqual({ font: "Inter", bold: true })
    expect(storedFace("Inter", 700)).toEqual({ font: "Inter", bold: true })
    expect(storedFace("Inter", "Regular")).toEqual({ font: "Inter", bold: false })
    expect(storedFace("Inter", "SemiBold")).toEqual({ font: "Inter SemiBold", bold: false })
    expect(storedFace("Open Sans", "ExtraBold")).toEqual({ font: "Open Sans ExtraBold", bold: false })
  })
})

describe("measure of a named face", () => {
  it("uses the family's bold advance when the bold flag is on, and the named face when it is off", () => {
    const heading = words("M", { style: "heading" })
    const resting = measure(heading, plain, null)
    const bold = measure({ ...heading, spans: [{ end: 1, bold: true }] }, plain, null)
    const back = measure({ ...heading, spans: [{ end: 1 }] }, plain, null)
    expect(resting.lines[0]?.runs[0]).toMatchObject({ font: "Inter SemiBold" })
    expect(bold.lines[0]?.runs[0]).toMatchObject({ font: "Inter", bold: true })
    expect(bold.w).toBeGreaterThan(resting.w)
    expect(back.w).toBeCloseTo(resting.w)
    expect(back.lines[0]?.runs[0]?.font).toBe("Inter SemiBold")

    const heavy = measure(words("M", { spans: [{ end: 1, font: "Inter ExtraBold", bold: true }] }), plain, null)
    const released = measure(words("M", { spans: [{ end: 1, font: "Inter ExtraBold" }] }), plain, null)
    expect(heavy.lines[0]?.runs[0]).toMatchObject({ font: "Inter", bold: true })
    expect(heavy.w).toBeGreaterThan(released.w)
    expect(released.lines[0]?.runs[0]).toMatchObject({ font: "Inter ExtraBold", bold: false })
  })
})
