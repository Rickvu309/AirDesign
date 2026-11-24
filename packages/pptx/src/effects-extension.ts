import type { Color, FieldValue } from "@airdesign/document"
import { insertChild } from "./child-order.js"
import { colorIn } from "./color-read.js"
import { colorXml } from "./color-xml.js"
import type { MarkupElement } from "./element-span.js"
import { changedPart } from "./fill-host.js"
import { child, whole } from "./markup-held.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintAttribute, paintColor, type PaintPalette } from "./paint-color.js"
import type { PaintInner, PaintShadow } from "./paint-effects.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { isShapeTag, shapeById, shapeTags } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"
import type { Parts } from "./xml-codec.js"

type HostAt = { readonly part: string; readonly shape: string }

export const effectsUri = "{C3A91E40-7B2D-4F6A-8E15-9D0A2B4C6E18}"

export const effectsNamespace = "https://airdesign.app/2026/effects"

export const dropSlots = ["drop1", "drop2", "drop3"] as const

export const innerSlots = ["inner1", "inner2", "inner3"] as const

export type ExtraSlot = (typeof dropSlots)[number] | (typeof innerSlots)[number]

export type StoredDrop = {
  readonly n: 1 | 2 | 3
  readonly blur: number
  readonly distance: number
  readonly direction: number
  readonly color: Color
}

type Offset = Pick<StoredDrop, "blur" | "distance" | "direction" | "color">

type SlotValue = { readonly none: true } | { readonly outer: Offset } | { readonly inner: Offset }

type ExtraValues = Partial<Record<ExtraSlot, SlotValue | null>>

type Found = {
  readonly bytes: Uint8Array
  readonly children: MarkupChildren
  readonly properties: MarkupElement
  readonly propertiesKind: "p:spPr" | "p:grpSpPr"
  readonly list: MarkupElement | undefined
  readonly own: MarkupElement | undefined
}

const widest = 2_540_000
const fullAngle = 21_600_000
const anglesPerDegree = 60_000
const slots = [...dropSlots, ...innerSlots] as const

function found(parts: Parts, at: HostAt): Found | null {
  if (at.shape === "slide") return null
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  let shape: MarkupElement
  try {
    shape = shapeById(elements, at.shape)
  } catch {
    return null
  }
  if (!isShapeTag(shape.kind)) return null
  const propertiesKind = shapeTags[shape.kind].properties
  if (propertiesKind === null) return null
  const properties = children[shape.index]?.find((each) => each.kind === propertiesKind)
  if (properties === undefined) return null
  const list = children[properties.index]?.find((each) => each.kind === "a:extLst")
  const own = ownExtension(children, list)
  return { bytes, children, properties, propertiesKind, list, own }
}

function ranged(element: MarkupElement, name: string, missing: number): number | null {
  if (paintAttribute(element, name) === null) return missing
  const value = whole(element, name)
  return value === undefined || value < 0 || value > widest ? null : value
}

function directionOf(element: MarkupElement): number | null {
  if (paintAttribute(element, "dir") === null) return 0
  const value = whole(element, "dir")
  return value === undefined || value < 0 || value >= fullAngle ? null : value
}

function offsetOf(children: MarkupChildren, element: MarkupElement): Offset | null {
  const blur = ranged(element, "blurRad", 0)
  const distance = ranged(element, "dist", 0)
  const direction = directionOf(element)
  const color = colorIn({ element, children }, null)
  if (blur === null || distance === null || direction === null || color === null) return null
  return { blur, distance, direction, color }
}

function slotOf(kind: string, n: string | null): ExtraSlot | null {
  if (n !== "1" && n !== "2" && n !== "3") return null
  if (kind === "adf:drop") return `drop${n}`
  if (kind === "adf:inner") return `inner${n}`
  return null
}

function valuesIn(children: MarkupChildren, list: MarkupElement | undefined): ExtraValues {
  if (list === undefined) return {}
  const root = child({ element: list, children }, "adf:effects")
  if (root === undefined) return {}
  const values: ExtraValues = {}
  for (const element of children[root.element.index] ?? []) {
    const slot = slotOf(element.kind, paintAttribute(element, "n"))
    if (slot === null || values[slot] !== undefined) continue
    const offset = offsetOf(children, element)
    values[slot] = offset === null ? null : slot.startsWith("drop") ? { outer: offset } : { inner: offset }
  }
  return values
}

function ownExtension(children: MarkupChildren, list: MarkupElement | undefined): MarkupElement | undefined {
  return list === undefined
    ? undefined
    : children[list.index]?.find((each) => paintAttribute(each, "uri") === effectsUri)
}

function readHeld(parts: Parts, at: HostAt): ExtraValues {
  const held = found(parts, at)
  if (held === null || held.own === undefined) return {}
  return valuesIn(held.children, held.own)
}

export function readExtension(parts: Parts, at: HostAt): ExtraValues {
  return readHeld(parts, at)
}

