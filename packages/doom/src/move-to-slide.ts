import { wrapRotation } from "./angle.js"
import { linkedOwner } from "./component/instance-ownership.js"
import type { Node, Doom, Write } from "./doom.js"
import { boxOf, childrenOf, deckOf, descendantsOf, isLive, lockedIn, parentOf, propOf } from "./doom-walk.js"
import type { End, Geometry } from "./geometry.js"
import type { NodeId } from "./ids.js"
import { apply, identity } from "./matrix.js"
import { type OrderKey, orderKeyBetween } from "./order-key.js"
import { type Landings, worldMatrix } from "./replant.js"
import { isRefusal, type Refusal } from "./refusal.js"
import type { Box, Point } from "./resolved.js"

type MoveToSlideOptions = {
  readonly boxes?: ReadonlyMap<NodeId, Box>
  readonly after?: NodeId | null
}

const form = (field: string, form: string, node?: NodeId, refused: Refusal["refused"] = "shape"): Refusal => ({
  refused,
  field,
  fault: "form",
  form,
  ...(node === undefined ? {} : { node }),
})

const missing = (node: NodeId, field: string): Refusal => ({ refused: "missing", node, field })

function rootsOf(view: Doom, ids: readonly NodeId[]): readonly Node[] | Refusal {
  if (ids.length === 0) return form("nodes", "Layers to move.")
  const unique = [...new Set(ids)]
  const nodes: Node[] = []
  for (const id of unique) {
    const node = view.nodes.get(id)
    if (!isLive(node)) return missing(id, "node")
    if (node.type !== "frame" && node.type !== "shape") return form("node", "A frame or a shape.", id)
    nodes.push(node)
  }
  const covered = new Set<NodeId>()
  for (const node of nodes) for (const child of descendantsOf(view, node.id)) covered.add(child.id)
  const roots = nodes.filter((node) => !covered.has(node.id))
  for (const node of roots) {
    if (lockedIn(view, node.id)) return form("node", "This layer is locked. Unlock it or choose another.", node.id)
    const owner = linkedOwner(view.nodes, node.id)
    if (owner !== undefined && !unique.includes(owner))
      return form("node", "This layer is linked. Move the template with it.", node.id)
  }
  return roots
}

function resolvedLandings(view: Doom, boxes: ReadonlyMap<NodeId, Box> | undefined): Landings {
  const landings = new Map<NodeId, { box: Box }>()
  if (boxes === undefined) return landings
  for (const [id, box] of boxes) {
    const node = view.nodes.get(id)
    if (node?.type === "frame" || node?.type === "shape") landings.set(id, { box })
  }
  return landings
}

function slideTurn(view: Doom, id: NodeId, boxes: ReadonlyMap<NodeId, Box> | undefined): number {
  let turn = 0
  let at: Node | undefined = view.nodes.get(id)
  for (let hops = 0; at !== undefined && hops <= view.nodes.size; hops += 1) {
    if (at.type === "slide" || at.type === "deck" || at.type === "slideRow") break
    turn += boxOf(at, boxes).rotation
    const parent = parentOf(at)
    at = parent == null ? undefined : view.nodes.get(parent.id)
  }
  return wrapRotation(turn)
}

function paintedAnchor(
  view: Doom,
  roots: readonly Node[],
  boxes: ReadonlyMap<NodeId, Box> | undefined,
  landings: Landings,
): Point {
  let x = Number.POSITIVE_INFINITY
  let y = Number.POSITIVE_INFINITY
  for (const node of roots) {
    const box = boxOf(node, boxes)
    const matrix = worldMatrix(view, node.id, landings)
    for (const corner of [
      { x: 0, y: 0 },
      { x: box.w, y: 0 },
      { x: 0, y: box.h },
      { x: box.w, y: box.h },
    ]) {
      const at = apply(matrix, corner)
      x = Math.min(x, at.x)
      y = Math.min(y, at.y)
    }
  }
  return { x, y }
}

function anchorOf(view: Doom, roots: readonly Node[], boxes: ReadonlyMap<NodeId, Box> | undefined): Point {
  return paintedAnchor(view, roots, boxes, resolvedLandings(view, boxes))
}

export function slidePlace(view: Doom, ids: readonly NodeId[], boxes?: ReadonlyMap<NodeId, Box>): Point | Refusal {
  const roots = rootsOf(view, ids)
  if (isRefusal(roots)) return roots
  return anchorOf(view, roots, boxes)
}

function namedEnd(end: End): NodeId | undefined {
  return "node" in end ? end.node : undefined
}

function joinedLines(view: Doom, moving: ReadonlySet<NodeId>): readonly NodeId[] {
  const extra: NodeId[] = []
  for (const node of view.nodes.values()) {
    if (!isLive(node) || moving.has(node.id)) continue
    const geometry = propOf(node, "geometry")
    if (geometry?.kind !== "line" || lockedIn(view, node.id)) continue
    const named = [geometry.start, geometry.end].flatMap((end) => {
      const id = namedEnd(end)
      return id === undefined ? [] : [id]
    })
    if (named.length === 2 && named.every((id) => moving.has(id))) extra.push(node.id)
  }
  return extra
}

function inOrder(view: Doom, ids: readonly NodeId[]): readonly NodeId[] {
  const want = new Set(ids)
  const found: NodeId[] = []
  const walk = (id: NodeId): void => {
    if (want.has(id)) found.push(id)
    for (const child of childrenOf(view, id)) walk(child.id)
  }
  const deck = deckOf(view)
  if (deck !== undefined) walk(deck.id)
  for (const id of ids) if (!found.includes(id)) found.push(id)
  return found
}

