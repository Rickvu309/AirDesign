import { describe, expect, it } from "vitest"
import { defaultTheme } from "./default-theme-art.js"
import { slideTextStyles } from "./slide-text-styles.js"
import { textStyleNames } from "./text.js"

const size = (name: (typeof textStyleNames)[number]) => slideTextStyles[name].size

describe("the slide type scale at 1920 by 1080", () => {
  it("names a size for each style, from the big number down to the label", () => {
    expect(textStyleNames.map(size)).toEqual([160, 88, 64, 48, 40, 36, 36])
  })

  it("keeps every style at 24 px or more, so no text on a slide is small", () => {
    for (const name of textStyleNames) expect(size(name)).toBeGreaterThanOrEqual(24)
  })

  it("makes a title clearly a title: at least 1.75 times the body and bold", () => {
    expect(size("title")).toBeGreaterThanOrEqual(size("body") * 1.75)
    expect(slideTextStyles.title.weight).toBeGreaterThanOrEqual(700)
    expect(slideTextStyles.heading.weight).toBeGreaterThanOrEqual(600)
    expect(slideTextStyles.bigNumber.weight).toBeGreaterThanOrEqual(700)
  })

  it("keeps the number far above its label and note, so the hierarchy reads at thumbnail size", () => {
    expect(size("bigNumber")).toBeGreaterThanOrEqual(size("caption") * 4)
    expect(size("bigNumber")).toBeGreaterThanOrEqual(size("label") * 4)
  })

  it("sets a label no smaller than a note, and heavier, so a KPI's label leads its delta", () => {
    expect(size("label")).toBeGreaterThanOrEqual(size("caption"))
    expect(slideTextStyles.label.weight).toBeGreaterThan(slideTextStyles.caption.weight)
  })

  it("is what the default theme's text styles are", () => {
    expect(defaultTheme.textStyles).toEqual(slideTextStyles)
  })
})
