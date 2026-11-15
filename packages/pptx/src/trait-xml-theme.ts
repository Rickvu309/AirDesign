import { themeSlots, type ThemeSlot, type TraitValue } from "@airdesign/document"
import { decodedXmlText, spliceBytes, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { readSlides } from "./read-shapes.js"
import { xmlAttribute } from "./shape-write.js"
import { markupChildren } from "./text-value-route.js"
import { slideTheme } from "./theme-swatches.js"
import { whole, type Parts, type PartCodec, type TraitXml } from "./xml-codec.js"

type Font = "major" | "minor"

const fontTags: Readonly<Record<Font, string>> = { major: "a:majorFont", minor: "a:minorFont" }

function found(bytes: Uint8Array, path: readonly string[]): MarkupElement | undefined {
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  let at = elements[0]
  for (const kind of path) at = at === undefined ? undefined : children[at.index]?.find((each) => each.kind === kind)
  return at
}

function valueOf(element: MarkupElement | undefined, name: string): string | null {
  const held = element?.attributes.find((attribute) => attribute.name === name)
  return held === undefined ? null : decodedXmlText(held.value)
}

function slotPath(slot: ThemeSlot): readonly string[] {
  return ["a:themeElements", "a:clrScheme", `a:${slot}`]
}

function fontPath(font: Font): readonly string[] {
  return ["a:themeElements", "a:fontScheme", fontTags[font], "a:latin"]
}

function colorOf(bytes: Uint8Array, slot: ThemeSlot): string | null {
  const held = found(bytes, slotPath(slot))
  if (held === undefined) return null
  const { elements } = requireMarkup(bytes)
  const [color, ...rest] = markupChildren(elements)[held.index] ?? []
  if (color === undefined || rest.length > 0 || !color.selfClosing) return null
  const hex =
    color.kind === "a:srgbClr" ? valueOf(color, "val") : color.kind === "a:sysClr" ? valueOf(color, "lastClr") : null
  return hex === null ? null : hex.toUpperCase()
}

function withSlot(bytes: Uint8Array, slot: ThemeSlot, hex: string): Uint8Array {
  const held = found(bytes, slotPath(slot))
  if (held === undefined) throw new Error("theme-slot")
  const color = encodeUtf8(`<a:srgbClr val="${hex}"/>`)
  if (held.selfClosing)
    return spliceBytes(bytes, [
      { start: held.start, end: held.end, next: encodeUtf8(`<a:${slot}><a:srgbClr val="${hex}"/></a:${slot}>`) },
    ])
  return spliceBytes(bytes, [{ start: held.openEnd, end: held.closeStart, next: color }])
}

function withFont(bytes: Uint8Array, font: Font, typeface: string): Uint8Array {
  const latin = encodeUtf8(`<a:latin typeface="${xmlAttribute(typeface)}"/>`)
  const held = found(bytes, fontPath(font))
  if (held !== undefined) return spliceBytes(bytes, [{ start: held.start, end: held.end, next: latin }])
  const scheme = found(bytes, fontPath(font).slice(0, -1))
  if (scheme === undefined || scheme.selfClosing) throw new Error("theme-font")
  return spliceBytes(bytes, [{ start: scheme.openEnd, end: scheme.openEnd, next: latin }])
}

function written(parts: Parts, part: string, bytes: Uint8Array): Parts {
  const next = new Map(parts)
  next.set(part, bytes)
  return next
}

function slotCodec(slot: ThemeSlot): PartCodec<string> {
  return {
    read: (parts, at) => colorOf(partBytes(parts, at.part), slot),
    write: (parts, at, value) => written(parts, at.part, withSlot(partBytes(parts, at.part), slot, value)),
  }
}

function fontCodec(font: Font): PartCodec<string> {
  return {
    read: (parts, at) => valueOf(found(partBytes(parts, at.part), fontPath(font)), "typeface"),
    write: (parts, at, value) => written(parts, at.part, withFont(partBytes(parts, at.part), font, value)),
  }
}

export const themeXml: TraitXml<"theme"> = {
  slot: null,
  fields: {
    dk1: whole(slotCodec("dk1")),
    lt1: whole(slotCodec("lt1")),
    dk2: whole(slotCodec("dk2")),
    lt2: whole(slotCodec("lt2")),
    accent1: whole(slotCodec("accent1")),
    accent2: whole(slotCodec("accent2")),
    accent3: whole(slotCodec("accent3")),
    accent4: whole(slotCodec("accent4")),
    accent5: whole(slotCodec("accent5")),
    accent6: whole(slotCodec("accent6")),
    hlink: whole(slotCodec("hlink")),
    folHlink: whole(slotCodec("folHlink")),
    major: whole(fontCodec("major")),
    minor: whole(fontCodec("minor")),
  },
}

export function slideThemes(parts: Parts): readonly string[] {
  const themes = readSlides(parts).flatMap(({ part }) => slideTheme(parts, part) ?? [])
  return [...new Set(themes)]
}

export type ShownTheme = Partial<TraitValue<"theme">>

export function shownTheme(parts: Parts, slide: string): ShownTheme {
  const part = slideTheme(parts, slide)
  const bytes = part === null ? undefined : parts.get(part)
  if (bytes === undefined) return {}
  const shown: Record<string, string> = {}
  for (const slot of themeSlots) {
    const hex = colorOf(bytes, slot)
    if (hex !== null) shown[slot] = hex
  }
  for (const font of ["major", "minor"] as const) {
    const typeface = valueOf(found(bytes, fontPath(font)), "typeface")
    if (typeface !== null) shown[font] = typeface
  }
  return shown
}
