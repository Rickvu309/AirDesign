import { decodeLatin1 } from "./package-bytes.js"

const shapeTag = /<p:cNvPr(?=[\s>/])(?:[^>"']|"[^"]*"|'[^']*')*\bid="([^"]+)"/g
const shapePart = /^ppt\/(slides|notesSlides|slideLayouts|slideMasters)\/[^/]+\.xml$/
const maxShapeId = 4294967295

export type ShapeIdCount = {
  readonly part: string
  readonly id: string
  readonly count: number
}

function shapeIdsIn(xml: string): readonly string[] {
  shapeTag.lastIndex = 0
  const ids: string[] = []
  for (const match of xml.matchAll(shapeTag)) {
    const id = match[1]
    if (id !== undefined) ids.push(id)
  }
  return ids
}

function numericId(id: string): number | null {
  if (!/^[0-9]+$/.test(id)) return null
  const value = Number(id)
  if (!Number.isSafeInteger(value) || value > maxShapeId) return null
  return value
}

export function shapeIdCounts(parts: ReadonlyMap<string, Uint8Array>): readonly ShapeIdCount[] {
  const rows: ShapeIdCount[] = []
  for (const [name, bytes] of parts) {
    if (!shapePart.test(name)) continue
    const counts = new Map<string, number>()
    for (const id of shapeIdsIn(decodeLatin1(bytes))) counts.set(id, (counts.get(id) ?? 0) + 1)
    for (const [id, count] of counts) rows.push({ part: name, id, count })
  }
  return rows
}

export function nextShapeId(partXml: string): number {
  let max = 0
  for (const id of shapeIdsIn(partXml)) {
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
