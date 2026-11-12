import { isShapeTag, type ShapeKind } from "./shape-tree.js"
import type { TextValue } from "@airdesign/document"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { slideAddresses } from "./package-address.js"
import type { ShapeBox } from "./shape-write.js"
import { markupChildren, shapeTextValue } from "./text-value-route.js"
import { tableIn } from "./paint-table.js"

export type ReadShape = {
  readonly slide: string
  readonly part: string
  readonly shape: string
  readonly kind: ShapeKind
  readonly box: ShapeBox | null
  readonly text: TextValue
  readonly locked: boolean
}

const slidePart = /^ppt\/slides\/[^/]+\.xml$/
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
    below[element.index] = isShapeTag(element.kind) ? element.index : shape
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

const slideByPart = (parts: ReadonlyMap<string, Uint8Array>): ReadonlyMap<string, string> => {
  const slides = new Map<string, string>()
  for (const address of slideAddresses(parts)) slides.set(address.part, address.slide)
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
      if (!isShapeTag(shape.kind)) continue
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
        kind: shape.kind,
        box: x === null || y === null || cx === null || cy === null ? null : { x, y, cx, cy },
        text: shapeTextValue(children, bytes, shape),
        locked: tableIn(shape, children) !== undefined,
      })
    }
    for (const row of kept) rows.push(fallbackIds.has(row.shape) ? { ...row, locked: true } : row)
  }
  return rows
}
