import { describe, expect, it } from "vitest"
import {
  deckChoices,
  hexOf,
  hsvOf,
  matches,
  shadesOf,
  shownName,
  shownHex,
  themeColumns,
  typedColor,
  type Palette,
} from "@/design/color-choices"

const hash = "#"

const theme = [
  { scheme: "dk1", css: "000000", name: "Dark 1" },
  { scheme: "lt1", css: "FFFFFF", name: "Light 1" },
  { scheme: "dk2", css: "000000", name: "Dark 2" },
  { scheme: "lt2", css: "E7E6E6", name: "Light 2" },
  { scheme: "accent1", css: "4472C4", name: "Accent 1" },
  { scheme: "accent2", css: "1A1A1A", name: "Accent 2" },
] as const

const palette: Palette = { theme, deck: ["C00000", "4472C4", "1F4E79"], behind: "FFFFFF" }

const written = (css: string) =>
  shadesOf(css).map(({ direction, percent, transforms }) => [
    `${direction} ${String(percent)}%`,
    transforms.map((each) => `${each.op} ${each.val}`).join(" "),
  ])

describe("PowerPoint's tint and shade rows", () => {
  it("writes lighter 80, 60 and 40 percent and darker 25 and 50 percent for a mid colour", () => {
    expect(written(`${hash}4472C4`)).toEqual([
      ["lighter 80%", "lumMod 20000 lumOff 80000"],
      ["lighter 60%", "lumMod 40000 lumOff 60000"],
      ["lighter 40%", "lumMod 60000 lumOff 40000"],
      ["darker 25%", "lumMod 75000"],
      ["darker 50%", "lumMod 50000"],
    ])
  })

  it("writes the rows PowerPoint shows for black, white, a very dark and a very light colour", () => {
    expect(written(`${hash}000000`)).toEqual([
      ["lighter 50%", "lumMod 50000 lumOff 50000"],
      ["lighter 35%", "lumMod 65000 lumOff 35000"],
      ["lighter 25%", "lumMod 75000 lumOff 25000"],
      ["lighter 15%", "lumMod 85000 lumOff 15000"],
      ["lighter 5%", "lumMod 95000 lumOff 5000"],
    ])
    expect(written(`${hash}FFFFFF`)).toEqual([
      ["darker 5%", "lumMod 95000"],
      ["darker 15%", "lumMod 85000"],
      ["darker 25%", "lumMod 75000"],
      ["darker 35%", "lumMod 65000"],
      ["darker 50%", "lumMod 50000"],
    ])
    expect(written(`${hash}1A1A1A`)).toEqual([
      ["lighter 90%", "lumMod 10000 lumOff 90000"],
      ["lighter 75%", "lumMod 25000 lumOff 75000"],
      ["lighter 50%", "lumMod 50000 lumOff 50000"],
      ["lighter 25%", "lumMod 75000 lumOff 25000"],
      ["lighter 10%", "lumMod 90000 lumOff 10000"],
    ])
    expect(written(`${hash}E7E6E6`)).toEqual([
      ["darker 10%", "lumMod 90000"],
      ["darker 25%", "lumMod 75000"],
      ["darker 50%", "lumMod 50000"],
      ["darker 75%", "lumMod 25000"],
      ["darker 90%", "lumMod 10000"],
    ])
  })
})

