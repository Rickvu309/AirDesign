import {
  colorPaint,
  mappedSlots,
  templateColors,
  type Color,
  type TemplateStyle as IndexedTemplate,
  type MappedSlot,
  type TemplateColor,
} from "@airdesign/document"
import { deckMasters } from "./deck-layouts.js"
import { decodedXmlText, markupDocument } from "./element-span.js"
import { colorMapCatalog, relationshipTarget, themeCatalog } from "./markup-slice.js"
import { relsOf } from "./package-address.js"
import { paintAttribute } from "./paint-color.js"
import { slideTheme, themePartSwatches, type ThemeSwatch } from "./theme-swatches.js"
import { themeByteValues, themePartValues } from "./trait-xml-theme.js"

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

function catalogValues(bytes: Uint8Array): {
  readonly name: string | null
  readonly values: ReturnType<typeof themeByteValues>
} {
  const catalog = themeCatalog(bytes) ?? bytes
  const root = markupDocument(catalog).elements[0]
  const name = root === undefined ? null : decodedXmlText(paintAttribute(root, "name") ?? "").trim() || null
  return { name, values: themeByteValues(catalog) }
}

function masterMap(bytes: Uint8Array) {
  const catalog = colorMapCatalog(bytes)
  const parsed = markupDocument(catalog ?? bytes)
  return parsed.elements.find((element) => element.kind === "p:clrMap")?.attributes ?? []
}

export function templateStyles(parts: Parts): readonly IndexedTemplate[] {
  const styles: IndexedTemplate[] = []
  for (const master of deckMasters(parts)) {
    const rels = parts.get(relsOf(master))
    const id = rels === undefined ? null : relationshipTarget(rels, master, "theme")
    if (id === null || !parts.has(id) || styles.some((style) => style.id === id)) continue
    const theme = parts.get(id)
    if (theme === undefined) continue
    const { name, values } = catalogValues(theme)
    const slots = Object.fromEntries(
      templateColors.flatMap((slot) => (values[slot] === undefined ? [] : [[slot, values[slot]]])),
    )
    const bytes = parts.get(master)
    const mapping = bytes === undefined ? [] : masterMap(bytes)
    const map: Partial<Record<MappedSlot, TemplateColor>> = {}
    for (const attribute of mapping) {
      const slot = mappedSlots.find((slot) => slot === attribute.name)
      const target = templateColors.find((slot) => slot === attribute.value)
      if (slot !== undefined && target !== undefined) map[slot] = target
    }
    const fonts = {
      ...(values.major === undefined ? {} : { major: values.major }),
      ...(values.minor === undefined ? {} : { minor: values.minor }),
    }
    styles.push({ id, name, palette: { slots, map, fonts } })
  }
  return styles
}

export function slideColorHex(parts: Parts, slide: string, color: Color): string | null {
  const theme = slideTheme(parts, slide)
  const palette = templateStyles(parts).find((style) => style.id === theme)?.palette
  if (palette === undefined) return null
  const mapped: Readonly<Record<string, TemplateColor | undefined>> = palette.map
  const slots: Readonly<Record<string, string | undefined>> = palette.slots
  return colorPaint(color, (scheme) => slots[mapped[scheme] ?? scheme] ?? null)?.hex.toUpperCase() ?? null
}
