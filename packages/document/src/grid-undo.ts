import { gridCommandVersion, gridGroups, foldGrid, orderedSpots, type GridUndoable } from "./grid-order.js"
import type { Register } from "./decide.js"
import type { SlideId } from "./element-id.js"
import type { SlideCommand } from "./slide-order.js"

export function gridUndoable(
  before: Register,
  after: Register,
  file: readonly SlideId[],
  edit: SlideCommand,
): GridUndoable {
  const grid = edit.grid ?? gridCommandVersion(before)
  const left = foldGrid({ ...before, file }, grid)
  const right = foldGrid({ ...after, file }, grid)
  const leftSpots = new Map(left.spots.map((spot) => [spot.id, spot]))
  const rightSpots = new Map(right.spots.map((spot) => [spot.id, spot]))
  const leftHeads = new Set(left.grid.starts)
  const rightHeads = new Set(right.grid.starts)
  const affected = new Set<SlideId>()
  if ("id" in edit) affected.add(edit.id)
  if (edit.slide === "move-many" || edit.slide === "remove-many") for (const id of edit.ids) affected.add(id)
  if (edit.slide === "clone-many") for (const copy of edit.copies) affected.add(copy.id)
  if (edit.slide === "grid-turn") {
    for (const step of edit.turn.spots) affected.add(step.id)
    for (const step of edit.turn.heads) affected.add(step.id)
  }
  for (const id of new Set([...leftHeads, ...rightHeads])) {
    if (leftHeads.has(id) !== rightHeads.has(id)) affected.add(id)
  }
  const guards = new Set(affected)
  for (const folded of [left, right]) {
    const sequence = orderedSpots(folded.spots)
    for (const id of affected) {
      const at = sequence.findIndex((spot) => spot.id === id)
      if (at < 0) continue
      for (const spot of [sequence[at - 1], sequence[at + 1]]) {
        if (spot !== undefined) guards.add(spot.id)
      }
    }
  }
  const spots = [...guards].flatMap((id) => {
    const from = leftSpots.get(id),
      to = rightSpots.get(id)
    if (to === undefined) return []
    return [
      {
        id,
        before: { present: from?.present ?? false, key: from?.key ?? to.key },
        after: { present: to.present, key: to.key },
      },
    ]
  })
  const heads = [...guards].map((id) => ({ id, before: leftHeads.has(id), after: rightHeads.has(id) }))
  const groups = (register: Register) =>
    gridGroups({ ...register, file }, grid)
      .filter((group) => edit.slide === "move-many" && edit.row === "keep" && group.some((id) => edit.ids.includes(id)))
      .map((group) => ({ head: group[0], slides: group }))
  return { file, grid, spots, heads, groupsBefore: groups(before), groupsAfter: groups(after) }
}