function sameEnd(left: End, right: End): boolean {
  if ("node" in left && "node" in right)
    return left.node === right.node && left.site === right.site && left.along === right.along
  if (!("node" in left) && !("node" in right)) return left.x === right.x && left.y === right.y
  return false
}

function shiftEnd(end: End, matrix: ReturnType<typeof worldMatrix>, delta: Point): End {
  if ("node" in end) return end
  const spot = apply(matrix, end)
  return { x: Math.round(spot.x + delta.x), y: Math.round(spot.y + delta.y) }
}

function holderMatrix(view: Doom, node: Node, landings: Landings) {
  const parent = parentOf(node)
  const holder = parent == null ? undefined : view.nodes.get(parent.id)
  if (holder === undefined || holder.type === "slide" || holder.type === "deck" || holder.type === "slideRow")
    return identity
  return worldMatrix(view, holder.id, landings)
}

function movedLine(view: Doom, node: Node, landings: Landings, delta: Point): Geometry | undefined {
  const geometry = propOf(node, "geometry")
  if (geometry?.kind !== "line") return undefined
  const matrix = holderMatrix(view, node, landings)
  const start = shiftEnd(geometry.start, matrix, delta)
  const end = shiftEnd(geometry.end, matrix, delta)
  if (sameEnd(start, geometry.start) && sameEnd(end, geometry.end)) return undefined
  return { ...geometry, start, end }
}

function placedBox(
  view: Doom,
  node: Node,
  boxes: ReadonlyMap<NodeId, Box> | undefined,
  landings: Landings,
  delta: Point,
): Box {
  const local = boxOf(node, boxes)
  const center = apply(worldMatrix(view, node.id, landings), { x: local.w / 2, y: local.h / 2 })
  return {
    ...local,
    x: Math.round(center.x + delta.x - local.w / 2),
    y: Math.round(center.y + delta.y - local.h / 2),
    rotation: slideTurn(view, node.id, boxes),
  }
}

function sameBox(stored: Box | undefined, next: Box): boolean {
  return (
    stored !== undefined &&
    stored.x === next.x &&
    stored.y === next.y &&
    stored.w === next.w &&
    stored.h === next.h &&
    stored.rotation === next.rotation &&
    stored.flipH === next.flipH &&
    stored.flipV === next.flipV
  )
}

function keysAt(
  view: Doom,
  slide: NodeId,
  ordered: readonly NodeId[],
  after: NodeId | null,
): readonly OrderKey[] | Refusal {
  if (after !== null && ordered.includes(after)) return form("after", "Another sibling on the slide.", after)
  const leaving = new Set(ordered)
  const siblings = childrenOf(view, slide).filter((node) => !leaving.has(node.id))
  const index = after === null ? -1 : siblings.findIndex((node) => node.id === after)
  if (after !== null && index < 0) return missing(after, "after")
  const keyOf = (node: Node | undefined): OrderKey | null => parentOf(node)?.at ?? null
  const low = index < 0 ? null : keyOf(siblings[index])
  const next = keyOf(siblings[index + 1])
  const high = low !== null && next !== null && low >= next ? null : next
  const keys: OrderKey[] = []
  let before: OrderKey | null = low
  for (let made = 0; made < ordered.length; made += 1) {
    before = orderKeyBetween(before, high)
    keys.push(before)
  }
  return keys
}

function placedAfter(
  view: Doom,
  slide: NodeId,
  ordered: readonly NodeId[],
  after: NodeId | null | undefined,
): NodeId | null {
  if (after !== undefined) return after
  const leaving = new Set(ordered)
  return (
    childrenOf(view, slide)
      .filter((node) => !leaving.has(node.id))
      .at(-1)?.id ?? null
  )
}

export function moveToSlide(
  view: Doom,
  ids: readonly NodeId[],
  slide: NodeId,
  at: Point,
  options: MoveToSlideOptions = {},
): { readonly writes: readonly Write[] } | Refusal {
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return form("box", "A place on the slide.")
  const target = view.nodes.get(slide)
  if (!isLive(target)) return missing(slide, "into")
  if (target.type !== "slide") return form("into", "A slide.", slide)
  const roots = rootsOf(view, ids)
  if (isRefusal(roots)) return roots
  const boxes = options.boxes
  const landings = resolvedLandings(view, boxes)
  const corner = paintedAnchor(view, roots, boxes, landings)
  const delta = { x: at.x - corner.x, y: at.y - corner.y }
  const moving = new Set<NodeId>(roots.map((node) => node.id))
  for (const node of roots) for (const child of descendantsOf(view, node.id)) moving.add(child.id)
  const ordered = inOrder(view, [...roots.map((node) => node.id), ...joinedLines(view, moving)])
  const after = placedAfter(view, slide, ordered, options.after)
  const keys = keysAt(view, slide, ordered, after)
  if (isRefusal(keys)) return keys
  const writes: Write[] = []
  for (const [index, id] of ordered.entries()) {
    const key = keys[index]
    const node = view.nodes.get(id)
    if (key === undefined || !isLive(node)) continue
    const box = placedBox(view, node, boxes, landings, delta)
    const parent = parentOf(node)
    if (parent?.id !== slide || parent.at !== key)
      writes.push({ node: id, prop: "parent", value: { id: slide, at: key } })
    if (!sameBox(propOf(node, "box"), box)) writes.push({ node: id, prop: "box", value: box })
    const line = movedLine(view, node, landings, delta)
    if (line !== undefined) writes.push({ node: id, prop: "geometry", value: line })
  }
  return { writes }
}
