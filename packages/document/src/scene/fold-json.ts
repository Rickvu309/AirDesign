import { type NodeId, type Rev, readNodeId, readRev } from "./ids.js"
import { type NodeType, type PropName, type WriteKey, accepts, nodeTypes, props } from "./props.js"
import { readEdit, readWriteKey } from "./read-write.js"
import { type Refusal, isRefusal, refuse } from "./refusal.js"
import type { Landed, Node, Run, Scene } from "./scene.js"

type Plain = Readonly<Record<string, unknown>>

const plain = (raw: unknown): Plain | undefined =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Plain) : undefined

export function foldToJson(scene: Scene): unknown {
  return {
    rev: scene.rev,
    nodes: Object.fromEntries(scene.nodes),
    revs: Object.fromEntries([...scene.revs].map(([node, revs]) => [node, Object.fromEntries(revs)])),
    onces: Object.fromEntries(scene.onces),
    runs: runsToJson(scene.runs),
  }
}

function readNode(key: string, raw: unknown): Node | undefined {
  const found = plain(raw)
  if (found === undefined || found.id !== key || readNodeId(key) === undefined) return undefined
  const at = readRev(found.rev)
  const type = found.type
  if (at === undefined || typeof type !== "string" || !(nodeTypes as readonly string[]).includes(type)) return undefined
  const taken = accepts[type as NodeType] as readonly PropName[]
  const node: Record<string, unknown> = { id: found.id, rev: at, type }
  for (const [name, value] of Object.entries(found)) {
    if (name === "id" || name === "rev" || name === "type") continue
    if (!Object.hasOwn(props, name) || !taken.includes(name as PropName)) return undefined
    const read = props[name as PropName].read(value)
    if (isRefusal(read)) return undefined
    node[name] = read
  }
  return node as Node
}

type Placed = { readonly id: NodeId; readonly at: string }

const placeOf = (node: Node): Placed | null | undefined => (node as { parent?: Placed | null }).parent

function childrenOf(nodes: ReadonlyMap<NodeId, Node>): Map<NodeId, NodeId[]> | undefined {
  const children = new Map<NodeId, NodeId[]>()
  for (const node of nodes.values()) {
    const parent = placeOf(node)
    if (parent === undefined || parent === null) continue
    if (!nodes.has(parent.id)) return undefined
    const list = children.get(parent.id)
    if (list === undefined) children.set(parent.id, [node.id])
    else list.push(node.id)
  }
  for (const list of children.values())
    list.sort((left, right) => {
      const first = placeOf(nodes.get(left)!)!.at
      const second = placeOf(nodes.get(right)!)!.at
      if (first !== second) return first < second ? -1 : 1
      return left < right ? -1 : 1
    })
  return children
}

function readNodeRevs(raw: unknown): Map<WriteKey, Rev> | undefined {
  const list = plain(raw)
  if (list === undefined) return undefined
  const own = new Map<WriteKey, Rev>()
  for (const [name, at] of Object.entries(list)) {
    const write = readWriteKey(name)
    const read = readRev(at)
    if (write === undefined || read === undefined) return undefined
    own.set(write, read)
  }
  return own
}

function readRevs(raw: unknown, nodes: ReadonlyMap<NodeId, Node>): Map<NodeId, Map<WriteKey, Rev>> | undefined {
  const found = plain(raw)
  if (found === undefined) return undefined
  const revs = new Map<NodeId, Map<WriteKey, Rev>>()
  for (const [key, each] of Object.entries(found)) {
    const id = readNodeId(key)
    const own = readNodeRevs(each)
    if (id === undefined || !nodes.has(id) || own === undefined) return undefined
    revs.set(id, own)
  }
  return revs
}

export type StoredNode = { readonly node: Node; readonly revs: ReadonlyMap<WriteKey, Rev> }

export function readStoredNode(id: string, rawNode: unknown, rawRevs: unknown): StoredNode | undefined {
  const node = readNode(id, rawNode)
  const revs = readNodeRevs(rawRevs)
  return node === undefined || revs === undefined ? undefined : { node, revs }
}

export const revsToJson = (revs: ReadonlyMap<WriteKey, Rev> | undefined): unknown => Object.fromEntries(revs ?? [])

export const runsToJson = (runs: ReadonlyMap<string, Run>): unknown =>
  Object.fromEntries([...runs].map(([name, run]) => [name, { phase: run.phase, guarded: [...run.guarded] }]))

function readOnces(raw: unknown): Map<string, Rev> | undefined {
  const found = plain(raw)
  if (found === undefined) return undefined
  const onces = new Map<string, Rev>()
  for (const [once, at] of Object.entries(found)) {
    const read = readRev(at)
    if (read === undefined) return undefined
    onces.set(once, read)
  }
  return onces
}

export function readRuns(raw: unknown, nodes?: ReadonlyMap<NodeId, Node>): Map<string, Run> | undefined {
  const found = plain(raw)
  if (found === undefined) return undefined
  const runs = new Map<string, Run>()
  for (const [name, each] of Object.entries(found)) {
    const run = plain(each)
    if (run === undefined || (run.phase !== "running" && run.phase !== "stopped") || !Array.isArray(run.guarded))
      return undefined
    const guarded = new Set<NodeId>()
    for (const item of run.guarded) {
      const id = readNodeId(item)
      if (id === undefined || (nodes !== undefined && !nodes.has(id))) return undefined
      guarded.add(id)
    }
    runs.set(name, { phase: run.phase, guarded })
  }
  return runs
}

const foldKeys = new Set(["rev", "nodes", "revs", "onces", "runs"])

export function readFold(raw: unknown): Scene | undefined {
  const found = plain(raw)
  if (found === undefined || Object.keys(found).some((key) => !foldKeys.has(key))) return undefined
  const head = readRev(found.rev)
  const stored = plain(found.nodes)
  if (head === undefined || stored === undefined) return undefined
  const nodes = new Map<NodeId, Node>()
  for (const [key, each] of Object.entries(stored)) {
    const node = readNode(key, each)
    if (node === undefined) return undefined
    nodes.set(node.id, node)
  }
  const children = childrenOf(nodes)
  const revs = readRevs(found.revs, nodes)
  const onces = readOnces(found.onces)
  const runs = readRuns(found.runs, nodes)
  if (children === undefined || revs === undefined || onces === undefined || runs === undefined) return undefined
  return { nodes, revs, children, rev: head, onces, runs }
}

export function readLanded(raw: unknown, scene: Scene): Landed | Refusal {
  const found = plain(raw)
  if (found === undefined) return refuse("shape")
  const { rev: at, ...rest } = found
  const landed = readRev(at)
  if (landed === undefined) return refuse("shape")
  const edit = readEdit(rest, scene)
  return isRefusal(edit) ? edit : { ...edit, rev: landed }
}
