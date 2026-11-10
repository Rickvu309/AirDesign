export type ShapeIdCount = {
  readonly part: string
  readonly id: string
  readonly count: number
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
