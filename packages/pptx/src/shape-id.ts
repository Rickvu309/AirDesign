import { markupDocument, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"

export const shapePart = /^ppt\/(slides|notesSlides|slideLayouts|slideMasters)\/[^/]+\.xml$/
const maxShapeId = 4294967295
const animationKinds = new Set(["p:spTgt", "p:inkTgt", "p:bldP", "p:bldDgm", "p:bldOleChart", "p:bldGraphic"])
const connectionKinds = new Set(["a:stCxn", "a:endCxn"])

export type ShapeIdCount = {
  readonly part: string
  readonly id: string
  readonly count: number
}

export type ShapeReference = {
  readonly part: string
  readonly kind: string
  readonly id: string
}

function shapeIdsIn(bytes: Uint8Array): readonly string[] {
  const ids: string[] = []
  for (const element of markupDocument(bytes).elements) {
    if (element.kind !== "p:cNvPr" || element.id === null) continue
    ids.push(element.id)
  }
  return ids
}

function numericId(id: string): number | null {
  if (id.length === 0) return null
  for (const char of id) {
    const code = char.codePointAt(0)
    if (code === undefined || code < 48 || code > 57) return null
  }
  const value = Number(id)
  if (!Number.isSafeInteger(value) || value > maxShapeId) return null
  return value
}

export function shapeIdCounts(parts: ReadonlyMap<string, Uint8Array>): readonly ShapeIdCount[] {
  const rows: ShapeIdCount[] = []
  for (const [name, bytes] of parts) {
    if (!shapePart.test(name)) continue
    const counts = new Map<string, number>()
    for (const id of shapeIdsIn(bytes)) counts.set(id, (counts.get(id) ?? 0) + 1)
    for (const [id, count] of counts) rows.push({ part: name, id, count })
  }
  return rows
}

export function nextShapeId(partXml: string): number {
  let max = 0
  for (const id of shapeIdsIn(encodeUtf8(partXml))) {
    const value = numericId(id)
    if (value !== null && value > max) max = value
  }
  if (max === maxShapeId) throw new Error("shape id")
  return max + 1
}

export function newDuplicateShapeIds(
  original: readonly ShapeIdCount[],
  edited: readonly ShapeIdCount[],
): readonly { readonly part: string; readonly id: string }[] {
  const already = new Set(original.filter((row) => row.count > 1).map((row) => `${row.part}\0${row.id}`))
  const found: { part: string; id: string }[] = []
  for (const row of edited) {
    if (row.count <= 1) continue
    if (already.has(`${row.part}\0${row.id}`)) continue
    found.push({ part: row.part, id: row.id })
  }
  return found
}

function animationId(element: MarkupElement): string | null {
  if (!animationKinds.has(element.kind)) return null
  return element.attributes.find((item) => item.name === "spid")?.value ?? null
}

function connectionId(element: MarkupElement): string | null {
  return connectionKinds.has(element.kind) ? element.id : null
}

function inside(element: MarkupElement, shape: MarkupElement): boolean {
  return element.start >= shape.start && element.end <= shape.end
}

function idsWithin(elements: readonly MarkupElement[], shape: MarkupElement): ReadonlySet<string | null> {
  return new Set(elements.filter((item) => item.kind === "p:cNvPr" && inside(item, shape)).map((item) => item.id))
}

export function shapeAnimated(elements: readonly MarkupElement[], shape: MarkupElement): boolean {
  const ids = idsWithin(elements, shape)
  return elements.some((element) => {
    const id = animationId(element)
    return id !== null && ids.has(id)
  })
}

export function attachedConnections(
  elements: readonly MarkupElement[],
  shape: MarkupElement,
): readonly MarkupElement[] {
  const ids = idsWithin(elements, shape)
  return elements.filter((element) => {
    const id = connectionId(element)
    return id !== null && ids.has(id) && !inside(element, shape)
  })
}

export function danglingShapeReferences(parts: ReadonlyMap<string, Uint8Array>): readonly ShapeReference[] {
  const rows: ShapeReference[] = []
  for (const [name, bytes] of parts) {
    if (!shapePart.test(name)) continue
    const ids = new Set(shapeIdsIn(bytes))
    for (const element of markupDocument(bytes).elements) {
      const id = animationId(element) ?? connectionId(element)
      if (id !== null && !ids.has(id)) rows.push({ part: name, kind: element.kind, id })
    }
  }
  return rows
}

export function newDanglingShapeReferences(
  original: readonly ShapeReference[],
  edited: readonly ShapeReference[],
): readonly ShapeReference[] {
  const already = new Set(original.map((row) => `${row.part}\0${row.kind}\0${row.id}`))
  return edited.filter((row) => !already.has(`${row.part}\0${row.kind}\0${row.id}`))
}
