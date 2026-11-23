import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { colorCopy } from "@/copy/color-copy"
import { colorNameCopy } from "@/copy/color-name-copy"
import {
  deckChoices,
  hexOf,
  hsvOf,
  matches,
  shadesOf,
  shownName,
  shownHex,
  templateColorColumns,
  tintChoices,
  typedColor,
  type Palette,
} from "@/design/color-choices"
import { namedByColor } from "@/design/color-names"

const hash = "#"

const templateColors = namedByColor([
  { var: "text" as const, css: "000000" },
  { var: "background" as const, css: "FFFFFF" },
  { var: "text2" as const, css: "000000" },
  { var: "background2" as const, css: "E7E6E6" },
  { var: "accent1" as const, css: "4472C4" },
  { var: "accent2" as const, css: "1A1A1A" },
])

const palette: Palette = { templateColors, deck: ["C00000", "4472C4", "1F4E79"] }

const written = (css: string) => shadesOf(css).map(({ direction, percent }) => `${direction} ${String(percent)}%`)

describe("PowerPoint's tint and shade rows", () => {
  it("offers lighter 80, 60 and 40 percent and darker 25 and 50 percent for a mid colour", () => {
    expect(written(`${hash}4472C4`)).toEqual(["lighter 80%", "lighter 60%", "lighter 40%", "darker 25%", "darker 50%"])
  })

  it("offers the rows PowerPoint shows for black, white, a very dark and a very light colour", () => {
    expect(written(`${hash}000000`)).toEqual(["lighter 50%", "lighter 35%", "lighter 25%", "lighter 15%", "lighter 5%"])
    expect(written(`${hash}FFFFFF`)).toEqual(["darker 5%", "darker 15%", "darker 25%", "darker 35%", "darker 50%"])
    expect(written(`${hash}1A1A1A`)).toEqual([
      "lighter 90%",
      "lighter 75%",
      "lighter 50%",
      "lighter 25%",
      "lighter 10%",
    ])
    expect(written(`${hash}E7E6E6`)).toEqual(["darker 10%", "darker 25%", "darker 50%", "darker 75%", "darker 90%"])
  })
})

describe("the template colors a person picks from", () => {
  it("keeps equal-looking theme colours, writes each shade as a tint and paints it as the canvas does", () => {
    const columns = templateColorColumns(templateColors)
    expect(columns.map((column) => column.swatch.name)).toEqual(templateColors.map((swatch) => swatch.name))
    expect(columns.map((column) => column.swatch.name)).toEqual([
      colorNameCopy.black,
      colorNameCopy.white,
      colorNameCopy.numbered(colorNameCopy.black, 2),
      colorNameCopy.lightGrey,
      colorNameCopy.blue,
      colorNameCopy.numbered(colorNameCopy.black, 3),
    ])
    const accent = columns[4]
    expect(accent?.swatch.color).toEqual({ var: "accent1" })
    expect(accent?.shades.map((shade) => shade.color)).toEqual(
      [0.8, 0.6, 0.4, -0.25, -0.5].map((tint) => ({ var: "accent1", tint })),
    )
    expect(accent?.shades[2]).toEqual({
      color: { var: "accent1", tint: 0.4 },
      css: `${hash}8FAADC`,
      name: colorCopy.lighter(colorNameCopy.blue, 40),
    })
    const theme = { ...doom.defaultTheme, colors: { ...doom.defaultTheme.colors, accent1: `${hash}4472c4` as const } }
    for (const shade of accent?.shades ?? [])
      expect(shade.css).toBe(doom.resolveColor(shade.color, theme).toUpperCase())
  })

  it("paints every swatch and tint of a theme as the canvas paints the colour it writes", () => {
    for (const theme of [
      doom.defaultTheme,
      { ...doom.defaultTheme, colors: { ...doom.defaultTheme.colors, accent3: `${hash}40edd9` as const } },
    ]) {
      const swatches = doom.colorVars.map((name) => ({ var: name, css: theme.colors[name], name }))
      for (const column of templateColorColumns(swatches))
        for (const choice of [column.swatch, ...column.shades])
          expect(choice.css, choice.name).toBe(doom.resolveColor(choice.color, theme).toUpperCase())
    }
  })

  it("presses only the theme colour that was written, never another with the same look", () => {
    const [dark] = templateColorColumns(templateColors)
    expect(dark !== undefined && matches(dark.swatch.color, { var: "text2" })).toBe(false)
    expect(dark !== undefined && matches(dark.swatch.color, { var: "text" })).toBe(true)
    expect(dark !== undefined && matches(dark.swatch.color, { var: "text", tint: 0 })).toBe(true)
    expect(dark !== undefined && matches(dark.swatch.color, `${hash}000000`)).toBe(false)
  })

  it("offers every template colour even when several have the same colour", () => {
    const full = [
      ...templateColors,
      ...(["accent3", "accent4", "accent5", "accent6"] as const).map((name) => ({ var: name, css: "000000", name })),
    ]
    expect(templateColorColumns(full).map(({ swatch }) => swatch.color)).toEqual(
      [
        "text",
        "background",
        "text2",
        "background2",
        "accent1",
        "accent2",
        "accent3",
        "accent4",
        "accent5",
        "accent6",
      ].map((name) => ({ var: name })),
    )
  })

  it("keeps equal theme colours' names and tints distinct as the template colors change", () => {
    expect(matches({ var: "text", tint: -0.5 }, { var: "text2", tint: -0.5 })).toBe(false)
    expect(matches({ var: "text2" }, { var: "text2", tint: -0.5 })).toBe(false)
    expect(shownName({ var: "text2" }, templateColors)).toBe(colorNameCopy.numbered(colorNameCopy.black, 2))
    const changed = templateColors.map((swatch) => (swatch.var === "text2" ? { ...swatch, css: "4472C4" } : swatch))
    expect(shownHex({ var: "text2" }, templateColors)).toBe("000000")
    expect(shownHex({ var: "text2" }, changed)).toBe("4472C4")
    expect(shownHex({ var: "text" }, changed)).toBe("000000")
    expect(shownName({ var: "text2" }, changed)).toBe(colorNameCopy.numbered(colorNameCopy.black, 2))
  })
})

