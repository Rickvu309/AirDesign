import { layoutNodes, readLayout, type Box, type ElementId, type Register } from "@airdesign/document"
import type { Framing } from "@airdesign/render"

export type Framed = {
  readonly boxes: ReadonlyMap<ElementId, Box>
  readonly origins: ReadonlyMap<ElementId, Box>
  readonly backdrops: ReadonlySet<ElementId>
  readonly frames: ReadonlyMap<ElementId, Framing>
  readonly key: string
}

const none: Framed = { boxes: new Map(), origins: new Map(), backdrops: new Set(), frames: new Map(), key: "" }

const laid = new WeakMap<Register, Framed>()

function laidOut(register: Register): Framed {
  const kept = laid.get(register)
  if (kept !== undefined) return kept
  const boxes = new Map<ElementId, Box>()
  const origins = new Map<ElementId, Box>()
  const backdrops = new Set<ElementId>()
  const frames = new Map<ElementId, Framing>()
  for (const node of layoutNodes(register)) {
    const view = readLayout(register, node)
    if (view === null) continue
    const frame = view.flow === "none" ? "free" : "auto"
    frames.set(node, frame)
    boxes.set(node, view.box)
    boxes.set(view.backdrop, view.box)
    backdrops.add(view.backdrop)
    for (const child of view.children) {
      boxes.set(child.node, child.box)
      if (frame === "free") origins.set(child.node, view.box)
    }
  }
  const key = JSON.stringify([...frames])
  const found = { boxes, origins, backdrops, frames, key }
  laid.set(register, found)
  return found
}

export function framedOf(register: Register | null): Framed {
  return register === null ? none : laidOut(register)
}

export function laidBox(register: Register, node: ElementId): Box | undefined {
  return laidOut(register).boxes.get(node)
}

export function storedBox(register: Register | null, node: ElementId, box: Box): Box {
  const origin = register === null ? undefined : laidOut(register).origins.get(node)
  return origin === undefined ? box : { ...box, x: box.x - origin.x, y: box.y - origin.y }
}
