import { wrapRotation } from "./angle.js"
import type { Doom, Write } from "./doom.js"
import type { End } from "./geometry.js"
import type { NodeId } from "./ids.js"
import { type Matrix, apply, boxMatrix, identity, invert, multiply } from "./matrix.js"
import type { Box } from "./resolved.js"

type Landing = { readonly parent?: NodeId | null; readonly box?: Box }
export type Landings = ReadonlyMap<NodeId, Landing>

type Held = { readonly parent?: { readonly id: NodeId } | null; readonly box?: Box; readonly geometry?: unknown }

const heldBy = (now: Doom, node: NodeId) => now.nodes.get(node) as Held | undefined

function parentOf(now: Doom, landings: Landings, node: NodeId): NodeId | null {
  const landed = landings.get(node)?.parent
  return landed !== undefined ? landed : (heldBy(now, node)?.parent?.id ?? null)
}

export function worldMatrix(now: Doom, node: NodeId | null, landings: Landings = new Map()): Matrix {
  const chain: NodeId[] = []
  for (let at = node, hops = 0; at !== null && hops <= now.nodes.size; hops += 1) {
    chain.unshift(at)
    at = parentOf(now, landings, at)
  }
  return chain.reduce((matrix, id) => {
    const box = landings.get(id)?.box ?? heldBy(now, id)?.box
    return box === undefined ? matrix : boxMatrix(matrix, box)
  }, identity)
}

export function landingsOf(writes: readonly Write[]): Landings {
  const landings = new Map<NodeId, Landing>()
  for (const { node, prop, value } of writes) {
    if (prop === "parent")
      landings.set(node, { ...landings.get(node), parent: (value as { id: NodeId } | null)?.id ?? null })
    if (prop === "box") landings.set(node, { ...landings.get(node), box: value as Box })
  }
  return landings
}

export function replanted(now: Doom, node: NodeId, into: NodeId, landings: Landings): Write | undefined {
  const here = heldBy(now, node)
  if (here?.parent == null) return undefined
  const across = multiply(invert(worldMatrix(now, into, landings)), worldMatrix(now, here.parent.id))
  const line = here.geometry as { kind?: string; start: End; end: End } | undefined
  if (line?.kind === "line") {
    const carry = (end: End): End => {
      if ("node" in end) return end
      const spot = apply(across, end)
      return { x: Math.round(spot.x), y: Math.round(spot.y) }
    }
    return { node, prop: "geometry", value: { ...line, start: carry(line.start), end: carry(line.end) } } as Write
  }
  const { box } = here
  if (box === undefined) return undefined
  const centre = apply(across, { x: box.x + box.w / 2, y: box.y + box.h / 2 })
  return {
    node,
    prop: "box",
    value: {
      ...box,
      x: Math.round(centre.x - box.w / 2),
      y: Math.round(centre.y - box.h / 2),
      rotation: wrapRotation(box.rotation + (Math.atan2(across[1], across[0]) * 180) / Math.PI),
    },
  }
}
