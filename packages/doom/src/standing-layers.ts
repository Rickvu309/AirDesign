import type { Doom, Write } from "./doom.js"
import type { NodeId, Rev } from "./ids.js"

const parentIn = (doom: Doom, node: NodeId) =>
  (doom.nodes.get(node) as { parent?: { readonly id: NodeId } | null } | undefined)?.parent

const movesIn = (writes: readonly Write[]) =>
  new Map(
    writes.flatMap((each) =>
      each.prop === "parent" && each.value !== null ? [[each.node, (each.value as { readonly id: NodeId }).id]] : [],
    ),
  )

function landingMoves(now: Doom, moves: ReadonlyMap<NodeId, NodeId>): ReadonlySet<NodeId> {
  const lands = new Set<NodeId>()
  const stays = new Set<NodeId>()
  const judge = (node: NodeId, into: NodeId): boolean | undefined => {
    let at = into
    for (let hops = 0; hops <= now.nodes.size; hops += 1) {
      if (at === node) return false
      if (moves.has(at) && !lands.has(at) && !stays.has(at)) return undefined
      const parent = lands.has(at) ? { id: moves.get(at)! } : parentIn(now, at)
      if (parent === null) return false
      if (parent === undefined) return true
      at = parent.id
    }
    return false
  }
  let open = [...moves.keys()]
  while (open.length > 0) {
    const waiting = open.filter((node) => {
      const landed = judge(node, moves.get(node)!)
      if (landed === true) lands.add(node)
      if (landed === false) stays.add(node)
      return landed === undefined
    })
    if (waiting.length === open.length) break
    open = waiting
  }
  return lands
}

function heldFrames(
  now: Doom,
  writes: readonly Write[],
  moves: ReadonlyMap<NodeId, NodeId>,
  lands: ReadonlySet<NodeId>,
  since: Rev,
): ReadonlySet<NodeId> {
  const written = new Set(writes.flatMap((each) => (each.prop === "parent" ? [each.node] : [])))
  const staying = [
    ...[...moves.keys()].filter((node) => !lands.has(node)),
    ...[...now.nodes.keys()].filter((node) => !written.has(node) && (now.revs.get(node)?.get("parent") ?? 0) > since),
  ]
  const held = new Set<NodeId>()
  for (const node of staying) {
    let at = parentIn(now, node)
    for (let hops = 0; at != null && hops <= now.nodes.size; hops += 1) {
      held.add(at.id)
      at = lands.has(at.id) ? { id: moves.get(at.id)! } : parentIn(now, at.id)
    }
  }
  return held
}

export function onStandingLayers(now: Doom, writes: readonly Write[], since: Rev): readonly Write[] {
  const moves = movesIn(writes)
  const lands = landingMoves(now, moves)
  const held = heldFrames(now, writes, moves, lands, since)
  return writes.filter((each) =>
    each.prop === "parent"
      ? each.value === null
        ? !held.has(each.node)
        : lands.has(each.node)
      : lands.has(each.node) || (!moves.has(each.node) && parentIn(now, each.node) !== null),
  )
}