function entryXml(slot: ExtraSlot, value: SlotValue): string {
  if ("none" in value) return ""
  if (slot.startsWith("drop") && "outer" in value) {
    const { blur, distance, direction, color } = value.outer
    return `<adf:drop n="${slot.slice(4)}" blurRad="${blur}" dist="${distance}" dir="${direction}">${colorXml(color)}</adf:drop>`
  }
  if (slot.startsWith("inner") && "inner" in value) {
    const { blur, distance, direction, color } = value.inner
    return `<adf:inner n="${slot.slice(5)}" blurRad="${blur}" dist="${distance}" dir="${direction}">${colorXml(color)}</adf:inner>`
  }
  return ""
}

function listXml(values: ExtraValues): string {
  const inner = slots
    .map((slot) => {
      const value = values[slot]
      return value === undefined || value === null ? "" : entryXml(slot, value)
    })
    .join("")
  return `<a:ext uri="${effectsUri}"><adf:effects xmlns:adf="${effectsNamespace}">${inner}</adf:effects></a:ext>`
}

function live(values: ExtraValues): boolean {
  return slots.some((slot) => {
    const value = values[slot]
    return value !== undefined && value !== null && !("none" in value)
  })
}

function writtenList(parts: Parts, at: HostAt, values: ExtraValues): Parts {
  const held = found(parts, at)
  if (held === null) {
    if (!live(values)) return parts
    throw new Error("effects-extension")
  }
  const { bytes, properties, propertiesKind, list, own, children } = held
  const only = list !== undefined && own !== undefined && children[list.index]?.length === 1
  if (!live(values)) {
    const gone = only ? list : own
    return gone === undefined
      ? parts
      : changedPart(parts, at.part, bytes, { start: gone.start, end: gone.end, next: new Uint8Array() })
  }
  const next = encodeUtf8(listXml(values))
  if (own !== undefined) return changedPart(parts, at.part, bytes, { start: own.start, end: own.end, next })
  if (list !== undefined)
    return changedPart(parts, at.part, bytes, { start: list.closeStart, end: list.closeStart, next })
  const parent = decodeUtf8(bytes.subarray(properties.start, properties.end))
  const written = insertChild(propertiesKind, "a:extLst", `<a:extLst>${listXml(values)}</a:extLst>`, parent)
  return changedPart(parts, at.part, bytes, { start: properties.start, end: properties.end, next: encodeUtf8(written) })
}

export function writtenExtra<F extends ExtraSlot>(
  parts: Parts,
  at: HostAt,
  slot: F,
  value: FieldValue<"effects", F>,
): Parts {
  return writtenList(parts, at, { ...readHeld(parts, at), [slot]: value })
}

export function storedDrops(children: MarkupChildren, parent: MarkupElement): readonly StoredDrop[] {
  const drops: StoredDrop[] = []
  for (const element of children[parent.index] ?? []) {
    if (element.kind !== "adf:drop") continue
    const n = paintAttribute(element, "n")
    const offset = offsetOf(children, element)
    if ((n !== "1" && n !== "2" && n !== "3") || offset === null) continue
    drops.push({ n: Number(n) as 1 | 2 | 3, ...offset })
  }
  return drops
}

function degrees(direction: number): number {
  return (((direction / anglesPerDegree) % 360) + 360) % 360
}

function painted(
  children: MarkupChildren,
  element: MarkupElement,
  palette: PaintPalette,
): PaintShadow | PaintInner | null {
  const colorElement = children[element.index]?.[0]
  const color = colorElement === undefined ? null : paintColor(colorElement, children, palette)
  const blur = ranged(element, "blurRad", 0)
  const distance = ranged(element, "dist", 0)
  const direction = directionOf(element)
  if (color === null || blur === null || distance === null || direction === null) return null
  return { blur, distance, direction: degrees(direction), color }
}

export function paintedExtras(
  children: MarkupChildren,
  properties: MarkupElement | undefined,
  palette: PaintPalette,
): { readonly drops: readonly PaintShadow[]; readonly inners: readonly PaintInner[] } {
  if (properties === undefined) return { drops: [], inners: [] }
  const list = children[properties.index]?.find((each) => each.kind === "a:extLst")
  const own = ownExtension(children, list)
  const root = own === undefined ? undefined : children[own.index]?.[0]
  if (root === undefined || root.kind !== "adf:effects") return { drops: [], inners: [] }
  const drops: PaintShadow[] = []
  const inners: PaintInner[] = []
  for (const element of children[root.index] ?? []) {
    const paint = painted(children, element, palette)
    if (paint === null) continue
    if (element.kind === "adf:drop")
      drops.push({ ...paint, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, align: "b", rotateWithShape: false })
    if (element.kind === "adf:inner") inners.push(paint)
  }
  return { drops, inners }
}

export function paintedDrops(
  children: MarkupChildren,
  parent: MarkupElement,
  palette: PaintPalette,
): readonly PaintShadow[] {
  const drops: PaintShadow[] = []
  for (const element of children[parent.index] ?? []) {
    if (element.kind !== "adf:drop") continue
    const paint = painted(children, element, palette)
    if (paint === null) continue
    drops.push({ ...paint, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, align: "b", rotateWithShape: false })
  }
  return drops
}
