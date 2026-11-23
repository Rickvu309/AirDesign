import { floorNodes, followsGroups, groupedNow, shownPlace, type ElementId, type Register } from "@airdesign/document"

const movable = new WeakMap<Register, ReadonlySet<ElementId>>()

export function movableInGroups(register: Register | null): ReadonlySet<ElementId> {
  if (register === null) return new Set()
  const kept = movable.get(register)
  if (kept !== undefined) return kept
  const nodes = [...(register.index?.elements.map((element) => element.node) ?? []), ...floorNodes(register)]
  const found = new Set(
    nodes.filter(
      (node) => groupedNow(register, node) && followsGroups(register, node) && shownPlace(register, node) !== null,
    ),
  )
  movable.set(register, found)
  return found
}
