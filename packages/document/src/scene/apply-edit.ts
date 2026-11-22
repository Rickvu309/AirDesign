import { limits } from "../limits.js"
import type { NodeId, Rev } from "./ids.js"
import { rev } from "./ids.js"
import { type NodeType, type PropName, type WriteKey, holds, props } from "./props.js"
import { readWriteIn } from "./read-write.js"
import { type Refusal, isRefusal, refuse } from "./refusal.js"
import type { Landed, Node, Run, Scene, Write } from "./scene.js"
import { type Theme, themeKeys, withThemeValue } from "./theme.js"

type Parent = { readonly id: NodeId; readonly at: string }
type Working = {
  readonly nodes: Map<NodeId, Node>
  readonly revs: Map<NodeId, Map<WriteKey, Rev>>
  readonly children: Map<NodeId, NodeId[]>
  readonly runs: Map<string, Run>
  readonly created: Set<NodeId>
  readonly copied: Set<NodeId>
  readonly ownRevs: Set<NodeId>
  regrouped: boolean
}

const parentOf = (node: Node | undefined): Parent | null | undefined =>
  node === undefined ? undefined : (node as { parent?: Parent | null }).parent

const deleted = (node: Node) => parentOf(node) === null

function open(scene: Scene): Working {
  return {
    nodes: new Map(scene.nodes),
    revs: new Map(scene.revs as Map<NodeId, Map<WriteKey, Rev>>),
    children: new Map(scene.children as Map<NodeId, NodeId[]>),
    runs: new Map(scene.runs),
    created: new Set(),
    copied: new Set(),
    ownRevs: new Set(),
    regrouped: false,
  }
}

function stamp(work: Working, node: NodeId, keys: readonly WriteKey[], at: Rev): void {
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

function place(work: Working, node: Node, value: Parent | null, at: Rev): void {
  const was = parentOf(node)
  const next = setProp(work, node, "parent", value, at)
  if (was !== undefined && was !== null) removeChild(work, was.id, node.id)
  if (value !== null) insertChild(work, value.id, next.id)
  work.regrouped = true
}

function guardRun(work: Working, landed: Landed): Refusal | undefined {
  const { author, phase } = landed
  if (phase !== undefined && (author.kind !== "agent" || author.run === undefined)) return refuse("shape")
  if (author.kind !== "agent") return undefined
  const run = author.run === undefined ? undefined : work.runs.get(author.run)
  if (phase === "start") {
    if (run !== undefined || author.run === undefined) return refuse("run-fenced")
    work.runs.set(author.run, { phase: "running", guarded: new Set() })
    return undefined
  }
  return run?.phase === "running" ? undefined : refuse("run-fenced")
}

function write(work: Working, scene: Scene, landed: Landed, raw: Write): Refusal | undefined {
  const read = readWriteIn(raw, { type: (node) => work.nodes.get(node)?.type })
  if (isRefusal(read)) return read
  const { node: id, prop: key, value } = read
  if (key === "type") {
    if (work.nodes.has(id)) return undefined
    if (value === "deck" && [...work.nodes.values()].some((node) => node.type === "deck"))
      return refuse("limit", id, key)
    work.nodes.set(id, { id, rev: landed.rev, type: value as NodeType } as Node)
    work.created.add(id)
    stamp(work, id, ["type"], landed.rev)
    return undefined
  }
  const node = work.nodes.get(id)!
  if (key !== "parent" && deleted(node)) return refuse("missing", id, key)
  if (landed.author.kind === "agent") {
    const run = work.runs.get(landed.author.run ?? "")
    if (!work.created.has(id) && run?.guarded.has(id)) return refuse("person", id, key)
  }
  const was = scene.revs.get(id)?.get(key)
  if (was !== undefined) {
    const spec = key.startsWith("theme.") ? undefined : props[key as PropName]
    if (read.base === undefined ? spec?.conflict === "base" : read.base < was) return refuse("stale", id, key)
  }

  if (key === "parent") {
    const parent = value as Parent | null
    if (parent !== null) {
      const target = work.nodes.get(parent.id)
      if (target === undefined || deleted(target)) return refuse("missing", id, key)
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

function liveElements(nodes: ReadonlyMap<NodeId, Node>): number {
  let count = 0
  for (const node of nodes.values()) if (parentOf(node) != null) count += 1
  return count
}

function liveSlides(nodes: ReadonlyMap<NodeId, Node>): number {
  let count = 0
  for (const node of nodes.values()) {
    if (node.type !== "slide") continue
    const parent = parentOf(node)
    const row = parent == null ? undefined : nodes.get(parent.id)
    if (row !== undefined && !deleted(row) && (row as { hidden?: boolean }).hidden !== true) count += 1
  }
  return count
}

function overLimit(work: Working, scene: Scene): Refusal | undefined {
  if (!work.regrouped) return undefined
  const grew = (now: number, was: () => number, limit: number) => now > limit && now > was()
  if (grew(liveElements(work.nodes), () => liveElements(scene.nodes), limits.elements)) return refuse("limit")
  if (grew(liveSlides(work.nodes), () => liveSlides(scene.nodes), limits.slides)) return refuse("limit")
  return undefined
}

function protect(work: Working, landed: Landed, touched: ReadonlySet<NodeId>): void {
  if (landed.author.kind !== "person") return
  for (const [name, run] of work.runs)
    if (run.phase === "running") work.runs.set(name, { ...run, guarded: new Set([...run.guarded, ...touched]) })
}

export function applyEdit(scene: Scene, landed: Landed): Scene | Refusal {
  if (scene.onces.has(landed.once)) return scene
  const work = open(scene)
  const fenced = guardRun(work, landed)
  if (fenced !== undefined) return fenced
  for (const each of landed.writes) {
    const refusal = write(work, scene, landed, each)
    if (refusal !== undefined) return refusal
  }
  for (const id of work.created) {
    const node = work.nodes.get(id)!
    if (node.type !== "deck" && parentOf(node) === undefined) return refuse("shape", id)
  }
  const crowded = overLimit(work, scene)
  if (crowded !== undefined) return crowded
  if (landed.phase === "stop") {
    const run = work.runs.get(landed.author.run!)!
    work.runs.set(landed.author.run!, { ...run, phase: "stopped" })
  }
  protect(work, landed, new Set(landed.writes.map((each) => each.node)))
  return {
    nodes: work.nodes,
    revs: work.revs,
    children: work.children,
    rev: rev(Math.max(scene.rev, landed.rev)),
    onces: new Map(scene.onces).set(landed.once, landed.rev),
    runs: work.runs,
  }
}