describe("the deck's colours", () => {
  it("offers the deck's hex colours that are not template colors, most used first, as Doom stores them", () => {
    expect(deckChoices(palette).map((choice) => choice.color)).toEqual([`${hash}c00000`, `${hash}1f4e79`])
  })

  it("keeps every hex colour, including past the first ten", () => {
    const many = Array.from({ length: 12 }, (_, index) => (index + 1).toString(16).padStart(6, "B").toUpperCase())
    expect(deckChoices({ templateColors, deck: many })).toHaveLength(12)
  })
})

describe("template color tints inside Add color", () => {
  it("lists the lighter and darker rows, and a tint those rows do not already have", () => {
    const odd = { var: "accent1" as const, tint: -0.67 }
    const choices = tintChoices(templateColors, odd)
    expect(choices[0]?.color).toEqual(odd)
    expect(choices.some((choice) => choice.name === colorCopy.lighter(colorNameCopy.blue, 40))).toBe(true)
    const standard = templateColorColumns(templateColors)[4]?.shades[2]?.color
    const same =
      standard === undefined
        ? []
        : tintChoices(templateColors, standard).filter((choice) => matches(choice.color, standard))
    expect(same).toHaveLength(1)
  })
})

describe("a custom colour", () => {
  it.each([`${hash}1f4e79`, "1F4E79", " 1f4e79 "])("accepts a typed color of %j", (text) => {
    expect(typedColor(text)).toBe(`${hash}1f4e79`)
  })

  it("rejects incomplete or invalid hex", () => {
    expect(typedColor("1F4E7")).toBeNull()
    expect(typedColor("#GGGGGG")).toBeNull()
  })

  it("turns hue, saturation and brightness into hex and back", () => {
    expect(hexOf({ hue: 0, saturation: 1, value: 1 })).toBe("FF0000")
    expect(hexOf({ hue: 210, saturation: 0.75, value: 0.5 })).toBe("205080")
    expect(hsvOf("205080")).toEqual({ hue: 210, saturation: 0.75, value: 128 / 255 })
    expect(hexOf(hsvOf("1F4E79"))).toBe("1F4E79")
  })
})

describe("the shown value", () => {
  it("names a template colour, and shows a hex for a tint and a hex colour", () => {
    expect(shownName({ var: "accent1" }, templateColors)).toBe(colorNameCopy.blue)
    expect(shownName({ var: "text" }, templateColors)).toBe(colorNameCopy.black)
    expect(shownName({ var: "accent1", tint: 0.4 }, templateColors)).toBe("8FAADC")
    expect(shownName(`${hash}1f4e79`, templateColors)).toBe("1F4E79")
  })
})
