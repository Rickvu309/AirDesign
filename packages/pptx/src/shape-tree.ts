import type { Kind } from "@airdesign/document"
import type { MarkupElement } from "./element-span.js"

type ShapeFacts = {
  readonly nonVisual: string
  readonly properties: "p:spPr" | "p:grpSpPr" | null
  readonly transform: "a:xfrm" | "p:xfrm"
  readonly documentKind: Kind
}

export const shapeTags = {
  "p:sp": { nonVisual: "p:nvSpPr", properties: "p:spPr", transform: "a:xfrm", documentKind: "shape" },
  "p:pic": { nonVisual: "p:nvPicPr", properties: "p:spPr", transform: "a:xfrm", documentKind: "shape" },
  "p:graphicFrame": { nonVisual: "p:nvGraphicFramePr", properties: null, transform: "p:xfrm", documentKind: "kept" },
  "p:cxnSp": { nonVisual: "p:nvCxnSpPr", properties: "p:spPr", transform: "a:xfrm", documentKind: "connector" },
  "p:grpSp": { nonVisual: "p:nvGrpSpPr", properties: "p:grpSpPr", transform: "a:xfrm", documentKind: "group" },
} satisfies Record<string, ShapeFacts>

export type ShapeKind = keyof typeof shapeTags

export const isShapeTag = (kind: string): kind is ShapeKind => Object.hasOwn(shapeTags, kind)

export const paintKind = (kind: ShapeKind): Kind => shapeTags[kind].documentKind

const shapesByElements = new WeakMap<readonly MarkupElement[], ReadonlyMap<string, MarkupElement>>()
const indexedShapeThreshold = 64

function shapeOwner(elements: readonly MarkupElement[], mark: MarkupElement): MarkupElement | undefined {
  let parent = mark.parent
  while (parent >= 0) {
    const ancestor = elements[parent]
    if (ancestor === undefined) return undefined
    if (isShapeTag(ancestor.kind)) return ancestor
    parent = ancestor.parent
  }
  return undefined
}

function shapeIndex(elements: readonly MarkupElement[]): ReadonlyMap<string, MarkupElement> {
  const known = shapesByElements.get(elements)
  if (known !== undefined) return known
  const found = new Map<string, MarkupElement>()
  for (const mark of elements) {
    if (mark.kind !== "p:cNvPr" || mark.id === null || found.has(mark.id)) continue
    const owner = shapeOwner(elements, mark)
    if (owner !== undefined) found.set(mark.id, owner)
  }
  shapesByElements.set(elements, found)
  return found
}

export function shapeById(elements: readonly MarkupElement[], id: string): MarkupElement {
  if (elements.length < indexedShapeThreshold) {
    for (const mark of elements) {
      if (mark.kind !== "p:cNvPr" || mark.id !== id) continue
      const owner = shapeOwner(elements, mark)
      if (owner !== undefined) return owner
    }
    throw new Error("shape")
  }
  const found = shapeIndex(elements).get(id)
  if (found === undefined) throw new Error("shape")
  return found
}

export function owns(elements: readonly MarkupElement[], index: number, shape: MarkupElement): boolean {
  let parent = elements[index]?.parent ?? -1
  while (parent >= 0) {
    const ancestor = elements[parent]
    if (ancestor === undefined) return false
    if (isShapeTag(ancestor.kind)) return ancestor.index === shape.index
    parent = ancestor.parent
  }
  return false
}
