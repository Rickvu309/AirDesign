import type { Doom, Node, Write } from "./doom.js"
import { onDeck, parentOf, propOf, zeroBox } from "./doom-walk.js"
import type { End, Geometry } from "./geometry.js"
import type { NodeId } from "./ids.js"
import { lineRoute } from "./line-ends.js"
import { refuse, type Refusal } from "./refusal.js"
import type { Box } from "./resolved.js"

type Nodes = ReadonlyMap<NodeId, Node>
type Line = Extract<Geometry, { kind: "line" }>

export type LostEnds = {
  readonly line: NodeId
  readonly start: NodeId | null
  readonly end: NodeId | null
}

export const leavingRoots = (before: Nodes, after: Nodes, writes: readonly Write[]): ReadonlySet<NodeId> =>
  new Set(
    writes.flatMap((write) =>
      write.prop === "parent" && onDeck(before, write.node) && !onDeck(after, write.node) ? [write.node] : [],
    ),
  )

function under(nodes: Nodes, roots: ReadonlySet<NodeId>): (id: NodeId) => boolean {
  const known = new Map<NodeId, boolean>()
  const walk = (id: NodeId, hops: number): boolean => {
    const seen = known.get(id)
    if (seen !== undefined) return seen
    const node = nodes.get(id)
    const parent = node === undefined || node.type === "deck" ? undefined : parentOf(node)
    const found = roots.has(id) || (parent != null && hops <= nodes.size && walk(parent.id, hops + 1))
    known.set(id, found)
    return found
  }
  return (id) => walk(id, 0)
}

export const returningRoots = (before: Nodes, after: Nodes, writes: readonly Write[]): ReadonlySet<NodeId> =>
  new Set(
    writes.flatMap((write) =>
      write.prop === "parent" && before.has(write.node) && !onDeck(before, write.node) && onDeck(after, write.node)
        ? [write.node]
        : [],
    ),
  )

export function linesBack(before: Nodes, after: Nodes, writes: readonly Write[]): readonly NodeId[] {
  const roots = returningRoots(before, after, writes)
  if (roots.size === 0) return []
  const returning = under(after, roots)
  const back: NodeId[] = []
  for (const node of after.values())
    if (propOf(node, "geometry")?.kind === "line" && returning(node.id)) back.push(node.id)
  return back
}

export function lostEnds(before: Nodes, after: Nodes, writes: readonly Write[]): readonly LostEnds[] {
  const roots = leavingRoots(before, after, writes)
  if (roots.size === 0) return []
  const left = under(before, roots)
  const leaving = (id: NodeId) => !onDeck(after, id) && left(id)
  const lost: LostEnds[] = []
  for (const line of after.values()) {
    const now = propOf(line, "geometry")
    if (now?.kind !== "line") continue
    const was = propOf(before.get(line.id), "geometry")
    if (was?.kind !== "line") continue
    const gone = (before: End, after: End) =>
      "node" in after && "node" in before && after.node === before.node && leaving(after.node) ? after.node : null
    const start = gone(was.start, now.start)
    const end = gone(was.end, now.end)
    if (start === null && end === null) continue
    if (onDeck(before, line.id) && onDeck(after, line.id)) lost.push({ line: line.id, start, end })
  }
  return lost
}

const deadIn = (nodes: Nodes, end: End): end is Extract<End, { node: NodeId }> =>
  "node" in end && !onDeck(nodes, end.node)

export function deadLines(before: Nodes, after: Nodes, writes: readonly Write[]): readonly NodeId[] {
  const drawn = writes.flatMap((write) => (write.prop === "parent" || write.prop === "geometry" ? [write.node] : []))
  const lost = lostEnds(before, after, writes).map((each) => each.line)
  return [...new Set([...drawn, ...linesBack(before, after, writes), ...lost])].filter((id) => {
    const line = propOf(after.get(id), "geometry")
    return line?.kind === "line" && onDeck(after, id) && (deadIn(after, line.start) || deadIn(after, line.end))
  })
}

function storedBoxes(nodes: Nodes, ids: readonly (NodeId | undefined)[]): ReadonlyMap<NodeId, Box> {
  const boxes = new Map<NodeId, Box>()
  for (const id of ids) {
    let at = id === undefined ? undefined : nodes.get(id)
    for (let hops = 0; at !== undefined && at.type !== "slide" && hops <= nodes.size; hops += 1) {
      boxes.set(at.id, propOf(at, "box") ?? zeroBox)
      const parent = parentOf(at)
      at = parent == null ? undefined : nodes.get(parent.id)
    }
  }
  return boxes
}

export function freedInFold(before: Doom, after: Doom, writes: readonly Write[]): ReadonlyMap<NodeId, Line> | Refusal {
  const freed = new Map<NodeId, Line>()
  for (const id of deadLines(before.nodes, after.nodes, writes)) {
    const line = propOf(after.nodes.get(id), "geometry") as Line
    const dead = [line.start, line.end].flatMap((end) => (deadIn(after.nodes, end) ? [end.node] : []))
    if (dead.some((shape) => !after.nodes.has(shape))) return refuse("missing", id, "geometry")
    const parent = parentOf(after.nodes.get(id))?.id
    const stays = onDeck(before.nodes, id) && parentOf(before.nodes.get(id))?.id === parent
    const from = stays ? before : after
    const route = lineRoute(from, storedBoxes(from.nodes, [parent, ...dead]), parent, line)
    freed.set(id, {
      ...line,
      start: deadIn(after.nodes, line.start) ? route.from : line.start,
      end: deadIn(after.nodes, line.end) ? route.to : line.end,
    })
  }
  return freed
}
