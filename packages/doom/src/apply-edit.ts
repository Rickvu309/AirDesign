import type { RevisionKey } from "./doom.js"
import { limits } from "./limits.js"
import type { NodeId, Rev } from "./ids.js"
import { rev } from "./ids.js"
import { type NodeType, type PropName, holds, props } from "./props.js"
import { readWriteIn } from "./read-write.js"
import { type Refusal, isRefusal, refuse } from "./refusal.js"
import type { Landed, Node, Run, Doom, Write } from "./doom.js"
import { onDeck, propOf, slideOf } from "./doom-walk.js"
import { parentLanding } from "./parent-landing.js"
import type { End } from "./geometry.js"
import { freedInFold } from "./lost-ends.js"
import { type Theme, themeKeys, withThemeValue } from "./theme.js"
import { layeredOver } from "./layered-map.js"

type Parent = { readonly id: NodeId; readonly at: string }
type Working = {
  readonly nodes: Map<NodeId, Node>
  readonly revs: Map<NodeId, Map<RevisionKey, Rev>>
  readonly children: Map<NodeId, NodeId[]>
  readonly runs: Map<string, Run>
  readonly created: Set<NodeId>
  readonly copied: Set<NodeId>
  readonly ownRevs: Set<NodeId>
  readonly keptDeleted: Set<NodeId>
  regrouped: boolean
}

const parentOf = (node: Node | undefined): Parent | null | undefined =>
  node === undefined ? undefined : (node as { parent?: Parent | null }).parent

const deleted = (node: Node) => parentOf(node) === null

const takesBackDelete = (doom: Doom, write: Write) => parentLanding(doom, [write], write) === "restore"

function staysDeleted(doom: Doom, writes: readonly Write[]): Set<NodeId> {
  const dropping = new Set<NodeId>()
  const restoring = new Set<NodeId>()
  for (const write of writes) {
    const fate = parentLanding(doom, writes, write)
    if (fate === "drop") dropping.add(write.node)
    else if (fate === "restore") restoring.add(write.node)
  }
  for (const id of restoring) dropping.delete(id)
  return dropping
}

function open(doom: Doom, layered = false): Working {
  const copy = layered ? layeredOver : <K, V>(map: ReadonlyMap<K, V>) => new Map(map)
  return {
    nodes: copy(doom.nodes),
    revs: copy(doom.revs as Map<NodeId, Map<RevisionKey, Rev>>),
    children: copy(doom.children as Map<NodeId, NodeId[]>),
    runs: new Map(doom.runs),
    created: new Set(),
    copied: new Set(),
    ownRevs: new Set(),
    keptDeleted: new Set(),
    regrouped: false,
  }
}

function stamp(work: Working, node: NodeId, keys: readonly RevisionKey[], at: Rev): void {
  let revs = work.revs.get(node)
  if (revs === undefined || !work.ownRevs.has(node)) {
    revs = new Map(revs)
    work.revs.set(node, revs)
    work.ownRevs.add(node)
  }
  for (const key of keys) revs.set(key, at)
}

function setProp(work: Working, node: Node, key: PropName, value: unknown, at: Rev): Node {
  const next: Record<string, unknown> = { ...node, rev: at }
  if (value === null && key !== "parent") delete next[key]
  else next[key] = value
  const result = next as Node
  work.nodes.set(node.id, result)
  return result
}

function siblings(work: Working, parent: NodeId): NodeId[] {
  const list = work.children.get(parent) ?? []
  if (work.copied.has(parent)) return list
  const own = [...list]
  work.children.set(parent, own)
  work.copied.add(parent)
  return own
}

const atOf = (work: Working, node: NodeId) => parentOf(work.nodes.get(node))?.at ?? ""

function insertChild(work: Working, parent: NodeId, node: NodeId): void {
  const list = siblings(work, parent)
  const at = atOf(work, node)
  let low = 0
  let high = list.length
  while (low < high) {
    const middle = (low + high) >> 1
    const other = list[middle]!
    const earlier = atOf(work, other) < at || (atOf(work, other) === at && other < node)
    if (earlier) low = middle + 1
    else high = middle
  }
  list.splice(low, 0, node)
}

function removeChild(work: Working, parent: NodeId, node: NodeId): void {
  const list = siblings(work, parent)
  const index = list.indexOf(node)
  if (index >= 0) list.splice(index, 1)
}

