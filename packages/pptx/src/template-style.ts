import {
  mappedSlots,
  themeSlots,
  type TemplateStyle as IndexedTemplate,
  type MappedSlot,
  type ThemeSlot,
} from "@airdesign/document"
import { deckLayouts } from "./deck-layouts.js"
import { linkedPart } from "./notes-part.js"
import { decodedXmlText, markupDocument } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import { slideTheme, themePartSwatches, type ThemeSwatch } from "./theme-swatches.js"
import { themePartValues } from "./trait-xml-theme.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type TemplateStyle = {
  readonly name: string | null
  readonly major: string | null
  readonly minor: string | null
  readonly swatches: readonly ThemeSwatch[]
}

export function templateStyle(parts: Parts, slide: string): TemplateStyle {
  const theme = slideTheme(parts, slide)
  return theme === null ? { name: null, major: null, minor: null, swatches: [] } : styleOf(parts, theme)
}

function styleOf(parts: Parts, theme: string): TemplateStyle {
  const bytes = parts.get(theme)
  const root = bytes === undefined ? undefined : markupDocument(bytes).elements[0]
  const fonts = themePartValues(parts, theme)
  return {
    name: root === undefined ? null : decodedXmlText(paintAttribute(root, "name") ?? "").trim() || null,
    major: fonts.major?.trim() || null,
    minor: fonts.minor?.trim() || null,
    swatches: themePartSwatches(parts, theme),
  }
}

export function templateStyles(parts: Parts): readonly IndexedTemplate[] {
  const styles: IndexedTemplate[] = []
  for (const layout of deckLayouts(parts)) {
    const master = linkedPart(parts, layout.part, "slideMaster")
    const id = master === null ? null : linkedPart(parts, master, "theme")
    if (id === null || !parts.has(id) || styles.some((style) => style.id === id)) continue
    const style = styleOf(parts, id)
    const values = themePartValues(parts, id)
    const slots = Object.fromEntries(
      themeSlots.flatMap((slot) => (values[slot] === undefined ? [] : [[slot, values[slot]]])),
    )
    const bytes = master === null ? undefined : parts.get(master)
    const mapping =
      bytes === undefined
        ? []
        : (markupDocument(bytes).elements.find((element) => element.kind === "p:clrMap")?.attributes ?? [])
    const map: Partial<Record<MappedSlot, ThemeSlot>> = {}
    for (const attribute of mapping) {
      const slot = mappedSlots.find((slot) => slot === attribute.name)
      const target = themeSlots.find((slot) => slot === attribute.value)
      if (slot !== undefined && target !== undefined) map[slot] = target
    }
    const fonts = {
      ...(style.major === null ? {} : { major: style.major }),
      ...(style.minor === null ? {} : { minor: style.minor }),
    }
    styles.push({ id, name: style.name, palette: { slots, map, fonts } })
  }
  return styles
}
