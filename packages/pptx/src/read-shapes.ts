import type { TextValue } from "@airdesign/document"
import { markupDocument, type MarkupElement } from "./element-span.js"
import type { ShapeBox } from "./shape-write.js"
import { markupChildren, shapeTextValue } from "./text-value-route.js"

export type ShapeKind = "p:sp" | "p:pic" | "p:graphicFrame" | "p:cxnSp" | "p:grpSp"

export type ReadShape = {
  readonly slide: string
  readonly part: string
  readonly shape: string
  readonly kind: ShapeKind
  readonly box: ShapeBox | null
  readonly text: TextValue
  readonly locked: boolean
}

const kinds = new Set<string>(["p:sp", "p:pic", "p:graphicFrame", "p:cxnSp", "p:grpSp"])
const slidePart = /^ppt\/slides\/[^/]+\.xml$/
const presentationPart = "ppt/presentation.xml"
const presentationRels = "ppt/_rels/presentation.xml.rels"
const fallbackKind = "mc:Fallback"

const owns = (elements: readonly MarkupElement[], index: number, shape: MarkupElement): boolean => {
  let parent = elements[index]?.parent ?? -1
  while (parent >= 0) {
    const ancestor = elements[parent]
    if (ancestor === undefined) return false
    if (kinds.has(ancestor.kind)) return ancestor.index === shape.index
    parent = ancestor.parent
  }
  return false
}

const inFallback = (elements: readonly MarkupElement[], index: number): boolean => {
  let parent = elements[index]?.parent ?? -1
  while (parent >= 0) {
    const ancestor = elements[parent]
    if (ancestor === undefined) return false
    if (ancestor.kind === fallbackKind) return true
    parent = ancestor.parent
  }
  return false
}

const attr = (element: MarkupElement, name: string): string | null => {
  for (const item of element.attributes) if (item.name === name) return item.value
  return null
}

const emu = (value: string | null): number | null => {
  if (value === null) return null
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

const slidePartName = (target: string): string => {
  if (target.startsWith("/")) return target.slice(1)
  if (target.startsWith("ppt/")) return target
  return `ppt/${target}`
}

const slideByPart = (parts: ReadonlyMap<string, Uint8Array>): ReadonlyMap<string, string> => {
  const presentation = parts.get(presentationPart)
  const rels = parts.get(presentationRels)
  const slides = new Map<string, string>()
  if (presentation === undefined || rels === undefined) return slides
  const relationships = markupDocument(rels).elements
  for (const element of markupDocument(presentation).elements) {
    if (element.kind !== "p:sldId" || element.id === null) continue
    const rid = attr(element, "r:id")
    if (rid === null) continue
    let relationship: MarkupElement | undefined
    for (const item of relationships) {
      if (item.kind === "Relationship" && attr(item, "Id") === rid) {
        relationship = item
        break
      }
    }
    if (relationship === undefined) continue
    const type = attr(relationship, "Type")
    const target = attr(relationship, "Target")
    if (type === null || target === null || !type.endsWith("/slide")) continue
    slides.set(slidePartName(target), element.id)
  }
  return slides
}

export function readShapes(parts: ReadonlyMap<string, Uint8Array>): readonly ReadShape[] {
  const slides = slideByPart(parts)
  const rows: ReadShape[] = []
  for (const [part, bytes] of parts) {
    if (!slidePart.test(part)) continue
    const slide = slides.get(part)
    if (slide === undefined) continue
    const { elements } = markupDocument(bytes)
    const children = markupChildren(elements)
    const fallbackIds = new Set<string>()
    const kept: ReadShape[] = []
    for (const shape of elements) {
      if (!kinds.has(shape.kind)) continue
      let id: string | null = null
      let off: MarkupElement | null = null
      let ext: MarkupElement | null = null
      for (const element of elements) {
        if (!owns(elements, element.index, shape)) continue
        if (id === null && element.kind === "p:cNvPr") id = element.id
        if (off === null && element.kind === "a:off") off = element
        if (ext === null && element.kind === "a:ext" && attr(element, "cx") !== null) ext = element
      }
      if (id === null) continue
      if (inFallback(elements, shape.index)) {
        fallbackIds.add(id)
        continue
      }
      const x = emu(off === null ? null : attr(off, "x"))
      const y = emu(off === null ? null : attr(off, "y"))
      const cx = emu(ext === null ? null : attr(ext, "cx"))
      const cy = emu(ext === null ? null : attr(ext, "cy"))
      kept.push({
        slide,
        part,
        shape: id,
        kind: shape.kind as ShapeKind,
        box: x === null || y === null || cx === null || cy === null ? null : { x, y, cx, cy },
        text: shapeTextValue(children, bytes, shape),
        locked: false,
      })
    }
    for (const row of kept) rows.push(fallbackIds.has(row.shape) ? { ...row, locked: true } : row)
  }
  return rows
}
