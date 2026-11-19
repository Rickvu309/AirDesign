import { describe, expect, it } from "vitest"
import { colorNameCopy } from "@/copy/color-name-copy"
import { namedByColor } from "@/design/color-names"

const hash = "#"
const painted = (digits: string) => `${hash}${digits}`

const name = (digits: string) => namedByColor([{ css: painted(digits) }])[0]?.name

function names(hexes: readonly string[]): readonly string[] {
  return namedByColor(hexes.map((digits) => ({ css: painted(digits) }))).map((swatch) => swatch.name)
}

describe("a template colour's name", () => {
  it("names a clear colour by the nearest word", () => {
    expect(name("000000")).toBe(colorNameCopy.black)
    expect(name("FFFFFF")).toBe(colorNameCopy.white)
    expect(name("808080")).toBe(colorNameCopy.grey)
    expect(name("4472C4")).toBe(colorNameCopy.blue)
    expect(name("202020")).toBe(colorNameCopy.black)
    expect(name("505050")).toBe(colorNameCopy.darkGrey)
    expect(name("C00000")).toBe(colorNameCopy.darkRed)
    expect(name("FF0000")).toBe(colorNameCopy.red)
    expect(name("0000FF")).toBe(colorNameCopy.blue)
  })

  it.each([
    ["BBE0E3", colorNameCopy.lightTeal],
    ["CADEFA", colorNameCopy.lightBlue],
    ["F9D9E4", colorNameCopy.lightPink],
    ["D0D0D0", colorNameCopy.lightGrey],
  ])("names the pale swatch %s %s", (hex, expected) => {
    expect(name(hex)).toBe(expected)
  })

  it("tells two colours that share a word apart by lightness, then by a number", () => {
    expect(names(["6488DC", "2C58B4"])).toEqual([colorNameCopy.lightBlue, colorNameCopy.darkBlue])
    expect(names(["000000", "000000", "000000"])).toEqual([
      colorNameCopy.black,
      colorNameCopy.numbered(colorNameCopy.black, 2),
      colorNameCopy.numbered(colorNameCopy.black, 3),
    ])
    expect(names(["FFFFFF", "FFFFFF"])).toEqual([colorNameCopy.white, colorNameCopy.numbered(colorNameCopy.white, 2)])
  })

  it("keeps every name in one template unique and in slot order", () => {
    const palette = ["202020", "FFFFFF", "404040", "F2F2F2", "505050", "606060", "707070", "808080"]
    const named = names(palette)
    expect(new Set(named).size).toBe(palette.length)
    expect(namedByColor(palette.map((css, index) => ({ css, index }))).map((swatch) => swatch.index)).toEqual(
      palette.map((_, index) => index),
    )
  })

  it("names the blank, clean and grey-ramp templates the panels show", () => {
    const slots = [
      "dk1",
      "lt1",
      "dk2",
      "lt2",
      "accent1",
      "accent2",
      "accent3",
      "accent4",
      "accent5",
      "accent6",
      "hlink",
      "folHlink",
    ]
    const expectSlots = (hexes: readonly string[], expected: readonly string[]) => {
      expect(Object.fromEntries(slots.map((slot, index) => [slot, names(hexes)[index]]))).toEqual(
        Object.fromEntries(slots.map((slot, index) => [slot, expected[index]])),
      )
    }
    expectSlots(
      [
        "202020",
        "FFFFFF",
        "1F3A5F",
        "EEF2F6",
        "2D6FCD",
        "E07A2E",
        "2F9E62",
        "7A4FC4",
        "D2455B",
        "1E9AA8",
        "2D6FCD",
        "7A4FC4",
      ],
      [
        colorNameCopy.black,
        colorNameCopy.white,
        colorNameCopy.darkBlue,
        colorNameCopy.numbered(colorNameCopy.white, 2),
        colorNameCopy.blue,
        colorNameCopy.orange,
        colorNameCopy.green,
        colorNameCopy.purple,
        colorNameCopy.red,
        colorNameCopy.teal,
        colorNameCopy.numbered(colorNameCopy.blue, 2),
        colorNameCopy.numbered(colorNameCopy.purple, 2),
      ],
    )
    expectSlots(
      [
        "000000",
        "FFFFFF",
        "000000",
        "808080",
        "BBE0E3",
        "333399",
        "FFFFFF",
        "000000",
        "DAEDEF",
        "2D2D8A",
        "009999",
        "99CC00",
      ],
      [
        colorNameCopy.black,
        colorNameCopy.white,
        colorNameCopy.numbered(colorNameCopy.black, 2),
        colorNameCopy.grey,
        colorNameCopy.lightTeal,
        colorNameCopy.numbered(colorNameCopy.darkBlue, 2),
        colorNameCopy.numbered(colorNameCopy.white, 2),
        colorNameCopy.numbered(colorNameCopy.black, 3),
        colorNameCopy.numbered(colorNameCopy.lightTeal, 2),
        colorNameCopy.darkBlue,
        colorNameCopy.teal,
        colorNameCopy.lightGreen,
      ],
    )
    expectSlots(
      [
        "202020",
        "FFFFFF",
        "404040",
        "F2F2F2",
        "505050",
        "606060",
        "707070",
        "808080",
        "909090",
        "A0A0A0",
        "404040",
        "606060",
      ],
      [
        colorNameCopy.black,
        colorNameCopy.white,
        colorNameCopy.numbered(colorNameCopy.darkGrey, 2),
        colorNameCopy.numbered(colorNameCopy.white, 2),
        colorNameCopy.numbered(colorNameCopy.darkGrey, 3),
        colorNameCopy.darkGrey,
        colorNameCopy.numbered(colorNameCopy.darkGrey, 4),
        colorNameCopy.grey,
        colorNameCopy.numbered(colorNameCopy.grey, 2),
        colorNameCopy.numbered(colorNameCopy.grey, 3),
        colorNameCopy.numbered(colorNameCopy.darkGrey, 5),
        colorNameCopy.numbered(colorNameCopy.darkGrey, 6),
      ],
    )
  })
})
