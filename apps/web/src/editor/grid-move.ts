export type GridMoveSide = "same" | "before" | "new" | "keep"

export function gridAnchor<Id>(
  sequence: readonly Id[],
  held: ReadonlySet<Id>,
  at: number,
  side: GridMoveSide,
): Id | null {
  if (side === "before") return sequence.slice(at).find((id) => !held.has(id)) ?? null
  return (
    sequence
      .slice(0, at)
      .filter((id) => !held.has(id))
      .at(-1) ?? null
  )
}

export function gridMovePlacement<Id>(
  groups: readonly (readonly Id[])[],
  ids: readonly Id[],
  anchor: Id | null,
  side: GridMoveSide,
): readonly (readonly Id[])[] {
  const held = new Set(ids)
  const moving = groups.flat().filter((id) => held.has(id))
  const next = groups.map((group) => group.filter((id) => !held.has(id))).filter((group) => group.length > 0)
  const number = anchor === null ? -1 : next.findIndex((group) => group.includes(anchor))
  const group = next[number]
  const separate = side === "new" || side === "keep"
  const at = group === undefined || anchor === null ? 0 : group.indexOf(anchor) + (side === "before" ? 0 : 1)
  if (moving.length > 0) {
    if (separate || next.length === 0) next.splice(number + 1, 0, moving)
    else (group ?? next[0])?.splice(at, 0, ...moving)
  }
  return next
}

export function sameGroups<Id>(left: readonly (readonly Id[])[], right: readonly (readonly Id[])[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (group, number) =>
        group.length === right[number]?.length && group.every((id, offset) => id === right[number]?.[offset]),
    )
  )
}
