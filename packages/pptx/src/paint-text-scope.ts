import type { MarkupElement } from "./element-span.js"
import { paintChild } from "./paint-fill.js"
import { paintAttribute } from "./paint-color.js"
import type { PaintTextHolder, PaintTextMarkup, PaintTextScope } from "./paint-text.js"
import type { MarkupChildren } from "./text-value-route.js"

const fontSlots = [
  ["mj", "a:majorFont"],
  ["mn", "a:minorFont"],
] as const
const fontScripts = [
  ["lt", "a:latin"],
  ["ea", "a:ea"],
  ["cs", "a:cs"],
] as const
export const paintTextMapping = (
  sheet: PaintTextMarkup,
  layout: PaintTextMarkup | null,
  master: PaintTextMarkup | null,
): ReadonlyMap<string, string> => {
  let mapping = new Map<string, string>()
  for (const level of [master, layout, sheet]) {
    if (level === null) continue
    const root = level.elements[0]
    const map =
      level === master
        ? paintChild(level.children, root, "p:clrMap")
        : paintChild(level.children, paintChild(level.children, root, "p:clrMapOvr"), "a:overrideClrMapping")
    if (map !== undefined) mapping = new Map(map.attributes.map((item) => [item.name, item.value]))
  }
  return mapping
}

const themeFonts = (children: MarkupChildren, elements: MarkupElement | undefined): ReadonlyMap<string, string> => {
  const fonts = new Map<string, string>()
  const scheme = paintChild(children, elements, "a:fontScheme")
  for (const [slot, kind] of fontSlots) {
    const holder = paintChild(children, scheme, kind)
    for (const [script, name] of fontScripts) {
      const font = paintChild(children, holder, name)
      const value = font === undefined ? null : paintAttribute(font, "typeface")
      if (value !== null && value !== "") fonts.set(`+${slot}-${script}`, value)
    }
  }
  return fonts
}

const holderIn = (markup: PaintTextMarkup | null, kind: string): PaintTextHolder | null => {
  const element = markup === null ? undefined : paintChild(markup.children, markup.elements[0], kind)
  return markup === null || element === undefined ? null : { element, children: markup.children }
}

export const paintTextScope = (
  key: string,
  mapping: ReadonlyMap<string, string>,
  theme: PaintTextMarkup | null,
  master: PaintTextMarkup | null,
  presentation: PaintTextMarkup | null,
): PaintTextScope => {
  const children = theme?.children ?? []
  const elements = paintChild(children, theme?.elements[0], "a:themeElements")
  const colors = paintChild(children, elements, "a:clrScheme")
  const slots = new Map(
    (colors === undefined ? [] : (children[colors.index] ?? [])).map((element) => [element.kind.slice(2), element]),
  )
  return {
    key,
    palette: { children, slots, mapping, placeholder: null },
    fonts: themeFonts(children, elements),
    styles: holderIn(master, "p:txStyles"),
    defaults: holderIn(presentation, "p:defaultTextStyle"),
  }
}
