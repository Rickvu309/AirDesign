import type { Place } from "@airdesign/document"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import { isShapeTag, shapeById, shapeTags } from "./shape-tree.js"
import type { ShapeBox } from "./shape-write.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"

export type SavedGroup = { readonly bytes: Uint8Array; readonly children: readonly string[] }

export type Unwrapped = {
  readonly bytes: Uint8Array
  readonly saved: SavedGroup
  readonly children: readonly string[]
  readonly frame: ShapeBox | null
  readonly place: Place | null
}

const groupOwn = new Set(["p:nvGrpSpPr", "p:grpSpPr", "p:extLst"])
const fills = new Set(["a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"])

function attr(element: MarkupElement | undefined, name: string): string | null {
  return element?.attributes.find((item) => item.name === name)?.value ?? null
}

function whole(element: MarkupElement | undefined, name: string): number | null {
  const value = Number(attr(element, name))
  return attr(element, name) !== null && Number.isSafeInteger(value) ? value : null
}

function isTrue(element: MarkupElement, name: string): boolean {
  const value = attr(element, name)
  return value === "1" || value === "true"
}

function childOf(children: MarkupChildren, parent: MarkupElement, kind: string): MarkupElement | undefined {
  return children[parent.index]?.find((each) => each.kind === kind)
}

function treeUnit(elements: readonly MarkupElement[], shape: MarkupElement): MarkupElement {
  let current = shape
  while (current.parent >= 0) {
    const parent = elements[current.parent]
    if (parent === undefined) break
    if (parent.kind === "p:spTree" || parent.kind === "p:grpSp") return current
    current = parent
  }
  throw new Error("shape")
}

function transformOf(children: MarkupChildren, shape: MarkupElement): MarkupElement | undefined {
  if (!isShapeTag(shape.kind)) return undefined
  const { properties, transform } = shapeTags[shape.kind]
  const holder = properties === null ? shape : childOf(children, shape, properties)
  return holder === undefined ? undefined : childOf(children, holder, transform)
}

function boxAt(children: MarkupChildren, xfrm: MarkupElement, off: string, ext: string): ShapeBox | null {
  const offset = childOf(children, xfrm, off)
  const extent = childOf(children, xfrm, ext)
  const [x, y, cx, cy] = [whole(offset, "x"), whole(offset, "y"), whole(extent, "cx"), whole(extent, "cy")]
  if (x === null || y === null || cx === null || cy === null || cx < 0 || cy < 0) return null
  return { x, y, cx, cy }
}

function placeOfShape(children: MarkupChildren, shape: MarkupElement): Place | null {
  const xfrm = transformOf(children, shape)
  if (xfrm === undefined) return null
  const box = boxAt(children, xfrm, "a:off", "a:ext")
  if (box === null) return null
  const rot = whole(xfrm, "rot") ?? 0
  return { box, rot, flipH: isTrue(xfrm, "flipH"), flipV: isTrue(xfrm, "flipV") }
}

export function shapePlace(bytes: Uint8Array, shape: string): Place | null {
  const { elements } = requireMarkup(bytes)
  return placeOfShape(markupChildren(elements), shapeById(elements, shape))
}

function joined(pieces: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(pieces.reduce((size, piece) => size + piece.byteLength, 0))
  let at = 0
  for (const piece of pieces) {
    out.set(piece, at)
    at += piece.byteLength
  }
  return out
}

function unitsOf(bytes: Uint8Array, shapes: readonly string[]): readonly MarkupElement[] {
  const { elements } = requireMarkup(bytes)
  const units = shapes.map((shape) => treeUnit(elements, shapeById(elements, shape)))
  const parent = units[0]?.parent
  if (parent === undefined || units.some((unit) => unit.parent !== parent)) throw new Error("shape")
  if (new Set(units.map((unit) => unit.index)).size !== units.length) throw new Error("shape")
  return [...units].sort((left, right) => left.start - right.start)
}

