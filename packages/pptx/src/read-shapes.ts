import { standRecords } from "./stand-read.js"
import { isShapeTag, paintKind, type ShapeKind } from "./shape-tree.js"
import type { Kind, TextValue } from "@airdesign/document"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { slideAddresses } from "./package-address.js"
import type { ShapeBox } from "./shape-write.js"
import { shownRunLink, type RelationshipsRead } from "./trait-xml-link.js"
import { markupChildren, shapeHasText, shapeTextValue } from "./text-value-route.js"
import { tableIn } from "./paint-table.js"

export type ReadShape = {
  readonly slide: string
  readonly part: string
  readonly shape: string
  readonly kind: ShapeKind
  readonly box: ShapeBox | null
  readonly text: TextValue
  readonly locked: boolean
  readonly grouped?: true
  readonly group?: string
  readonly frame?: ShapeBox
  readonly contentKind?: Kind
}

export type ShapeFact = {
  readonly slide: string
  readonly part: string
  readonly shape: string
  readonly kind: ShapeKind
  readonly hasText: boolean
  readonly locked: boolean
  readonly grouped?: true
  readonly contentKind?: Kind
}

export function shapeKind(shape: Pick<ReadShape, "contentKind" | "locked" | "kind">): Kind {
  return shape.contentKind ?? (shape.locked ? "kept" : paintKind(shape.kind))
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
  childOff: MarkupElement | null
  childExt: MarkupElement | null
  above: number
  contentKind: Kind | null
}

type SlideShapes = {
  readonly parts: ReadonlyMap<number, ShapeParts>
  readonly fallback: Uint8Array
  readonly grouped: Uint8Array
}

const emptyParts = (): ShapeParts => ({
  id: null,
  off: null,
  ext: null,
  childOff: null,
  childExt: null,
  above: -1,
  contentKind: null,
})

const boxOf = (off: MarkupElement | null, ext: MarkupElement | null): ShapeBox | null => {
  const x = emu(off === null ? null : attr(off, "x"))
  const y = emu(off === null ? null : attr(off, "y"))
  const cx = emu(ext === null ? null : attr(ext, "cx"))
  const cy = emu(ext === null ? null : attr(ext, "cy"))
  return x === null || y === null || cx === null || cy === null ? null : { x, y, cx, cy }
}

