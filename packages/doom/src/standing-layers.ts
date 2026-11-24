import { wrapRotation } from "./angle.js"
import { sameValue } from "./changing-writes.js"
import type { Doom, Write } from "./doom.js"
import { propOf, zeroBox } from "./doom-walk.js"
import type { Geometry } from "./geometry.js"
import type { NodeId, Rev } from "./ids.js"
import type { Box } from "./resolved.js"

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

export type Step = { readonly before: Doom; readonly writes: readonly Write[] }

type Frames = {
  readonly parent: (node: NodeId) => NodeId | undefined
  readonly rotation: (node: NodeId) => number
}

const framesIn = (doom: Doom): Frames => ({
  parent: (node) => parentIn(doom, node)?.id,
  rotation: (node) => propOf(doom.nodes.get(node), "box")?.rotation ?? 0,
})

function framesAfter(writes: readonly Write[], under: Frames): Frames {
  const last = new Map(writes.map((each) => [`${each.node}/${each.prop}`, each.value]))
  return {
    parent: (node) =>
      (last.get(`${node}/parent`) as { readonly id: NodeId } | null | undefined)?.id ?? under.parent(node),
    rotation: (node) =>
      last.has(`${node}/box`) ? ((last.get(`${node}/box`) as Box | null) ?? zeroBox).rotation : under.rotation(node),
  }
}

function turnOnSlide({ parent, rotation }: Frames, node: NodeId | undefined, most: number): number {
  let turn = 0
  for (let at = node, hops = 0; at !== undefined && hops <= most; hops += 1) {
    turn += rotation(at)
    at = parent(at)
  }
  return turn
}

const nowhere: Frames = { parent: () => undefined, rotation: () => 0 }

function turnsLeftInPlace(
  now: Doom,
  undo: readonly Write[],
  inPlace: (node: NodeId) => boolean,
  step: Step | undefined,
): (node: NodeId) => number {
  const here = framesIn(now)
  if (step === undefined) return here.rotation
  const most = now.nodes.size + step.writes.length
  const before = framesIn(step.before)
  const left = framesAfter(step.writes, before)
  const putBack = framesAfter(undo, nowhere)
  const shown: Frames = { parent: (node) => here.parent(node) ?? putBack.parent(node), rotation: here.rotation }
  const written = framesAfter(undo, here)
  const turns = new Map<NodeId, number>()
  const landed: Frames = { parent: written.parent, rotation: (node) => turnOf(node) }
  const turnOf = (node: NodeId): number => {
    const settled = turns.get(node)
    if (settled !== undefined) return settled
    turns.set(node, written.rotation(node))
    if (!inPlace(node)) return written.rotation(node)
    const own = turnOnSlide(left, node, most) - turnOnSlide(before, node, most)
    const turn = wrapRotation(turnOnSlide(shown, node, most) - own - turnOnSlide(landed, here.parent(node), most))
    const kept = turn === wrapRotation(here.rotation(node)) ? here.rotation(node) : turn
    turns.set(node, kept)
    return kept
  }
  return turnOf
}

function boxLeftInPlace(now: Doom, write: Write, rotation: number): Write | undefined {
  const here = propOf(now.nodes.get(write.node), "box") ?? zeroBox
  const value = { ...((write.value as Box | null) ?? zeroBox), x: here.x, y: here.y, rotation }
  return sameValue(value, here) ? undefined : { ...write, value }
}

function lineLeftInPlace(now: Doom, write: Write): Write | undefined {
  const here = propOf(now.nodes.get(write.node), "geometry")
  const was = write.value as Geometry | null
  if (here?.kind !== "line" || was?.kind !== "line") return write
  const value = { ...was, start: here.start, end: here.end }
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
  step?: Step,
): readonly Write[] {
  const moves = movesIn(writes)
  const wroteParent = new Set(writes.flatMap((each) => (each.prop === "parent" ? [each.node] : [])))
  const lands = landingMoves(now, moves)
  const held = heldFrames(now, writes, moves, lands, since)
  const placed = (node: NodeId) =>
    !lands.has(node) && (moves.has(node) || (!wroteParent.has(node) && strayedFrom(now, node, measuredIn, since)))
  const standing = writes.filter((each) => {
    if (each.prop === "parent") return each.value === null ? !held.has(each.node) : lands.has(each.node)
    return lands.has(each.node) || parentIn(now, each.node) !== null
  })
  const turned = new Set(standing.flatMap((each) => (each.prop === "box" && placed(each.node) ? [each.node] : [])))
  const turnOf = turnsLeftInPlace(now, standing, (node) => turned.has(node), step)
  return standing.flatMap((each) => {
    if (each.prop === "parent" || !placed(each.node)) return [each]
    if (each.prop === "box") return boxLeftInPlace(now, each, turnOf(each.node)) ?? []
    if (each.prop === "geometry") return lineLeftInPlace(now, each) ?? []
    return [each]
  })
}
