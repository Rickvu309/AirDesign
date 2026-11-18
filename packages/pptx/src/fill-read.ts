import { patternPresets, type Color, type FieldValue } from "@airdesign/document"
import { colorIn, fillIn } from "./color-read.js"
import { spliceBytes, type MarkupElement } from "./element-span.js"
import { child, flag, inside, whole, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import type { Sheet } from "./paint-sheet.js"
import { requireMarkup } from "./part-markup.js"
import { ownersOf, propertiesOf, sheetOf, stylesOf, type Chain } from "./trait-read.js"

export type SlotFill = FieldValue<"fills", "p0">

export type Fill = Exclude<SlotFill, { readonly hidden: unknown }>

export type ShownFill = { readonly value: Fill | null; readonly own: boolean }

export type FillAt = { readonly part: string; readonly shape: string }

type Gradient = Extract<Fill, { readonly gradient: unknown }>["gradient"]

const pathKinds = ["circle", "rect", "shape"] as const
const fullAngle = 21_600_000

function fraction(held: Held | undefined, name: string): number | null {
  if (held === undefined) return 0
  const value = paintAttribute(held.element, name) === null ? 0 : whole(held.element, name)
  return value === undefined || value < 0 || value > 100_000 ? null : value
}

function stopsOf(held: Held, placed: Color | null): Gradient["stops"] | null {
  const list = child(held, "a:gsLst")
  const stops = (list === undefined ? [] : inside(list)).map((element) => {
    const stop = { ...held, element }
    const pos = fraction(stop, "pos")
    const color = colorIn(stop, placed)
    return element.kind !== "a:gs" || pos === null || color === null ? null : { pos, color }
  })
  const kept = stops.flatMap((stop) => (stop === null ? [] : [stop]))
  return kept.length !== stops.length || kept.length < 2 || kept.length > 10 ? null : kept
}

function shadeOf(held: Held): Gradient["shade"] | null {
  const linear = child(held, "a:lin")
  const path = child(held, "a:path")
  if (path !== undefined) {
    const kind = pathKinds.find((each) => each === paintAttribute(path.element, "path"))
    const rect = child(path, "a:fillToRect")
    const [l, t, r, b] = ["l", "t", "r", "b"].map((side) => fraction(rect, side))
    if (kind === undefined || l == null || t == null || r == null || b == null) return null
    return { path: { kind, focus: { l, t, r, b } } }
  }
  const angle = linear === undefined ? 0 : (whole(linear.element, "ang") ?? 0)
  if (angle < 0 || angle >= fullAngle) return null
  return { linear: { angle, scaled: linear === undefined ? false : (flag(linear.element, "scaled") ?? false) } }
}

function gradientOf(held: Held, placed: Color | null): Fill | null {
  const stops = stopsOf(held, placed)
  const shade = shadeOf(held)
  if (stops === null || shade === null) return null
  return { gradient: { stops, shade, rotateWithShape: flag(held.element, "rotWithShape") ?? false } }
}

function patternOf(held: Held, placed: Color | null): Fill | null {
  const preset = patternPresets.find((each) => each === paintAttribute(held.element, "prst"))
  const fg = colorIn(child(held, "a:fgClr"), placed)
  const bg = colorIn(child(held, "a:bgClr"), placed)
  return preset === undefined || fg === null || bg === null ? null : { pattern: { preset, fg, bg } }
}

export function fillValueOf(held: Held, placed: Color | null): Fill | null {
  switch (held.element.kind) {
    case "a:noFill":
      return { none: true }
    case "a:grpFill":
      return { group: true }
    case "a:solidFill": {
      const color = colorIn(held, placed)
      return color === null ? null : { solid: color }
    }
    case "a:gradFill":
      return gradientOf(held, placed)
    case "a:pattFill":
      return patternOf(held, placed)
  }
  return null
}

const backgroundIndex = 1001

function backgroundFills(theme: Sheet | null): readonly Held[] {
  const root = theme?.elements[0]
  if (theme === null || root === undefined) return []
  const scheme = child(child({ element: root, children: theme.children }, "a:themeElements"), "a:fmtScheme")
  const list = child(scheme, "a:bgFillStyleLst")
  return list === undefined ? [] : inside(list).map((element) => ({ ...list, element }))
}

type Reference = { readonly owner: Held; readonly reference: Held; readonly entry: Held | undefined } | "none"

function styleReference(owners: readonly Held[], theme: Sheet | null): Reference {
  for (const owner of owners) {
    const reference = child(child(owner, "p:style"), "a:fillRef")
    if (reference === undefined) continue
    const index = whole(reference.element, "idx") ?? 0
    if (index === 0) return "none"
    const background = index >= backgroundIndex
    const entry = (background ? backgroundFills(theme) : stylesOf(theme).fills)[
      background ? index - backgroundIndex : index - 1
    ]
    return { owner, reference, entry }
  }
  return "none"
}

type Owned = { readonly chain: Chain; readonly owners: readonly Held[] }

function ownedOf(parts: ReadonlyMap<string, Uint8Array>, at: FillAt): Owned | null {
  const sheet = sheetOf(parts, at.part)
  const item = sheet?.drawn.find((each) => each.shape === at.shape)
  if (sheet === null || item === undefined) return null
  const layout = sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const theme = master === null ? null : sheetOf(parts, linkedPart(parts, master.part, "theme"))
  const chain = { sheet, layout, master, theme }
  return { chain, owners: ownersOf(item, chain) }
}

export function shownFill(parts: ReadonlyMap<string, Uint8Array>, at: FillAt): ShownFill | null {
  const owned = ownedOf(parts, at)
  if (owned === null) return null
  const { chain, owners } = owned
  const filled = owners.findIndex((owner) => fillIn(propertiesOf(owner)) !== undefined)
  const held = fillIn(propertiesOf(owners[filled] ?? owners[0]!))
  if (held !== undefined && held.element.kind === "a:blipFill") return { value: { image: true }, own: filled === 0 }
  if (held !== undefined) return { value: fillValueOf(held, null), own: filled === 0 }
  const style = styleReference(owners, chain.theme)
  if (style === "none") return { value: { none: true }, own: false }
  const value = style.entry === undefined ? null : fillValueOf(style.entry, colorIn(style.reference, null))
  return { value, own: false }
}

function sheetFor(chain: Chain, held: Held): Sheet | null {
  if (held.source === "layout") return chain.layout
  if (held.source === "master") return chain.master
  return chain.sheet
}

function sliceOf(sheet: Sheet | null, element: MarkupElement): Uint8Array | null {
  return sheet === null ? null : sheet.bytes.subarray(element.start, element.end)
}

const colorKinds = new Set(["a:schemeClr", "a:srgbClr", "a:sysClr", "a:prstClr", "a:scrgbClr", "a:hslClr"])

function openText(bytes: Uint8Array, element: MarkupElement): string {
  return decodeUtf8(bytes.subarray(element.start, element.openEnd - (element.selfClosing ? 2 : 1))).trimEnd()
}

function innerText(bytes: Uint8Array, element: MarkupElement): string {
  return element.selfClosing ? "" : decodeUtf8(bytes.subarray(element.openEnd, element.closeStart))
}

export function placedBytes(entry: Uint8Array, placed: Uint8Array | null): Uint8Array | null {
  const { elements } = requireMarkup(entry)
  const held = elements.filter((each) => each.kind === "a:schemeClr" && paintAttribute(each, "val") === "phClr")
  if (held.length === 0) return entry
  const root = placed === null ? undefined : requireMarkup(placed).elements[0]
  if (placed === null || root === undefined) return null
  const open = openText(placed, root)
  const close = `</${root.kind}>`
  return spliceBytes(
    entry,
    held.map((each) => {
      const inner = innerText(placed, root) + innerText(entry, each)
      return {
        start: each.start,
        end: each.end,
        next: encodeUtf8(inner === "" ? `${open}/>` : `${open}>${inner}${close}`),
      }
    }),
  )
}

export function inheritedFill(parts: ReadonlyMap<string, Uint8Array>, at: FillAt): Uint8Array | null {
  const owned = ownedOf(parts, at)
  if (owned === null) return null
  const { chain, owners } = owned
  const filled = owners.findIndex((owner) => fillIn(propertiesOf(owner)) !== undefined)
  const owner = owners[filled]
  const held = owner === undefined ? undefined : fillIn(propertiesOf(owner))
  if (filled === 0) return null
  if (owner !== undefined && held !== undefined) return sliceOf(sheetFor(chain, owner), held.element)
  const style = styleReference(owners, chain.theme)
  if (style === "none" || style.entry === undefined) return null
  const entry = sliceOf(chain.theme, style.entry.element)
  const color = inside(style.reference).find((each) => colorKinds.has(each.kind))
  const placed = color === undefined ? null : sliceOf(sheetFor(chain, style.owner), color)
  return entry === null ? null : placedBytes(entry, placed)
}

export function ownBackground(parts: ReadonlyMap<string, Uint8Array>, part: string): Fill | null {
  const sheet = sheetOf(parts, part)
  const root = sheet?.elements[0]
  if (sheet === null || root === undefined) return null
  const properties = child(child(child({ element: root, children: sheet.children }, "p:cSld"), "p:bg"), "p:bgPr")
  const held = fillIn(properties)
  if (held?.element.kind === "a:blipFill") return { image: true }
  return held === undefined ? null : fillValueOf(held, null)
}

export function shownBackground(parts: ReadonlyMap<string, Uint8Array>, part: string): ShownFill | null {
  const sheet = sheetOf(parts, part)
  const layout = sheetOf(parts, linkedPart(parts, part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const theme = master === null ? null : sheetOf(parts, linkedPart(parts, master.part, "theme"))
  for (const level of [sheet, layout, master]) {
    const root = level?.elements[0]
    if (level === null || root === undefined) continue
    const background = child(child({ element: root, children: level.children }, "p:cSld"), "p:bg")
    if (background === undefined) continue
    const held = fillIn(child(background, "p:bgPr"))
    const own = level === sheet
    if (held !== undefined)
      return { value: held.element.kind === "a:blipFill" ? { image: true } : fillValueOf(held, null), own }
    const reference = child(background, "p:bgRef")
    const index = reference === undefined ? 0 : (whole(reference.element, "idx") ?? 0)
    const entry = backgroundFills(theme)[index - backgroundIndex]
    return { value: entry === undefined ? null : fillValueOf(entry, colorIn(reference, null)), own }
  }
  return null
}
