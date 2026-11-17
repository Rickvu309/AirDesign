import { readSlideId, type Color, type SlideId } from "@airdesign/document"
import { ownBackground, paintReader, readSlides, themeSwatches, type PaintFill } from "@airdesign/pptx"
import { designCopy } from "@/copy/design-copy"
import { formatCopy } from "@/copy/format-copy"
import { shownName, type Swatch } from "@/design/color-choices"
import { cssColor } from "@/paint-css"

type Parts = ReadonlyMap<string, Uint8Array>

export type DesignShown = {
  readonly slide: SlideId
  readonly number: number
  readonly background: { readonly css: string; readonly name: string; readonly value: Color | undefined }
  readonly theme: readonly Swatch[]
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

function valueOf(parts: Parts, part: string, solid: string | null, theme: readonly Swatch[]): Color | undefined {
  const own = ownColor(parts, part)
  if (own !== null) return own
  if (solid === null) return undefined
  const hex = solid.slice(1, 7)
  const slot = theme.find((swatch) => swatch.css.slice(1) === hex)
  return slot === undefined ? { rgb: hex } : { scheme: slot.scheme }
}

export function themeOf(parts: Parts, part: string): readonly Swatch[] {
  return themeSwatches(parts, part).map((swatch) => ({
    ...swatch,
    css: swatch.css.toUpperCase(),
    name: formatCopy.colors[swatch.scheme],
  }))
}

export function designShown(parts: Parts, index: number, painted: string | null = null): DesignShown | null {
  const found = readSlides(parts)[index]
  const slide = found === undefined ? undefined : readSlideId(found.slide)
  if (found === undefined || slide === undefined) return null
  const fill = fillOf(parts, found.part)
  const solid = solidOf(fill)
  const theme = themeOf(parts, found.part)
  const value = valueOf(parts, found.part, solid, theme)
  const name =
    value !== undefined
      ? shownName(value, theme)
      : fill !== null && fill.type !== "solid" && fill.type !== "none"
        ? designCopy.fills[fill.type]
        : designCopy.white
  return {
    slide,
    number: index + 1,
    background: { css: painted ?? solid ?? "white", name, value },
    theme,
  }
}
