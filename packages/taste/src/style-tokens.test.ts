import { readFileSync } from "node:fs"
import { type ColorVar, type Hex, type Theme } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { styleOf, styles, styleText } from "./index.js"

const textStyleNames = ["display", "bigNumber", "title", "heading", "body", "body2", "caption", "label"]
const effectStyleNames = ["soft", "lifted", "glow"]
const backgrounds = ["background", "background2"] as const satisfies readonly ColorVar[]
const seriesAccents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"] as const

function linearChannel(color: Hex, offset: number): number {
  const srgb = Number.parseInt(color.slice(offset, offset + 2), 16) / 255
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

const luminance = (color: Hex) =>
  0.2126 * linearChannel(color, 1) + 0.7152 * linearChannel(color, 3) + 0.0722 * linearChannel(color, 5)

function contrast(one: Hex, two: Hex): number {
  const [dark, light] = [luminance(one), luminance(two)].sort((a, b) => a - b)
  return (light! + 0.05) / (dark! + 0.05)
}

const styleFile = (id: string) =>
  JSON.parse(readFileSync(`packages/taste/files/styles/${id}.json`, "utf8")) as {
    readonly textStyles?: object
    readonly effectStyles?: object
  }

function parameterSection(id: string): string {
  return styleText(id)!
    .markdown.split(/^## Parameters\s*$/m)[1]!
    .split(/^## /m)[0]!
}

function namedVariants(id: string): string[] {
  const lines = parameterSection(id).split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith("- `variant`:"))
  if (start === -1) return []
  const nested = lines.slice(start + 1)
  const end = nested.findIndex((line) => line.startsWith("- "))
  return (end === -1 ? nested : nested.slice(0, end)).flatMap((line) => /^\s+- `([^`]+)`:/.exec(line)?.[1] ?? [])
}

function textAccents(id: string): string[] {
  const accent = parameterSection(id)
    .split(/\r?\n/)
    .find((line) => line.startsWith("- `accent`:"))
  return [...new Set(["accent1", ...(accent?.match(/accent\d/g) ?? [])])]
}

const looks = styles.flatMap((style) => [
  { label: style.id, id: style.id, theme: style.theme },
  ...style.variants.map((variant) => ({
    label: `${style.id} ${variant.name}`,
    id: style.id,
    theme: variant.theme,
  })),
])

describe("style tokens", () => {
  it.each(styles)("defines every text style and effect style in $name's own file", ({ id }) => {
    const file = styleFile(id)
    expect(Object.keys(file.textStyles ?? {}).sort()).toEqual([...textStyleNames].sort())
    expect(Object.keys(file.effectStyles ?? {}).sort()).toEqual([...effectStyleNames].sort())
  })

  it.each(looks)("sets no text under 24 px in $label", ({ theme }) => {
    for (const [name, textStyle] of Object.entries(theme.textStyles))
      expect(textStyle.size, name).toBeGreaterThanOrEqual(24)
  })

  it.each(looks)("meets WCAG AA for every ink in $label on both backgrounds", ({ id, theme }) => {
    const { colors } = theme
    const inks = ["text", "text2", "positive", "negative", "total", "link", ...textAccents(id)] as ColorVar[]
    for (const surface of backgrounds) {
      for (const ink of inks)
        expect(contrast(colors[ink], colors[surface]), `${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      for (const accent of seriesAccents)
        expect(contrast(colors[accent], colors[surface]), `${accent} on ${surface}`).toBeGreaterThanOrEqual(3)
    }
  })

  it.each(looks)("keeps secondary text and signed colours apart in $label", ({ theme }) => {
    const { colors } = theme
    expect(contrast(colors.text, colors.text2), "text against text2").toBeGreaterThanOrEqual(2)
    expect(contrast(colors.text, colors.accent1), "text against accent1").toBeGreaterThanOrEqual(2)
    expect(contrast(colors.positive, colors.negative), "positive against negative").toBeGreaterThanOrEqual(2)
    for (const series of ["accent2", "accent3"] as const)
      expect([colors.positive, colors.negative], series).not.toContain(colors[series])
  })

  it.each(looks)("reads a red loss colour in $label", ({ theme }) => {
    const hex = theme.colors.negative
    const [red, green, blue] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
    expect(red! - Math.max(green!, blue!), hex).toBeGreaterThanOrEqual(120)
  })

  it.each(styles)("names the same variants in $name's guide and file", ({ id, variants }) => {
    expect(namedVariants(id).sort()).toEqual(variants.map(({ name }) => name).sort())
    expect(variants.length).toBeGreaterThan(0)
  })

  it.each(looks)("recognizes a stored copy of $label", ({ id, theme, label }) => {
    const variant = label === id ? undefined : label.slice(id.length + 1)
    const stored: Theme = JSON.parse(JSON.stringify(theme)) as Theme
    expect(styleOf(stored)).toEqual({ style: styles.find((each) => each.id === id), variant })
  })
})
