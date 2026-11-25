import { sameValue } from "../changing-writes.js"
import type { Doom, Landed, Node, Write } from "../doom.js"
import { parentOf, propOf } from "../doom-walk.js"
import { props } from "../props.js"
import { styleWrite } from "../text-writes.js"
import { agentLinkTarget } from "../link.js"
import type { NodeId } from "../ids.js"
import { isRefusal, refuse, type Refusal } from "../refusal.js"
import { keyString, type Instance, type PartKey } from "./instance.js"
import { partId, reservedPartId } from "./part-id.js"

type Tree = Pick<Doom, "nodes" | "children">

type Kind = Instance["parts"][number]["baseline"]["kind"]

function kindOf(node: Node | undefined): Kind | undefined {
  if (node?.type !== "shape") return undefined
  if (node.geometry?.kind === "line") return "line"
  if (node.geometry?.kind === "path") return "path"
  if (node.geometry?.kind !== "rect") return undefined
  return node.text === undefined ? "rect" : "text"
}

export function instanceFits(tree: Tree, root: NodeId, instance: Instance): boolean {
  const generated = tree.nodes.get(instance.generated)
  const children = tree.children.get(instance.generated) ?? []
  if (generated?.type !== "frame" || generated.parent?.id !== root || children.length !== instance.parts.length)
    return false
  return instance.parts.every(
    ({ node, baseline }, at) =>
      node === children[at] &&
      parentOf(tree.nodes.get(node))?.id === instance.generated &&
      kindOf(tree.nodes.get(node)) === baseline.kind,
  )
}

export const instanceRoots = (writes: readonly Write[]): readonly NodeId[] => [
  ...new Set(writes.flatMap(({ node, prop }) => (prop === "instance" ? [node] : []))),
]

export function linkedOwner(nodes: Tree["nodes"], node: NodeId): NodeId | undefined {
  const up = parentOf(nodes.get(node))?.id
  if (up === undefined) return undefined
  if (propOf(nodes.get(up), "instance")?.generated === node) return up
  const root = parentOf(nodes.get(up))?.id
  return root !== undefined && propOf(nodes.get(root), "instance")?.generated === up ? root : undefined
}

export function partDeletes(tree: Tree, writes: readonly Write[]): ReadonlyMap<NodeId, readonly PartKey[]> {
  const explicit = new Set(instanceRoots(writes))
  const removed = new Map<NodeId, PartKey[]>()
  for (const write of writes) {
    if (write.prop !== "parent" || write.value !== null) continue
    const root = linkedOwner(tree.nodes, write.node)
    if (root === undefined || explicit.has(root)) continue
    const part = propOf(tree.nodes.get(root), "instance")?.parts.find(({ node }) => node === write.node)
    if (part === undefined) continue
    const keys = removed.get(root) ?? []
    keys.push(part.key)
    removed.set(root, keys)
  }
  return removed
}

export function suppressKeys(tree: Tree, root: NodeId, keys: readonly PartKey[]): readonly Write[] | Refusal {
  const instance = propOf(tree.nodes.get(root), "instance")
  if (instance === undefined) return []
  const suppressed = new Map(instance.suppressed.map((each) => [keyString(each.key), each]))
  const asked = new Set(keys.map(keyString))
  const gone = instance.parts.filter(({ key }) => asked.has(keyString(key)))
  if (gone.length === 0) return []
  for (const { key } of gone) suppressed.set(keyString(key), { key, reason: "delete" })
  const next = props.instance.read({
    ...instance,
    parts: instance.parts.filter(({ key }) => !suppressed.has(keyString(key))),
    suppressed: [...suppressed.values()],
  })
  if (isRefusal(next)) return { ...next, node: root, prop: "instance" }
  return [
    ...gone.map(({ node }) => ({ node, prop: "parent" as const, value: null })),
    { node: root, prop: "instance", value: next },
  ]
}

export function withPartDeletes(tree: Tree, writes: readonly Write[]): readonly Write[] | Refusal {
  const deletes = partDeletes(tree, writes)
  if (deletes.size === 0) return writes
  const parents = new Set<NodeId>()
  const extra: Write[] = []
  for (const [root, keys] of deletes) {
    const suppression = suppressKeys(tree, root, keys)
    if (isRefusal(suppression)) return suppression
    for (const each of suppression) {
      if (each.prop === "parent") parents.add(each.node)
      else extra.push(each)
    }
  }
  return [
    ...writes.map((write) =>
      write.prop === "parent" && write.value === null && parents.has(write.node)
        ? { node: write.node, prop: write.prop, value: null }
        : write,
    ),
    ...extra,
  ]
}

export function suppressionChanges(
  root: NodeId,
  before: Instance | undefined,
  after: Instance | undefined,
): readonly NodeId[] {
  if (before === undefined || after === undefined) return []
  const wasLive = new Set(before.parts.map(({ node }) => node))
  const wasSuppressed = new Set(before.suppressed.map(({ key }) => keyString(key)))
  const priorParts = new Map(before.parts.map(({ node, key }) => [keyString(key), node]))
  return [
    ...after.parts.filter(({ node }) => !wasLive.has(node)).map(({ node }) => node),
    ...after.suppressed.flatMap(({ key }) => {
      const name = keyString(key)
      return wasSuppressed.has(name) ? [] : [priorParts.get(name) ?? partId(root, key)]
    }),
  ]
}

