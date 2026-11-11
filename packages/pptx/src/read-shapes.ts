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

const attr = (element: MarkupElement, name: string): string | null => {
  for (const item of element.attributes) if (item.name === name) return item.value
  return null
}

type ShapeParts = {
  id: string | null
  off: MarkupElement | null
  ext: MarkupElement | null
}

type SlideShapes = {
  readonly parts: ReadonlyMap<number, ShapeParts>
  readonly fallback: Uint8Array
}

const slideShapes = (elements: readonly MarkupElement[]): SlideShapes => {
  const below = new Int32Array(elements.length).fill(-1)
  const hidden = new Uint8Array(elements.length)
  const fallback = new Uint8Array(elements.length)
  const parts = new Map<number, ShapeParts>()
  for (const element of elements) {
    const parent = element.parent
    const shape = parent >= 0 ? (below[parent] ?? -1) : -1
    const covered = parent >= 0 ? (hidden[parent] ?? 0) : 0
    fallback[element.index] = covered
    below[element.index] = kinds.has(element.kind) ? element.index : shape
    hidden[element.index] = element.kind === fallbackKind ? 1 : covered
    if (shape < 0) continue
    let found = parts.get(shape)
    if (found === undefined) {
      found = { id: null, off: null, ext: null }
      parts.set(shape, found)
    }
    if (found.id === null && element.kind === "p:cNvPr") found.id = element.id
    if (found.off === null && element.kind === "a:off") found.off = element
    if (found.ext === null && element.kind === "a:ext" && attr(element, "cx") !== null) found.ext = element
  }
  return { parts, fallback }
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
  const relationships = new Map<string, MarkupElement>()
  for (const item of markupDocument(rels).elements) {
    if (item.kind !== "Relationship") continue
    const id = attr(item, "Id")
    if (id !== null && !relationships.has(id)) relationships.set(id, item)
  }
  for (const element of markupDocument(presentation).elements) {
    if (element.kind !== "p:sldId" || element.id === null) continue
    const rid = attr(element, "r:id")
    if (rid === null) continue
    const relationship = relationships.get(rid)
    if (relationship === undefined) continue
    const type = attr(relationship, "Type")
    const target = attr(relationship, "Target")
    if (type === null || target === null || !type.endsWith("/slide")) continue
    slides.set(slidePartName(target), element.id)
  }
  return slides
}

export type ReadSlide = { readonly slide: string; readonly part: string }

export function readSlides(parts: ReadonlyMap<string, Uint8Array>): readonly ReadSlide[] {
  return [...slideByPart(parts)].map(([part, slide]) => ({ slide, part }))
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
    const { parts: found, fallback } = slideShapes(elements)
    for (const shape of elements) {
      if (!kinds.has(shape.kind)) continue
      const { id = null, off = null, ext = null } = found.get(shape.index) ?? {}
      if (id === null) continue
      if (fallback[shape.index] === 1) {
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