function reaches(work: Working, from: NodeId, target: NodeId): boolean {
  let at: NodeId | undefined = from
  for (let hops = 0; at !== undefined && hops <= work.nodes.size; hops += 1) {
    if (at === target) return true
    at = parentOf(work.nodes.get(at))?.id
  }
  return false
}

function underLayerDeletedHere(work: Working, doom: Doom, from: NodeId): boolean {
  let at: NodeId | undefined = from
  for (let hops = 0; at !== undefined && hops <= work.nodes.size; hops += 1) {
    const now = work.nodes.get(at)
    if (now !== undefined && deleted(now)) return parentOf(doom.nodes.get(at)) !== null
    at = parentOf(now)?.id
  }
  return false
}

function place(work: Working, node: Node, value: Parent | null, at: Rev): void {
  const was = parentOf(node)
  const next = setProp(work, node, "parent", value, at)
  if (was !== undefined && was !== null) removeChild(work, was.id, node.id)
  if (value !== null) insertChild(work, value.id, next.id)
  work.regrouped = true
}

function lastSlide(work: Working, doom: Doom, landed: Landed): NodeId | undefined {
  const now = { ...doom, nodes: work.nodes }
  for (const each of [...landed.writes].reverse()) {
    const slide = slideOf(now, each.node)
    if (slide !== undefined) return slide
  }
  return undefined
}

function guardRun(work: Working, landed: Landed): Refusal | undefined {
  const { author, phase } = landed
  if (phase !== undefined && (author.kind !== "agent" || author.run === undefined)) return refuse("shape")
  if (author.kind !== "agent") return undefined
  const run = author.run === undefined ? undefined : work.runs.get(author.run)
  if (phase === "start") {
    if (run !== undefined || author.run === undefined) return refuse("run-fenced")
    for (const [name, other] of work.runs)
      if (other.phase === "running" && other.agent === author.id) work.runs.set(name, { ...other, phase: "stopped" })
    work.runs.set(author.run, {
      phase: "running",
      guarded: new Set(),
      agent: author.id,
      name: author.name ?? "",
      undone: false,
      started: landed.rev,
      wrote: landed.rev,
    })
    return undefined
  }
  if (landed.runUndo?.run === author.run && run?.agent === author.id) return undefined
  return run?.phase === "running" && run.agent === author.id ? undefined : refuse("run-fenced")
}

function write(work: Working, doom: Doom, landed: Landed, raw: Write, known: Known): Refusal | undefined {
  const read = readWriteIn(raw, { type: (node) => work.nodes.get(node)?.type })
  if (isRefusal(read)) return read
  const { node: id, prop: key, value } = read
  if (key === "type") {
    if (work.nodes.has(id)) return undefined
    if (value === "deck" && (known.deck() || [...work.created].some((made) => work.nodes.get(made)?.type === "deck")))
      return refuse("limit", id, key)
    work.nodes.set(id, { id, rev: landed.rev, type: value as NodeType } as Node)
    work.created.add(id)
    stamp(work, id, ["type"], landed.rev)
    return undefined
  }
  if (work.keptDeleted.has(id)) return undefined
  const node = work.nodes.get(id)!
  if (key !== "parent" && deleted(node)) return refuse("missing", id, key)
  const undoingOwn =
    landed.author.kind === "agent" && landed.runUndo !== undefined && landed.author.run === landed.runUndo.run
  if (landed.author.kind === "agent" && !undoingOwn) {
    const run = work.runs.get(landed.author.run ?? "")
    if (!work.created.has(id) && run?.guarded.has(id)) return refuse("person", id, key)
  }
  const was = doom.revs.get(id)?.get(key)
  if (was !== undefined) {
    const spec = key.startsWith("theme.") ? undefined : props[key as PropName]
    if (read.base === undefined ? spec?.conflict === "base" : read.base < was) return refuse("stale", id, key)
  }

  if (key === "parent") {
    const parent = value as Parent | null
    if (parent !== null) {
      const target = work.nodes.get(parent.id)
      if (
        target === undefined ||
        (deleted(target) && !takesBackDelete(doom, read)) ||
        underLayerDeletedHere(work, doom, parent.id)
      )
        return refuse("missing", id, key)
      if (!(holds[target.type] as readonly NodeType[]).includes(node.type)) return refuse("shape", id, key)
      if (reaches(work, parent.id, id)) return refuse("cycle", id, key)
    }
    place(work, node, parent, landed.rev)
    stamp(work, id, ["parent"], landed.rev)
    return undefined
  }
  if (key.startsWith("theme.")) {
    const theme = (node as { theme?: Theme }).theme
    if (theme === undefined) return refuse("missing", id, key)
    setProp(work, node, "theme", withThemeValue(theme, key as never, value), landed.rev)
    stamp(work, id, ["theme", key], landed.rev)
    return undefined
  }
  setProp(work, node, key as PropName, value, landed.rev)
  stamp(work, id, key === "theme" ? ["theme", ...themeKeys] : [key], landed.rev)
  if (key === "hidden") work.regrouped = true
  return undefined
}