function linkedRefusal(write: Pick<Write, "node" | "prop">): Refusal {
  return {
    ...refuse("shape", write.node, write.prop),
    form: "This layer is linked. Use detach to make it a plain layer.",
  }
}

const styledFields = {
  rect: { fill: "fills" },
  path: { fill: "fills" },
  text: { textStyle: "text" },
  line: {},
} as const satisfies Readonly<Record<Kind, Readonly<Record<string, Write["prop"]>>>>

function styleProps(kind: Kind | undefined): readonly Write["prop"][] {
  return kind === undefined ? [] : Object.values(styledFields[kind])
}

const sharedOverrides = ["name", "link"] as const

function agentOverrides(kind: Kind): readonly string[] {
  return [
    ...Object.keys(styledFields[kind]),
    ...sharedOverrides.filter((field) => field !== "link" || kind === agentLinkTarget),
  ]
}

export const linkedPartOverrides: {
  readonly text: readonly string[]
  readonly shapes: readonly string[]
  readonly lines: readonly string[]
} = {
  text: agentOverrides("text"),
  shapes: agentOverrides("rect").filter((field) => agentOverrides("path").includes(field)),
  lines: agentOverrides("line"),
}

export function linkedOverride(nodes: Tree["nodes"], write: Write): boolean {
  return linkedOwner(nodes, write.node) !== undefined && styleProps(kindOf(nodes.get(write.node))).includes(write.prop)
}

function editable(write: Write, before: Node | undefined, after: Node | undefined): boolean {
  if (sharedOverrides.some((prop) => prop === write.prop)) return true
  if (!styleProps(kindOf(before)).includes(write.prop)) return false
  if (write.prop === "fills") return true
  if (
    write.prop !== "text" ||
    before?.type !== "shape" ||
    after?.type !== "shape" ||
    before.text === undefined ||
    after.text === undefined
  )
    return false
  return (
    sameValue({ ...after.text, style: before.text.style }, before.text) ||
    sameValue(after.text, styleWrite(before.text, after.text.style)) ||
    sameValue(before.text, styleWrite(after.text, before.text.style))
  )
}

export function guardInstances(
  before: Tree & Pick<Doom, "revs">,
  after: Tree,
  edit: Landed,
  inferred: boolean,
): Refusal | undefined {
  const roots = new Set(instanceRoots(edit.writes))
  const reserved = edit.writes.filter(({ node, prop, value }) => {
    if (!reservedPartId(node)) return false
    if (prop === "type") return !before.nodes.has(node)
    if (prop !== "parent" || value === null) return false
    const revisions = before.revs.get(node)
    const exited = revisions?.get("partExit")
    return (
      (exited !== undefined && exited === revisions?.get("parent")) ||
      (linkedOwner(before.nodes, node) === undefined && linkedOwner(after.nodes, node) !== undefined)
    )
  })
  if (reserved.length > 0) {
    const generated = new Set<NodeId>()
    for (const root of roots) {
      const instance = propOf(after.nodes.get(root), "instance")
      if (instance === undefined) continue
      if (instance.generated === partId(root, ["root"])) generated.add(instance.generated)
      for (const { node, key } of instance.parts) if (node === partId(root, key)) generated.add(node)
    }
    const claimed = reserved.find(({ node }) => !generated.has(node))
    if (claimed !== undefined)
      return claimed.prop === "parent" ? linkedRefusal(claimed) : refuse("shape", claimed.node, claimed.prop)
  }
  if (roots.size > 0 && edit.readBase === undefined && !inferred)
    return refuse("shape", roots.values().next().value, "instance")
  for (const root of roots) {
    const instance = propOf(after.nodes.get(root), "instance")
    const prior = propOf(before.nodes.get(root), "instance")
    if (
      instance !== undefined &&
      (!instanceFits(after, root, instance) || (prior !== undefined && prior.generated !== instance.generated))
    )
      return refuse("shape", root, "instance")
  }
  for (const write of edit.writes) {
    const was = before.nodes.get(write.node)
    const now = after.nodes.get(write.node)
    if (write.prop === "box" && !roots.has(write.node) && propOf(was, "instance") !== undefined) {
      const old = propOf(was, "box")
      const box = propOf(now, "box")
      if (box?.w !== old?.w || box?.h !== old?.h) return linkedRefusal(write)
    }
    const prior = linkedOwner(before.nodes, write.node)
    const next = linkedOwner(after.nodes, write.node)
    if (prior !== undefined && next !== undefined && prior !== next) return linkedRefusal(write)
    const root = prior ?? next
    if (root === undefined) continue
    if (roots.has(root)) {
      if (
        prior !== undefined &&
        next === undefined &&
        propOf(after.nodes.get(root), "instance") !== undefined &&
        parentOf(after.nodes.get(write.node)) !== null
      )
        return linkedRefusal(write)
      continue
    }
    if (
      prior !== next ||
      propOf(before.nodes.get(root), "instance")?.generated === write.node ||
      !editable(write, was, now)
    )
      return linkedRefusal(write)
  }
  return undefined
}
