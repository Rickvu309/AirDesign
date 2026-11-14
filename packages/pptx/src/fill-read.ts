import { patternPresets, type Color, type FieldValue } from "@airdesign/document"
import { colorIn, fillIn } from "./color-read.js"
import { child, flag, inside, whole, type Held } from "./markup-held.js"
import { linkedPart } from "./notes-part.js"
import { paintAttribute } from "./paint-color.js"
import type { Sheet } from "./paint-sheet.js"
import { ownersOf, propertiesOf, sheetOf, stylesOf } from "./trait-read.js"

export type Fill = FieldValue<"fill", "value">

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

function styleFill(owners: readonly Held[], theme: Sheet | null): ShownFill {
  for (const owner of owners) {
    const reference = child(child(owner, "p:style"), "a:fillRef")
    if (reference === undefined) continue
    const index = whole(reference.element, "idx") ?? 0
    if (index === 0) return { value: { none: true }, own: false }
    const background = index >= backgroundIndex
    const entry = (background ? backgroundFills(theme) : stylesOf(theme).fills)[
      background ? index - backgroundIndex : index - 1
    ]
    return { value: entry === undefined ? null : fillValueOf(entry, colorIn(reference, null)), own: false }
  }
  return { value: { none: true }, own: false }
}

export function shownFill(parts: ReadonlyMap<string, Uint8Array>, at: FillAt): ShownFill | null {
  const sheet = sheetOf(parts, at.part)
  const item = sheet?.drawn.find((each) => each.shape === at.shape)
  if (sheet === null || item === undefined) return null
  const layout = sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const theme = master === null ? null : sheetOf(parts, linkedPart(parts, master.part, "theme"))
  const owners = ownersOf(item, { sheet, layout, master, theme })
  const filled = owners.findIndex((owner) => fillIn(propertiesOf(owner)) !== undefined)
  const held = fillIn(propertiesOf(owners[filled] ?? owners[0]!))
  if (held !== undefined) return { value: fillValueOf(held, null), own: filled === 0 }
  return styleFill(owners, theme)
}

export function ownBackground(parts: ReadonlyMap<string, Uint8Array>, part: string): Fill | null {
  const sheet = sheetOf(parts, part)
  const root = sheet?.elements[0]
  if (sheet === null || root === undefined) return null
  const properties = child(child(child({ element: root, children: sheet.children }, "p:cSld"), "p:bg"), "p:bgPr")
  const held = fillIn(properties)
  return held === undefined ? null : fillValueOf(held, null)
}
