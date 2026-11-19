import { layoutNodes, readLayout, type Box, type ElementId, type Register } from "@airdesign/document"

type Laid = { readonly boxes: ReadonlyMap<ElementId, Box>; readonly backdrops: ReadonlySet<ElementId> }

const laid = new WeakMap<Register, Laid>()

function laidOut(register: Register): Laid {
  const kept = laid.get(register)
  if (kept !== undefined) return kept
  const boxes = new Map<ElementId, Box>()
  const backdrops = new Set<ElementId>()
  for (const node of layoutNodes(register)) {
    const view = readLayout(register, node)
    if (view === null) continue
    boxes.set(node, view.box)
    boxes.set(view.backdrop, view.box)
    backdrops.add(view.backdrop)
    for (const child of view.children) boxes.set(child.node, child.box)
  }
  const found = { boxes, backdrops }
  laid.set(register, found)
  return found
}

export function laidBox(register: Register, node: ElementId): Box | undefined {
  return laidOut(register).boxes.get(node)
}

export function backdropsOf(register: Register | null): ReadonlySet<ElementId> {
  return register === null ? new Set() : laidOut(register).backdrops
}
