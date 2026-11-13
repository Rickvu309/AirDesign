import { schemeNames, type SchemeName } from "@airdesign/document"
import { markupDocument } from "./element-span.js"
import { paintAttribute, paintColor, type PaintPalette } from "./paint-color.js"
import { paintChild } from "./paint-fill.js"
import { partOf, relsOf } from "./package-address.js"
import { markupChildren } from "./text-value-route.js"

const themeFile = /^ppt\/theme\/theme\d+\.xml$/

export type ThemeSwatch = { readonly scheme: SchemeName; readonly css: string }

function related(parts: ReadonlyMap<string, Uint8Array>, part: string, type: string): string | null {
  const bytes = parts.get(relsOf(part))
  if (bytes === undefined) return null
  for (const item of markupDocument(bytes).elements) {
    if (item.kind !== "Relationship") continue
    const kind = paintAttribute(item, "Type")
    const target = paintAttribute(item, "Target")
    if (kind === null || target === null || paintAttribute(item, "TargetMode") === "External") continue
    if (!kind.endsWith(`/${type}`)) continue
    return partOf(part, target)
  }
  return null
}

function themePart(parts: ReadonlyMap<string, Uint8Array>, slide: string | null): string | null {
  const layout = slide === null ? null : related(parts, slide, "slideLayout")
  const master = layout === null ? null : related(parts, layout, "slideMaster")
  const theme = master === null ? null : related(parts, master, "theme")
  if (theme !== null && parts.has(theme)) return theme
  return [...parts.keys()].filter((name) => themeFile.test(name)).sort()[0] ?? null
}

export function themeSwatches(parts: ReadonlyMap<string, Uint8Array>, slide: string | null): readonly ThemeSwatch[] {
  const part = themePart(parts, slide)
  const bytes = part === null ? undefined : parts.get(part)
  if (bytes === undefined) return []
  const elements = markupDocument(bytes).elements
  const children = markupChildren(elements)
  const themeElements = paintChild(children, elements[0], "a:themeElements")
  const scheme = paintChild(children, themeElements, "a:clrScheme")
  const slots = new Map(
    (scheme === undefined ? [] : (children[scheme.index] ?? [])).map((element) => [element.kind.slice(2), element]),
  )
  const palette: PaintPalette = { children, slots, mapping: new Map(), placeholder: null }
  const found: ThemeSwatch[] = []
  for (const name of schemeNames) {
    const slot = slots.get(name)
    const color = slot === undefined ? undefined : children[slot.index]?.[0]
    const painted = color === undefined ? null : paintColor(color, children, palette)
    if (painted !== null) found.push({ scheme: name, css: `#${painted.hex}` })
  }
  return found
}