const slideShapes = (elements: readonly MarkupElement[]): SlideShapes => {
  const below = new Int32Array(elements.length).fill(-1)
  const hidden = new Uint8Array(elements.length)
  const fallback = new Uint8Array(elements.length)
  const grouped = new Uint8Array(elements.length)
  const parts = new Map<number, ShapeParts>()
  for (const element of elements) {
    const parent = element.parent
    const shape = parent >= 0 ? (below[parent] ?? -1) : -1
    const covered = parent >= 0 ? (hidden[parent] ?? 0) : 0
    grouped[element.index] = parent >= 0 ? (grouped[parent] === 1 || elements[parent]?.kind === "p:grpSp" ? 1 : 0) : 0
    fallback[element.index] = covered
    below[element.index] = isShapeTag(element.kind) ? element.index : shape
    hidden[element.index] = element.kind === fallbackKind ? 1 : covered
    if (isShapeTag(element.kind) && shape >= 0 && elements[shape]?.kind === "p:grpSp") {
      parts.set(element.index, { ...emptyParts(), above: shape })
    }
    if (shape < 0) continue
    let found = parts.get(shape)
    if (found === undefined) {
      found = emptyParts()
      parts.set(shape, found)
    }
    if (found.id === null && element.kind === "p:cNvPr") found.id = element.id
    if (found.off === null && element.kind === "a:off") found.off = element
    if (found.ext === null && element.kind === "a:ext" && attr(element, "cx") !== null) found.ext = element
    if (found.childOff === null && element.kind === "a:chOff") found.childOff = element
    if (found.childExt === null && element.kind === "a:chExt") found.childExt = element
    if (element.kind === "a:tbl") found.contentKind = "table"
    if (element.kind === "c:chart") found.contentKind = "chart"
  }
  return { parts, fallback, grouped }
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
  const relationships: RelationshipsRead = new Map()
  for (const [part, bytes] of parts) {
    if (!slidePart.test(part)) continue
    const slide = slides.get(part)
    if (slide === undefined) continue
    const { elements } = markupDocument(bytes)
    const children = markupChildren(elements)
    const stands = standRecords(elements, children)
    const hidden = new Set<string>()
    const parentOf = new Map<string, string | null>()
    for (const record of stands) {
      if (!record.matched) continue
      hidden.add(record.group)
      hidden.add(record.picture)
      parentOf.set(record.shape, record.parent)
    }
    const fallbackIds = new Set<string>()
    const kept: ReadShape[] = []
    const { parts: found, fallback, grouped } = slideShapes(elements)
    for (const shape of elements) {
      if (!isShapeTag(shape.kind)) continue
      const held = found.get(shape.index) ?? emptyParts()
      const { id, contentKind } = held
      if (id === null || hidden.has(id)) continue
      if (fallback[shape.index] === 1) {
        fallbackIds.add(id)
        continue
      }
      const stood = parentOf.get(id)
      const group = stood !== undefined ? stood : held.above < 0 ? null : (found.get(held.above)?.id ?? null)
      const frame = shape.kind === "p:grpSp" ? boxOf(held.childOff, held.childExt) : null
      kept.push({
        slide,
        part,
        shape: id,
        kind: shape.kind,
        box: boxOf(held.off, held.ext),
        text: shapeTextValue(children, bytes, shape).map((paragraph, i) => ({
          ...paragraph,
          runs: paragraph.runs.map((run, j) => {
            const link = shownRunLink(parts, part, bytes, children, shape, i, j, relationships)
            return link === null || link.kind === "none" ? run : { ...run, link }
          }),
        })),
        locked: tableIn(shape, children) !== undefined,
        ...(stood !== undefined
          ? stood === null
            ? {}
            : { grouped: true as const }
          : grouped[shape.index] === 1
            ? { grouped: true as const }
            : {}),
        ...(group === null ? {} : { group }),
        ...(frame === null ? {} : { frame }),
        ...(shape.kind === "p:graphicFrame" ? { contentKind: contentKind ?? "kept" } : {}),
      })
    }
    for (const row of kept) rows.push(fallbackIds.has(row.shape) ? { ...row, locked: true } : row)
  }
  return rows
}

export function readShapeFacts(parts: ReadonlyMap<string, Uint8Array>): readonly ShapeFact[] {
  const slides = slideByPart(parts)
  const rows: ShapeFact[] = []
  for (const [part, bytes] of parts) {
    if (!slidePart.test(part)) continue
    const slide = slides.get(part)
    if (slide === undefined) continue
    const { elements } = markupDocument(bytes)
    const children = markupChildren(elements)
    const stands = standRecords(elements, children)
    const hidden = new Set<string>()
    const parentOf = new Map<string, string | null>()
    for (const record of stands) {
      if (!record.matched) continue
      hidden.add(record.group)
      hidden.add(record.picture)
      parentOf.set(record.shape, record.parent)
    }
    const fallbackIds = new Set<string>()
    const kept: ShapeFact[] = []
    const { parts: found, fallback, grouped } = slideShapes(elements)
    for (const shape of elements) {
      if (!isShapeTag(shape.kind)) continue
      const held = found.get(shape.index) ?? emptyParts()
      const { id, contentKind } = held
      if (id === null || hidden.has(id)) continue
      if (fallback[shape.index] === 1) {
        fallbackIds.add(id)
        continue
      }
      const stood = parentOf.get(id)
      kept.push({
        slide,
        part,
        shape: id,
        kind: shape.kind,
        hasText: shapeHasText(children, shape),
        locked: tableIn(shape, children) !== undefined,
        ...(stood !== undefined
          ? stood === null
            ? {}
            : { grouped: true as const }
          : grouped[shape.index] === 1
            ? { grouped: true as const }
            : {}),
        ...(shape.kind === "p:graphicFrame" ? { contentKind: contentKind ?? "kept" } : {}),
      })
    }
    for (const row of kept) rows.push(fallbackIds.has(row.shape) ? { ...row, locked: true } : row)
  }
  return rows
}