function gathered(bytes: Uint8Array, units: readonly MarkupElement[], wrap: (inside: Uint8Array) => Uint8Array) {
  const last = units.at(-1)
  if (last === undefined) throw new Error("shape")
  const inside = joined(units.map((unit) => bytes.subarray(unit.start, unit.end)))
  const edits: ByteEdit[] = units.map((unit) => ({
    start: unit.start,
    end: unit.end,
    next: unit === last ? wrap(inside) : new Uint8Array(),
  }))
  return spliceBytes(bytes, edits)
}

export function wrapGroup(bytes: Uint8Array, id: number, box: ShapeBox, members: readonly string[]): Uint8Array {
  const units = unitsOf(bytes, members)
  const offset = `x="${box.x}" y="${box.y}"`
  const extent = `cx="${box.cx}" cy="${box.cy}"`
  const open = encodeUtf8(
    `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="Group ${id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
      `<p:grpSpPr><a:xfrm><a:off ${offset}/><a:ext ${extent}/><a:chOff ${offset}/><a:chExt ${extent}/></a:xfrm></p:grpSpPr>`,
  )
  const close = encodeUtf8("</p:grpSp>")
  return gathered(bytes, units, (inside) => joined([open, inside, close]))
}

export function regroupSaved(bytes: Uint8Array, saved: SavedGroup): Uint8Array {
  return gathered(bytes, unitsOf(bytes, saved.children), () => saved.bytes)
}

function firstShapeId(elements: readonly MarkupElement[], unit: MarkupElement): string | null {
  for (let at = unit.index; at < elements.length; at += 1) {
    const element = elements[at]
    if (element === undefined || element.start >= unit.end) break
    if (element.kind === "p:cNvPr" && element.id !== null) return element.id
  }
  return null
}

function groupFillEdits(
  bytes: Uint8Array,
  children: MarkupChildren,
  group: MarkupElement,
  units: readonly MarkupElement[],
) {
  const properties = childOf(children, group, "p:grpSpPr")
  const fill = properties === undefined ? undefined : children[properties.index]?.find((each) => fills.has(each.kind))
  if (fill === undefined || fill.kind === "a:grpFill") return []
  const next = bytes.slice(fill.start, fill.end)
  return units.flatMap((unit) => {
    if (!isShapeTag(unit.kind)) return []
    const holder = shapeTags[unit.kind].properties
    const host = holder === null ? undefined : childOf(children, unit, holder)
    const inherited = host === undefined ? undefined : childOf(children, host, "a:grpFill")
    return inherited === undefined ? [] : [{ start: inherited.start, end: inherited.end, next }]
  })
}

export function unwrapGroup(bytes: Uint8Array, shape: string): Unwrapped {
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const group = shapeById(elements, shape)
  if (group.kind !== "p:grpSp" || group.selfClosing) throw new Error("p:grpSp")
  const units = (children[group.index] ?? []).filter((each) => !groupOwn.has(each.kind))
  const xfrm = transformOf(children, group)
  const frame = xfrm === undefined ? null : boxAt(children, xfrm, "a:chOff", "a:chExt")
  const ids = units.flatMap((unit) => {
    const id = firstShapeId(elements, unit)
    return id === null ? [] : [id]
  })
  const first = units[0]
  const last = units.at(-1)
  const inside =
    first === undefined || last === undefined
      ? new Uint8Array()
      : spliceBytes(
          bytes.slice(first.start, last.end),
          groupFillEdits(bytes, children, group, units).map((edit) => ({
            ...edit,
            start: edit.start - first.start,
            end: edit.end - first.start,
          })),
        )
  return {
    bytes: spliceBytes(bytes, [{ start: group.start, end: group.end, next: inside }]),
    saved: { bytes: bytes.slice(group.start, group.end), children: ids },
    children: units.flatMap((unit) => {
      const id = isShapeTag(unit.kind) ? firstShapeId(elements, unit) : null
      return id === null ? [] : [id]
    }),
    frame,
    place: placeOfShape(children, group),
  }
}