function keepLiveEnds(work: Working, doom: Doom, landed: Landed): void {
  for (const id of new Set(landed.writes.flatMap((each) => (each.prop === "geometry" ? [each.node] : [])))) {
    const node = work.nodes.get(id)
    const line = propOf(node, "geometry")
    const was = propOf(doom.nodes.get(id), "geometry")
    if (node === undefined || line?.kind !== "line" || was?.kind !== "line") continue
    if (parentOf(node)?.id !== parentOf(doom.nodes.get(id))?.id) continue
    const kept = (end: End, stored: End) => ("node" in end && !onDeck(work.nodes, end.node) ? stored : end)
    const start = kept(line.start, was.start)
    const end = kept(line.end, was.end)
    if (start !== line.start || end !== line.end) setProp(work, node, "geometry", { ...line, start, end }, landed.rev)
  }
}

export type Counts = { readonly elements: number; readonly slides: number }
export type Known = {
  readonly accepting?: boolean
  readonly counts: () => Counts
  readonly deck: () => boolean
  readonly partial?: true
  readonly freeing?: true
  readonly layered?: true
}
export type Landing = { readonly doom: Doom; readonly delta: Counts }

const noChange: Counts = { elements: 0, slides: 0 }

const livesAsElement = (node: Node | undefined) => node !== undefined && parentOf(node) != null

function livesAsSlide(nodes: ReadonlyMap<NodeId, Node>, node: Node | undefined): boolean {
  if (node === undefined || node.type !== "slide") return false
  const parent = parentOf(node)
  const row = parent == null ? undefined : nodes.get(parent.id)
  return row !== undefined && !deleted(row) && (row as { hidden?: boolean }).hidden !== true
}

const counted = new WeakMap<Doom, Counts>()

export function countsOf(doom: Doom): Counts {
  const known = counted.get(doom)
  if (known !== undefined) return known
  let elements = 0
  let slides = 0
  for (const node of doom.nodes.values()) {
    if (livesAsElement(node)) elements += 1
    if (livesAsSlide(doom.nodes, node)) slides += 1
  }
  const counts = { elements, slides }
  counted.set(doom, counts)
  return counts
}

export const hasDeck = (doom: Doom): boolean => {
  for (const node of doom.nodes.values()) if (node.type === "deck") return true
  return false
}

function countDelta(work: Working, doom: Doom, landed: Landed): Counts {
  if (!work.regrouped) return noChange
  let elements = 0
  const slides = new Set<NodeId>()
  for (const id of new Set(landed.writes.map((each) => each.node))) {
    const before = doom.nodes.get(id)
    const after = work.nodes.get(id)
    elements += Number(livesAsElement(after)) - Number(livesAsElement(before))
    if (before?.type === "slide" || after?.type === "slide") slides.add(id)
    if (after?.type === "slideRow")
      for (const slide of [...(doom.children.get(id) ?? []), ...(work.children.get(id) ?? [])]) slides.add(slide)
  }
  let slideChange = 0
  for (const id of slides)
    slideChange +=
      Number(livesAsSlide(work.nodes, work.nodes.get(id))) - Number(livesAsSlide(doom.nodes, doom.nodes.get(id)))
  return { elements, slides: slideChange }
}

function overLimit(delta: Counts, known: Known): Refusal | undefined {
  if (delta.elements <= 0 && delta.slides <= 0) return undefined
  const was = known.counts()
  if (delta.elements > 0 && was.elements + delta.elements > limits.elements) return refuse("limit")
  if (delta.slides > 0 && was.slides + delta.slides > limits.slides) return refuse("limit")
  return undefined
}

function protect(work: Working, landed: Landed, touched: ReadonlySet<NodeId>): void {
  if (landed.author.kind !== "person") return
  for (const [name, run] of work.runs)
    if (run.phase === "running") work.runs.set(name, { ...run, guarded: new Set([...run.guarded, ...touched]) })
}