describe("the theme colours a person picks from", () => {
  it("keeps equal-looking slots and paints their shades as the canvas does", () => {
    const columns = themeColumns(theme)
    expect(columns.map((column) => column.swatch.name)).toEqual([
      "Dark 1",
      "Light 1",
      "Dark 2",
      "Light 2",
      "Accent 1",
      "Accent 2",
    ])
    const accent = columns[4]
    expect(accent?.swatch.color).toEqual({ scheme: "accent1" })
    expect(accent?.shades[2]).toEqual({
      color: {
        scheme: "accent1",
        transforms: [
          { op: "lumMod", val: 60_000 },
          { op: "lumOff", val: 40_000 },
        ],
      },
      css: `${hash}8FAADC`,
      name: "Accent 1, lighter 40%",
    })
  })

  it("presses only the named slot or its real alias", () => {
    const [dark] = themeColumns(theme)
    expect(dark !== undefined && matches(dark.swatch.color, { scheme: "dk2" })).toBe(false)
    expect(dark !== undefined && matches(dark.swatch.color, { scheme: "tx1" })).toBe(true)
    expect(dark !== undefined && matches(dark.swatch.color, { rgb: "000000" })).toBe(false)
    const faded = { scheme: "dk1", transforms: [{ op: "alpha", val: 40_000 }] } as const
    expect(dark !== undefined && matches(dark.swatch.color, faded)).toBe(true)
  })

  it("offers all ten PowerPoint picker slots even when several have the same colour", () => {
    const full = [
      ...theme,
      ...(["accent3", "accent4", "accent5", "accent6"] as const).map((scheme) => ({
        scheme,
        css: "000000",
        name: scheme,
      })),
    ]
    expect(themeColumns(full).map(({ swatch }) => swatch.color)).toEqual(
      ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6"].map((scheme) => ({
        scheme,
      })),
    )
  })

  it("keeps equal slots' names and transforms distinct as the theme changes", () => {
    const transforms = [{ op: "lumMod", val: 50_000 }] as const
    const dark2 = { scheme: "dk2", transforms } as const
    expect(matches({ scheme: "dk1", transforms }, dark2)).toBe(false)
    expect(matches({ scheme: "tx2", transforms }, dark2)).toBe(true)
    expect(matches({ scheme: "dk2" }, dark2)).toBe(false)
    expect(matches({ scheme: "lt1" }, { scheme: "bg1" })).toBe(true)
    expect(matches({ scheme: "lt2" }, { scheme: "bg2" })).toBe(true)
    expect(shownName({ scheme: "dk2" }, theme)).toBe("Dark 2")
    const changed = theme.map((swatch) => (swatch.scheme === "dk2" ? { ...swatch, css: "4472C4" } : swatch))
    expect(shownHex({ scheme: "dk2" }, theme)).toBe("000000")
    expect(shownHex({ scheme: "dk2" }, changed)).toBe("4472C4")
    expect(shownHex({ scheme: "dk1" }, changed)).toBe("000000")
    expect(shownName({ scheme: "dk2" }, changed)).toBe("Dark 2")
  })
})

describe("the deck's colours", () => {
  it("offers the deck's rgb colours that are not theme colours, most used first", () => {
    expect(deckChoices(palette).map((choice) => choice.color)).toEqual([{ rgb: "C00000" }, { rgb: "1F4E79" }])
  })
})

describe("a custom colour", () => {
  it("reads six hex digits with or without the hash, in either case", () => {
    expect(typedColor(`${hash}1F4E79`)).toEqual({ rgb: "1F4E79" })
    expect(typedColor(" 1f4e79 ")).toEqual({ rgb: "1F4E79" })
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
  it("names a theme slot, a tint, an rgb colour and a colour the picker cannot write", () => {
    expect(shownName({ scheme: "accent1" }, theme)).toBe("Accent 1")
    expect(
      shownName(
        {
          scheme: "accent1",
          transforms: [
            { op: "lumMod", val: 60_000 },
            { op: "lumOff", val: 40_000 },
          ],
        },
        theme,
      ),
    ).toBe("Accent 1, lighter 40%")
    expect(shownName({ rgb: "1F4E79" }, theme)).toBe(`${hash}1F4E79`)
    expect(shownName({ preset: "red" }, theme)).toBe(`${hash}FF0000`)
    expect(shownName({ scheme: "accent1", transforms: [{ op: "satMod", val: 50_000 }] }, theme)).toMatch(
      /^#[0-9A-F]{6}$/,
    )
  })
})
