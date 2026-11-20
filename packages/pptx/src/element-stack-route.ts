import {
  elementStacks,
  readElementId,
  readSlideId,
  shapeOf,
  type ElementId,
  type ElementStack,
} from "@airdesign/document"

import type { MarkupElement } from "./element-span.js"
import { slidePart } from "./package-address.js"
import { requireMarkup } from "./part-markup.js"
import { readSlides } from "./read-shapes.js"
import { isShapeTag, shapeById } from "./shape-tree.js"

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

function joined(pieces: readonly Uint8Array[]): Uint8Array {
  let size = 0
  for (const piece of pieces) size += piece.byteLength
  const out = new Uint8Array(size)
  let at = 0
  for (const piece of pieces) {
    out.set(piece, at)
    at += piece.byteLength
  }
  return out
}

export function orderTree(bytes: Uint8Array, ids: readonly ElementId[]): Uint8Array {
  if (ids.length < 2) return bytes
  const document = requireMarkup(bytes)
  const found = ids.map((id) => {
    const shape = shapeById(document.elements, shapeOf(id).shape)
    return { id, unit: treeUnit(document.elements, shape) }
  })
  const parent = found[0]?.unit.parent
  if (parent === undefined || found.some((item) => item.unit.parent !== parent)) throw new Error("shape")
  if (new Set(found.map((item) => item.unit.index)).size !== found.length) throw new Error("shape")
  const current = [...found].sort((left, right) => left.unit.start - right.unit.start)
  if (current.every((item, index) => item.id === ids[index])) return bytes
  const slots = current.map((item) => item.unit)
  const byId = new Map(found.map((item) => [item.id, item.unit]))
  const pieces: Uint8Array[] = []
  let cursor = 0
  for (let index = 0; index < ids.length; index += 1) {
    const slot = slots[index]
    const wanted = ids[index]
    const unit = wanted === undefined ? undefined : byId.get(wanted)
    if (slot === undefined || unit === undefined) throw new Error("shape")
    pieces.push(bytes.subarray(cursor, slot.start))
    pieces.push(bytes.subarray(unit.start, unit.end))
    cursor = slot.end
  }
  pieces.push(bytes.subarray(cursor))
  return joined(pieces)
}

export function arrangeSlide(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  stacks: readonly ElementStack[],
): ReadonlyMap<string, Uint8Array> {
  const mine = stacks.filter((stack) => stack.ids.length > 1)
  if (mine.length === 0) return parts
  const name = slidePart(parts, slide)
  if (name === null) throw new Error("slide")
  const before = parts.get(name)
  if (before === undefined) throw new Error("part")
  let bytes = before
  for (const stack of mine) bytes = orderTree(bytes, stack.ids)
  if (bytes === before) return parts
  const next = new Map(parts)
  next.set(name, bytes)
  return next
}

function shapeAncestor(elements: readonly MarkupElement[], mark: MarkupElement): MarkupElement | null {
  let parent = mark.parent
  while (parent >= 0) {
    const ancestor = elements[parent]
    if (ancestor === undefined) return null
    if (isShapeTag(ancestor.kind)) return ancestor
    parent = ancestor.parent
  }
  return null
}

function directUnit(elements: readonly MarkupElement[], shape: MarkupElement): MarkupElement | null {
  let current = shape
  while (current.parent >= 0) {
    const parent = elements[current.parent]
    if (parent === undefined) return null
    if (parent.kind === "p:spTree" || parent.kind === "p:grpSp") return current
    current = parent
  }
  return null
}

function unitsUnder(elements: readonly MarkupElement[], parent: number, slide: string): ElementId[] {
  const seen = new Map<number, { start: number; id: ElementId }>()
  for (const mark of elements) {
    if (mark.kind !== "p:cNvPr" || mark.id === null) continue
    const shape = shapeAncestor(elements, mark)
    if (shape === null) continue
    const unit = directUnit(elements, shape)
    if (unit === null || unit.parent !== parent || seen.has(unit.index)) continue
    const id = readElementId(`${slide}.${mark.id}`)
    if (id === undefined) continue
    seen.set(unit.index, { start: unit.start, id })
  }
  return [...seen.values()].sort((left, right) => left.start - right.start).map((item) => item.id)
}

export function shapeSiblings(parts: ReadonlyMap<string, Uint8Array>, node: ElementId): readonly ElementId[] | null {
  const { slide, shape } = shapeOf(node)
  const found = readSlides(parts).find((each) => each.slide === slide)
  const bytes = found === undefined ? undefined : parts.get(found.part)
  if (bytes === undefined) return null
  const elements = requireMarkup(bytes).elements
  let shapeMark: MarkupElement
  try {
    shapeMark = shapeById(elements, shape)
  } catch {
    return null
  }
  const unit = directUnit(elements, shapeMark)
  if (unit === null) return null
  const siblings = unitsUnder(elements, unit.parent, slide)
  return siblings.includes(node) ? siblings : null
}

export function stacksOf(state: Parameters<typeof elementStacks>[0], slide: string): readonly ElementStack[] {
  return elementStacks(state).filter((stack) => stack.slide === slide)
}

export function raisedToTop(parts: ReadonlyMap<string, Uint8Array>, slide: string, shape: string) {
  const node = readElementId(`${slide}.${shape}`)
  const id = readSlideId(slide)
  const among = node === undefined ? null : shapeSiblings(parts, node)
  if (node === undefined || id === undefined || among === null || among.at(-1) === node) return parts
  return arrangeSlide(parts, slide, [{ slide: id, ids: [...among.filter((each) => each !== node), node] }])
}
