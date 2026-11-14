import { readSlideId, type SchemeName, type SlideId } from "@airdesign/document"
import { paintReader, readSlides, themeSwatches, type PaintFill } from "@airdesign/pptx"
import { designCopy } from "@/copy/design-copy"
import { formatCopy } from "@/copy/format-copy"
import { cssColor } from "@/paint-css"

type Parts = ReadonlyMap<string, Uint8Array>

export type ShownColor = {
  readonly scheme: SchemeName
  readonly css: string
  readonly name: string
  readonly chosen: boolean
}

export type DesignShown = {
  readonly slide: SlideId
  readonly number: number
  readonly background: { readonly css: string; readonly name: string }
  readonly colors: readonly ShownColor[]
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

function backgroundName(fill: PaintFill | null, solid: string | null, chosen: ShownColor | undefined): string {
  if (chosen !== undefined) return chosen.name
  if (fill !== null && fill.type !== "solid" && fill.type !== "none") return designCopy.fills[fill.type]
  return solid === null || solid.slice(1) === whiteHex ? designCopy.white : solid
}

export function designShown(parts: Parts, index: number, painted: string | null = null): DesignShown | null {
  const found = readSlides(parts)[index]
  const slide = found === undefined ? undefined : readSlideId(found.slide)
  if (found === undefined || slide === undefined) return null
  const fill = fillOf(parts, found.part)
  const solid = solidOf(fill)
  const swatches = themeSwatches(parts, found.part).map((swatch) => ({ ...swatch, css: swatch.css.toUpperCase() }))
  const pick = swatches.find((swatch) => swatch.css === solid)
  const colors = swatches.map((swatch) => ({
    ...swatch,
    name: formatCopy.colors[swatch.scheme],
    chosen: swatch.scheme === pick?.scheme,
  }))
  const chosen = colors.find((color) => color.chosen)
  return {
    slide,
    number: index + 1,
    background: { css: painted ?? solid ?? "white", name: backgroundName(fill, solid, chosen) },
    colors,
  }
}
