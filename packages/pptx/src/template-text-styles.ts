import { deckLayouts } from "./deck-layouts.js"
import { linkedPart } from "./notes-part.js"
import { paintAttribute } from "./paint-color.js"
import { requireMarkup, partBytes } from "./part-markup.js"
import { themePartValues } from "./trait-xml-theme.js"
import type { Parts } from "./xml-codec.js"

export function templateTextStyles(
  parts: Parts,
  theme: string,
): readonly {
  readonly role: "title" | "body" | "other"
  readonly font: string | null
  readonly size: number | null
}[] {
  const master = deckLayouts(parts)
    .map((layout) => linkedPart(parts, layout.part, "slideMaster"))
    .find((master) => master !== null && linkedPart(parts, master, "theme") === theme)
  if (master === undefined || master === null) return []
  const elements = requireMarkup(partBytes(parts, master)).elements
  const fonts = themePartValues(parts, theme)
  return (["title", "body", "other"] as const).flatMap((role) => {
    const style = elements.find((element) => element.kind === `p:${role}Style`)
    if (style === undefined) return []
    const defaults = elements.find(
      (element) => element.kind === "a:defRPr" && element.start > style.start && element.end < style.end,
    )
    const latin =
      defaults === undefined
        ? undefined
        : elements.find((element) => element.kind === "a:latin" && element.parent === defaults.index)
    const typeface = latin === undefined ? null : paintAttribute(latin, "typeface")
    const font =
      typeface === "+mj-lt" || (typeface === null && role === "title")
        ? fonts.major
        : typeface === "+mn-lt" || typeface === null
          ? fonts.minor
          : typeface
    const size = Number(defaults === undefined ? null : paintAttribute(defaults, "sz")) / 100
    return [{ role, font: font ?? null, size: size > 0 ? size : null }]
  })
}
