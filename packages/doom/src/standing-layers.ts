import { sameValue } from "./changing-writes.js"
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

function shows(now: Doom, node: NodeId): boolean {
  let parent = parentIn(now, node)
  for (let hops = 0; parent != null && hops <= now.nodes.size; hops += 1) parent = parentIn(now, parent.id)
  return parent === undefined
}

function landingMoves(now: Doom, moves: ReadonlyMap<NodeId, NodeId>): ReadonlySet<NodeId> {
  const lands = new Set<NodeId>()
  const stays = new Set<NodeId>()
  const judge = (node: NodeId, into: NodeId): boolean | undefined => {
    const hidden = !shows(now, node)
    let at = into
    for (let hops = 0; hops <= now.nodes.size; hops += 1) {
      if (at === node) return false
      if (moves.has(at) && !lands.has(at) && !stays.has(at)) return undefined
      const parent = lands.has(at) ? { id: moves.get(at)! } : parentIn(now, at)
      if (parent === null) return hidden && (at !== into || parentIn(now, node) === null)
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

const measuredInFrame = { box: ["x", "y", "rotation", "flipH", "flipV"], geometry: ["start", "end"] } as const
const placedInFrame = { box: ["x", "y", "rotation"], geometry: ["start", "end"] } as const

function leftInPlace(
  now: Doom,
  write: Write,
  measured: typeof measuredInFrame | typeof placedInFrame,
): Write | undefined {
  if (write.prop !== "box" && write.prop !== "geometry") return write
  const here = (now.nodes.get(write.node) as Record<string, unknown> | undefined)?.[write.prop] as
    | Record<string, unknown>
    | undefined
  const was = write.value as Record<string, unknown> | null
  if (here === undefined || was === null) return undefined
  if (write.prop === "geometry" && (here.kind !== "line" || was.kind !== "line")) return write
  const value = { ...was, ...Object.fromEntries(measured[write.prop].map((key) => [key, here[key]])) }
  return sameValue(value, here) ? undefined : { ...write, value }
}

type MeasuredIn = ReadonlyMap<NodeId, NodeId | null>

function strayedFrom(now: Doom, node: NodeId, measuredIn: MeasuredIn, since: Rev): boolean {
  const here = parentIn(now, node)?.id ?? null
  if (measuredIn.has(node)) return measuredIn.get(node) !== here
  return (now.revs.get(node)?.get("parent") ?? 0) > since
}

export function onStandingLayers(
  now: Doom,
  writes: readonly Write[],
  since: Rev,
  measuredIn: MeasuredIn,
): readonly Write[] {
  const moves = movesIn(writes)
  const wroteParent = new Set(writes.flatMap((each) => (each.prop === "parent" ? [each.node] : [])))
  const lands = landingMoves(now, moves)
  const held = heldFrames(now, writes, moves, lands, since)
  return writes.flatMap((each) => {
    if (each.prop === "parent") return (each.value === null ? !held.has(each.node) : lands.has(each.node)) ? [each] : []
    if (lands.has(each.node)) return [each]
    if (parentIn(now, each.node) === null) return []
    if (moves.has(each.node)) return leftInPlace(now, each, measuredInFrame) ?? []
    if (!wroteParent.has(each.node) && strayedFrom(now, each.node, measuredIn, since))
      return leftInPlace(now, each, placedInFrame) ?? []
    return [each]
  })
}