export function landEdit(doom: Doom, landed: Landed, known: Known): Landing | Refusal {
  if (doom.onces.has(landed.once)) return { doom, delta: noChange }
  if (landed.readBase !== undefined && landed.readBase !== doom.rev) return refuse("stale")
  const work = open(doom, known.layered === true)
  const fenced = guardRun(work, landed)
  if (fenced !== undefined) return fenced
  if (
    known.accepting === true &&
    landed.readBase !== undefined &&
    landed.writes.length === 0 &&
    landed.phase === undefined &&
    landed.runUndo === undefined
  )
    return { doom, delta: noChange }
  for (const id of staysDeleted(doom, landed.writes)) work.keptDeleted.add(id)
  for (const each of landed.writes) {
    const refusal = write(work, doom, landed, each, known)
    if (refusal !== undefined) return refusal
  }
  keepLiveEnds(work, doom, landed)
  if (known.freeing !== true) {
    const freed = freedInFold(doom, { ...doom, nodes: work.nodes, children: work.children }, landed.writes)
    if (isRefusal(freed)) return freed
    for (const [id, line] of freed) {
      setProp(work, work.nodes.get(id)!, "geometry", line, landed.rev)
      stamp(work, id, ["geometry"], landed.rev)
    }
  }
  for (const id of work.created) {
    const node = work.nodes.get(id)!
    if (node.type !== "deck" && parentOf(node) === undefined) return refuse("shape", id)
  }
  const delta = countDelta(work, doom, landed)
  const crowded = overLimit(delta, known)
  if (crowded !== undefined) return crowded
  if (known.partial !== true && delta.slides < 0 && known.counts().slides + delta.slides <= 0)
    return refuse("last-slide")
  const turned = landed.runUndo === undefined ? undefined : work.runs.get(landed.runUndo.run)
  const ownUndo =
    landed.author.kind === "agent" && landed.author.run === landed.runUndo?.run && turned?.agent === landed.author.id
  if (landed.runUndo !== undefined && (turned === undefined || (landed.author.kind !== "person" && !ownUndo)))
    return refuse("shape")
  if (landed.runUndo !== undefined && turned !== undefined)
    work.runs.set(landed.runUndo.run, { ...turned, undone: landed.runUndo.undone })
  const name = landed.author.kind === "agent" ? landed.author.run : undefined
  const own = name === undefined ? undefined : work.runs.get(name)
  if (name !== undefined && own !== undefined) {
    const slide = lastSlide(work, doom, landed)
    work.runs.set(name, {
      ...own,
      ...(landed.writes.length > 0 && landed.runUndo?.run !== name ? { wrote: landed.rev, undone: false } : {}),
      ...(slide === undefined ? {} : { slide }),
      ...(landed.phase === "stop" ? { phase: "stopped" as const } : {}),
    })
  }
  protect(work, landed, new Set(landed.writes.map((each) => each.node)))
  const landedDoom: Doom = {
    nodes: work.nodes,
    revs: work.revs,
    children: work.children,
    rev: rev(Math.max(doom.rev, landed.rev)),
    onces: (known.layered === true ? layeredOver(doom.onces) : new Map(doom.onces)).set(landed.once, landed.rev),
    runs: work.runs,
  }
  const was = counted.get(doom)
  if (was !== undefined)
    counted.set(landedDoom, { elements: was.elements + delta.elements, slides: was.slides + delta.slides })
  return { doom: landedDoom, delta }
}

export function applyEdit(doom: Doom, landed: Landed): Doom | Refusal {
  const landing = landEdit(doom, landed, { counts: () => countsOf(doom), deck: () => hasDeck(doom) })
  return isRefusal(landing) ? landing : landing.doom
}

export function applyBeforeFreeing(doom: Doom, landed: Landed): Doom | Refusal {
  const landing = landEdit(doom, landed, { counts: () => countsOf(doom), deck: () => hasDeck(doom), freeing: true })
  return isRefusal(landing) ? landing : landing.doom
}

export function applyStep(doom: Doom, landed: Landed): Doom | Refusal {
  const landing = landEdit(doom, landed, {
    counts: () => countsOf(doom),
    deck: () => hasDeck(doom),
    partial: true,
    layered: true,
  })
  return isRefusal(landing) ? landing : landing.doom
}
