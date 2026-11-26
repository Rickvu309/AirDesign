import { describe, expect, it } from "vitest"
import { defaultTheme } from "./theme.js"
import { textStyleNames } from "./text.js"

const size = (name: (typeof textStyleNames)[number]) => defaultTheme.textStyles[name].size

describe("the slide type scale at 1920 by 1080", () => {
  it("names a size for each style, from the big number down to the label", () => {
    expect(textStyleNames.map(size)).toEqual([88, 80, 56, 40, 32, 28, 24, 24])
  })

  it("keeps every style at 24 px or more, so no text on a slide is small", () => {
    for (const name of textStyleNames) expect(size(name)).toBeGreaterThanOrEqual(24)
  })

  it("makes a title clearly a title: at least 1.75 times the body and bold", () => {
    expect(size("title")).toBeGreaterThanOrEqual(size("body") * 1.75)
    expect(defaultTheme.textStyles.title.weight).toBeGreaterThanOrEqual(700)
    expect(defaultTheme.textStyles.heading.weight).toBeGreaterThanOrEqual(600)
    expect(defaultTheme.textStyles.bigNumber.weight).toBeGreaterThanOrEqual(700)
  })

  it("keeps the number above the title and far above its label and note, so the hierarchy reads at thumbnail size", () => {
    expect(size("bigNumber")).toBeGreaterThanOrEqual(size("title") * 1.4)
    expect(size("bigNumber")).toBeGreaterThanOrEqual(size("caption") * 3)
    expect(size("bigNumber")).toBeGreaterThanOrEqual(size("label") * 3)
  })

  it("sets a cover's title above every step a content slide uses, bold", () => {
    for (const name of textStyleNames) if (name !== "display") expect(size("display")).toBeGreaterThan(size(name))
    expect(size("display")).toBeGreaterThanOrEqual(size("title") * 1.5)
    expect(defaultTheme.textStyles.display.weight).toBeGreaterThanOrEqual(700)
  })

  it("sets a consulting slide at 2 px a point: a 44 pt cover, 28 pt action title, 20 pt lead, 16 pt body and 12 pt notes", () => {
    const points = (name: (typeof textStyleNames)[number]) => size(name) / 2
    expect([points("display"), points("title"), points("heading"), points("body"), points("caption")]).toEqual([
      44, 28, 20, 16, 12,
    ])
  })

  it("sets a label no smaller than a note, and heavier, so a metric label leads its change", () => {
    expect(size("label")).toBeGreaterThanOrEqual(size("caption"))
    expect(defaultTheme.textStyles.label.weight).toBeGreaterThan(defaultTheme.textStyles.caption.weight)
  })
})
