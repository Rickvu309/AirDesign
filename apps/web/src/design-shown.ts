import { readSlideId, templateColors, type Color, type FieldValue, type SlideId } from "@airdesign/document"
import {
  ownBackground,
  paintReader,
  readSlides,
  shownBackground,
  slideTheme,
  templateStyles,
  themeSwatches,
  type PaintFill,
} from "@airdesign/pptx"
import { designCopy } from "@/copy/design-copy"
import { shownName, type Swatch } from "@/design/color-choices"
import { namedByColor } from "@/design/color-names"
import { cssColor } from "@/paint-css"

type Parts = ReadonlyMap<string, Uint8Array>

export type DesignShown = {
  readonly slide: SlideId
  readonly number: number
  readonly background: { readonly css: string; readonly name: string; readonly value: Color | undefined }
  readonly fill: FieldValue<"fills", "p0"> | null
  readonly templateColors: readonly Swatch[]
}

const whiteHex = "FFFFFF"

function fillOf(parts: Parts, part: string): PaintFill | null {
  try {
    return paintReader(parts).slide(part).background
  } catch {
    return null
  }
}

function solidOf(fill: PaintFill | null): string | null {
  if (fill === null || fill.type === "none") return cssColor({ hex: whiteHex, alpha: 1 })
  return fill.type === "solid" ? cssColor({ ...fill.color, hex: fill.color.hex.toUpperCase() }) : null
}

function ownColor(parts: Parts, part: string): Color | null {
  try {
    const own = ownBackground(parts, part)
    return own !== null && "solid" in own ? own.solid : null
  } catch {
    return null
  }
}

function valueOf(
  parts: Parts,
  part: string,
  solid: string | null,
  templateColors: readonly Swatch[],
): Color | undefined {
  const own = ownColor(parts, part)
  if (own !== null) return own
  if (solid === null) return undefined
  const hex = solid.slice(1, 7)
  const slot = templateColors.find((swatch) => swatch.css.slice(1) === hex)
  return slot === undefined ? { rgb: hex } : { scheme: slot.scheme }
}

function colorLabels(parts: Parts, part: string): ReadonlyMap<string, string> {
  const theme = slideTheme(parts, part)
  const style = theme === null ? undefined : templateStyles(parts).find((item) => item.id === theme)
  const entries =
    style === undefined
      ? themeSwatches(parts, part).map((swatch) => ({ slot: swatch.scheme, css: swatch.css }))
      : templateColors.flatMap((slot) => {
          const hex = style.palette.slots[slot]
          return hex === undefined ? [] : [{ slot, css: `#${hex}` }]
        })
  return new Map(namedByColor(entries).map((entry) => [entry.slot, entry.name]))
}

export function templateColorsOf(parts: Parts, part: string): readonly Swatch[] {
  const labels = colorLabels(parts, part)
  return themeSwatches(parts, part).map((swatch) => ({
    scheme: swatch.scheme,
    css: swatch.css.toUpperCase(),
    name: labels.get(swatch.scheme) ?? namedByColor([swatch])[0]?.name ?? "",
  }))
}

export function designShown(parts: Parts, index: number, painted: string | null = null): DesignShown | null {
  const found = readSlides(parts)[index]
  const slide = found === undefined ? undefined : readSlideId(found.slide)
  if (found === undefined || slide === undefined) return null
  const fill = fillOf(parts, found.part)
  const solid = solidOf(fill)
  const templateColors = templateColorsOf(parts, found.part)
  const value = valueOf(parts, found.part, solid, templateColors)
  const name =
    value !== undefined
      ? shownName(value, templateColors)
      : fill !== null && fill.type !== "solid" && fill.type !== "none"
        ? designCopy.fills[fill.type]
        : designCopy.white
  return {
    slide,
    number: index + 1,
    background: { css: painted ?? solid ?? "white", name, value },
    fill: shownBackground(parts, found.part)?.value ?? null,
    templateColors,
  }
}
