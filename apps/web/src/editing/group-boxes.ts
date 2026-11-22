import {
  floorNodes,
  followsGroups,
  groupedNow,
  placeOf,
  shownPlace,
  storedPlace,
  type Box,
  type ElementId,
  type Register,
} from "@airdesign/document"

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

export function storedGroupBox(register: Register | null, node: ElementId, box: Box): Box | undefined {
  if (register === null || !followsGroups(register, node)) return undefined
  const shown = shownPlace(register, node)
  return (shown === null ? null : storedPlace(register, node, { ...shown, box }))?.box
}

export function storedGroupBoxNow(register: Register | null, node: ElementId): Box | undefined {
  if (register === null || !followsGroups(register, node)) return undefined
  return placeOf(register, node)?.box
}
