import { markupDocument, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { paintAttribute, paintColor, type PaintColor, type PaintPalette } from "./paint-color.js"
import { paintFill } from "./paint-fill.js"
import { holderText, markupChildren, type MarkupChildren } from "./text-value-route.js"

export type PaintChartLine = { readonly color: PaintColor; readonly width: number }

export type PaintChartTitle = { readonly text: string; readonly look: PaintChartLook }

export type PaintChartLook = {
  readonly size: number
  readonly bold: boolean
  readonly color: PaintColor | null
  readonly font: string | null
}

export type ChartMarkup = {
  readonly root: MarkupElement | undefined
  child(parent: MarkupElement | undefined, kind: string): MarkupElement | undefined
  all(parent: MarkupElement | undefined, kind: string): readonly MarkupElement[]
  value(parent: MarkupElement | undefined, kind: string): string | null
  number(parent: MarkupElement | undefined, kind: string): number | null
  flag(parent: MarkupElement | undefined, kind: string): boolean | null
  text(element: MarkupElement | undefined): string
  color(element: MarkupElement | undefined): PaintColor | null
  fill(properties: MarkupElement | undefined): PaintColor | null | undefined | "picture"
  line(properties: MarkupElement | undefined, width: number): PaintChartLine | null | undefined
  look(holder: MarkupElement | undefined, base: PaintChartLook): PaintChartLook
}

const emuPerPoint = 12_700
const sizePerPoint = 100
const trueValues = new Set(["1", "true", "on"])
const fillKinds = new Set(["a:noFill", "a:solidFill", "a:gradFill", "a:pattFill", "a:blipFill"])
const colorKinds = new Set(["a:schemeClr", "a:srgbClr", "a:sysClr", "a:prstClr", "a:scrgbClr", "a:hslClr"])

export function chartMarkup(
  bytes: Uint8Array,
  palette: PaintPalette,
  fonts: ReadonlyMap<string, string>,
): ChartMarkup | null {
  let elements: readonly MarkupElement[]
  try {
    elements = markupDocument(bytes).elements
  } catch {
    return null
  }
  const children: MarkupChildren = markupChildren(elements)
  const child = (parent: MarkupElement | undefined, kind: string) =>
    parent === undefined ? undefined : children[parent.index]?.find((element) => element.kind === kind)
  const all = (parent: MarkupElement | undefined, kind: string) =>
    parent === undefined ? [] : (children[parent.index] ?? []).filter((element) => element.kind === kind)
  const value = (parent: MarkupElement | undefined, kind: string) => {
    const found = child(parent, kind)
    return found === undefined ? null : paintAttribute(found, "val")
  }
  const number = (parent: MarkupElement | undefined, kind: string) => {
    const read = value(parent, kind)
    const parsed = read === null || read.trim() === "" ? Number.NaN : Number(read)
    return Number.isFinite(parsed) ? parsed : null
  }
  const flag = (parent: MarkupElement | undefined, kind: string) => {
    const found = child(parent, kind)
    if (found === undefined) return null
    const read = paintAttribute(found, "val")
    return read === null || trueValues.has(read)
  }
  const color = (element: MarkupElement | undefined) => {
    const found = (element === undefined ? [] : (children[element.index] ?? [])).find((item) =>
      colorKinds.has(item.kind),
    )
    return found === undefined ? null : paintColor(found, children, palette)
  }
  const fill = (properties: MarkupElement | undefined) => {
    const holder = (properties === undefined ? [] : (children[properties.index] ?? [])).find((item) =>
      fillKinds.has(item.kind),
    )
    if (holder === undefined) return undefined
    const read = paintFill(holder, children, palette, () => null, true)
    if (read === null) return holder.kind === "a:blipFill" ? "picture" : undefined
    if (read.type === "none") return null
    if (read.type === "solid") return read.color
    if (read.type === "gradient") return read.stops[0]?.color ?? null
    return read.type === "pattern" ? read.foreground : "picture"
  }
  const line = (properties: MarkupElement | undefined, width: number) => {
    const outline = child(properties, "a:ln")
    if (outline === undefined) return undefined
    if (child(outline, "a:noFill") !== undefined) return null
    const solid = color(child(outline, "a:solidFill"))
    const drawn = Number(paintAttribute(outline, "w"))
    if (solid === null) return undefined
    return { color: solid, width: Number.isFinite(drawn) && drawn > 0 ? drawn / emuPerPoint : width }
  }
  const look = (holder: MarkupElement | undefined, base: PaintChartLook): PaintChartLook => {
    if (holder === undefined) return base
    const size = Number(paintAttribute(holder, "sz"))
    const bold = paintAttribute(holder, "b")
    const latin = child(holder, "a:latin")
    const typeface = latin === undefined ? null : paintAttribute(latin, "typeface")
    const named =
      typeface === null || typeface === "" ? null : typeface.startsWith("+") ? fonts.get(typeface) : typeface
    return {
      size: Number.isFinite(size) && size > 0 ? size / sizePerPoint : base.size,
      bold: bold === null ? base.bold : trueValues.has(bold),
      color: color(child(holder, "a:solidFill")) ?? base.color,
      font: named ?? base.font,
    }
  }
  return {
    root: elements[0],
    child,
    all,
    value,
    number,
    flag,
    text: (element) => (element === undefined ? "" : holderText(bytes, element)),
    color,
    fill,
    line,
    look,
  }
}

const standardColors = `<cs:colorStyle xmlns:cs="cs" xmlns:a="a">${[1, 2, 3, 4, 5, 6]
  .map((at) => `<a:schemeClr val="accent${at}"/>`)
  .join(
    "",
  )}<cs:variation/><cs:variation><a:lumMod val="60000"/></cs:variation><cs:variation><a:lumMod val="80000"/><a:lumOff val="20000"/></cs:variation><cs:variation><a:lumMod val="80000"/></cs:variation><cs:variation><a:lumMod val="60000"/><a:lumOff val="40000"/></cs:variation><cs:variation><a:lumMod val="50000"/></cs:variation><cs:variation><a:lumMod val="70000"/><a:lumOff val="30000"/></cs:variation><cs:variation><a:lumMod val="70000"/></cs:variation><cs:variation><a:lumMod val="50000"/><a:lumOff val="50000"/></cs:variation></cs:colorStyle>`

export type ChartCycle = (index: number) => PaintColor | null

export function chartCycle(bytes: Uint8Array | null, palette: PaintPalette): ChartCycle {
  let elements: readonly MarkupElement[]
  try {
    elements = markupDocument(bytes ?? encodeUtf8(standardColors)).elements
  } catch {
    return () => null
  }
  const children = markupChildren(elements)
  const root = elements[0]
  const listed = root === undefined ? [] : (children[root.index] ?? [])
  const colors = listed.filter((element) => colorKinds.has(element.kind))
  const variations = listed.filter((element) => element.kind === "cs:variation")
  return (index) => {
    const base = colors[index % colors.length]
    if (base === undefined) return null
    const variation = variations[Math.floor(index / colors.length) % Math.max(variations.length, 1)]
    const changes = variation === undefined ? [] : (children[variation.index] ?? [])
    const patched = children.map((list, at) => (at === base.index ? [...list, ...changes] : list))
    return paintColor(base, patched, palette)
  }
}
