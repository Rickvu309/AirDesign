import { apply, parseDeck, type Deck, type Id, type ChangeSet, type Element } from "../../deck/src/index.ts"
import type { Access } from "../../access/src/index.ts"

export type Principal = NonNullable<Awaited<ReturnType<Access["principal"]>>>
export type CommandId = string & { readonly __brand: "CommandId" }
export function commandId(value: string): CommandId {
  if (!isCommandId(value)) throw new Error("invalid-command-id")
  return value
}
function isCommandId(value: unknown): value is CommandId { return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) }
export type Command = { id: CommandId } & (
  { kind: "edit"; base: number; changes: ChangeSet; run: string | null } |
  { kind: "patch"; base: number; target: Id; fields: Node["fields"]; run: string | null } |
  { kind: "start-run"; run: string } |
  { kind: "close-run" | "undo-run"; run: string } |
  { kind: "undo" | "redo"; target: CommandId }
)
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type Node = { id: Id; parent: Id | null; order: number; fields: { [key: string]: Json } }
export type Patch = { id: Id; before: Node | null; after: Node | null; keys: string[]; adopts: boolean; places: boolean }
export type Contribution = { id: CommandId; seq: number; actor: "person" | "agent"; run: string | null; patches: Patch[]; active: boolean; toggledAt: number }
export type RunState = { id: string; epoch: number; kind: "open" | "closed" | "undone" }
export type History = { initial: Deck; deck: Deck; seq: number; events: Contribution[]; runs: RunState[]; usedIds: Id[] }
export type Receipt = { id: CommandId; seq: number; kind: "applied" } | { id: CommandId; seq: number; kind: "refused"; code: string; command: Command; restore?: CommandId }
export function initialHistory(deck: Deck): History { return { initial: deck, deck, seq: 0, events: [], runs: [], usedIds: nodes(deck).map(n => n.id) } }

export function nodes(deck: Deck): Node[] {
  const result: Node[] = []
  function visit(value: Deck | Deck["slides"][number] | Element, parent: Id | null, order: number) {
    const fields: Node["fields"] = {}
    for (const [key, field] of Object.entries(value)) if (!["id", "version", "slides", "elements", "children"].includes(key)) fields[key] = json(field)
    result.push({ id: value.id, parent, order, fields })
    const children = "slides" in value ? value.slides : "elements" in value ? value.elements : value.kind === "group" ? value.children : []
    children.forEach((child, index) => visit(child, value.id, index))
  }
  visit(deck, null, 0)
  return result
}
function json(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value
  if (Array.isArray(value)) return value.map(json)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, json(v)]))
  throw new Error("invalid-json")
}
function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b) }
function patches(before: Deck, after: Deck): Patch[] {
  const previous = nodes(before), next = nodes(after)
  return [...new Set([...previous, ...next].map(n => n.id))].flatMap(id => {
    const a = previous.find(n => n.id === id) ?? null, b = next.find(n => n.id === id) ?? null
    const keys = !a || !b ? ["existence"] : [...new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])].filter(k => !same(a.fields[k], b.fields[k]))
    if (a && b && a.parent !== b.parent) keys.push("parent")
    if (a && b && a.order !== b.order) keys.push("order")
    return keys.length ? [{ id, before: a, after: b, keys, adopts: false, places: false }] : []
  })
}
function projection(history: History): Deck {
  const tree = new Map(nodes(history.initial).map(n => [n.id, structuredClone(n)]))
  for (const event of history.events) {
    if (!event.active) continue
    for (const patch of event.patches) {
      if (!patch.after) { tree.delete(patch.id); continue }
      let node = tree.get(patch.id)
      if (!node) { if (!patch.adopts && !patch.keys.includes("existence")) continue; node = structuredClone(patch.after); tree.set(patch.id, node) }
      for (const key of patch.keys) {
        if (key === "existence") tree.set(patch.id, structuredClone(patch.after))
        else if (key === "parent") node.parent = patch.after.parent
        else if (key === "order") node.order = patch.after.order
        else if (key in patch.after.fields) node.fields[key] = patch.after.fields[key] ?? null
        else delete node.fields[key]
      }
    }
    for (const patch of event.patches) if (patch.places && patch.after && patch.keys.some(key => key === "parent" || key === "order")) {
      const node = tree.get(patch.id)
      if (!node) continue
      const siblings = [...tree.values()].filter(other => other.parent === node.parent && other.id !== node.id).sort((a,b) => a.order-b.order || a.id.localeCompare(b.id))
      siblings.splice(Math.min(patch.after.order,siblings.length),0,node)
      siblings.forEach((sibling,index) => { sibling.order=index })
    }
  }
  return materialize([...tree.values()], history.initial.id, history.seq)
}
function materialize(list: Node[], deckId: Id, seq: number): Deck {
  const tree = new Map(list.map(n => [n.id,n]))
  const reached = new Set<Id>()
  function build(node: Node, visited: Set<Id>): Json {
    if (visited.has(node.id)) throw new Error("history-cycle")
    reached.add(node.id)
    const children = [...tree.values()].filter(n => n.parent === node.id).sort((a,b) => a.order - b.order || a.id.localeCompare(b.id))
    const value: { [key: string]: Json } = { ...node.fields, id: node.id }
    const next = new Set([...visited, node.id])
    if (node.parent === null) { value.version = seq; value.slides = children.map(n => build(n, next)) }
    else if ("size" in node.fields) { value.version = seq; value.elements = children.map(n => build(n, next)) }
    else if (node.fields.kind === "group") value.children = children.map(n => build(n, next))
    return value
  }
  const root = tree.get(deckId)
  if (!root) throw new Error("missing-deck")
  const deck = parseDeck(build(root, new Set()))
  if (reached.size !== tree.size) throw new Error("unreachable-history-node")
  return deck
}
export function execute(current: History, command: Command): { history: History; receipt: Receipt } {
  const history = structuredClone(current)
  const refuse = (code: string) => {
    const targets=command.kind==="patch" ? [command.target] : command.kind==="edit" ? command.changes.changes.flatMap(change=>"target" in change ? [change.target] : []) : []
    const deletion=current.events.findLast(event=>event.active && event.patches.some(patch=>patch.after===null && targets.includes(patch.id)))
    return { history: current, receipt: { id: command.id, seq: current.seq, kind: "refused", code, command, ...(code==="invalid-reference" && deletion ? {restore:deletion.id} : {}) } satisfies Receipt }
  }
  const run = "run" in command ? history.runs.find(r => r.id === command.run) : undefined
  switch (command.kind) {
    case "start-run":
      if (run) return refuse("run-id-reused")
      history.runs.push({ id: command.run, epoch: history.seq, kind: "open" })
      break
    case "close-run":
      if (!run || run.kind !== "open") return refuse("run-closed")
      run.kind = "closed"
      break
    case "edit":
    case "patch": {
      if (command.run !== null && (!run || run.kind !== "open")) return refuse("run-closed")
      let changes: ChangeSet
      if (command.kind === "patch") {
        const node = nodes(history.deck).find(n => n.id === command.target)
        if (!node) return refuse("invalid-reference")
        if (Object.keys(command.fields).some(key => ["id", "version", "slides", "elements", "children", "parent", "order", "kind"].includes(key))) return refuse("invalid-patch-field")
        const tree = nodes(history.deck)
        const target = tree.find(n => n.id === command.target)
        if (!target) return refuse("invalid-reference")
        Object.assign(target.fields, command.fields)
        let desired: Deck
        try { desired = materialize(tree, history.initial.id, history.seq) } catch { return refuse("invalid-data") }
        changes = { changes: [{ kind: "set", target: history.deck.id, value: desired }] }
      } else changes = command.changes
      const applied = apply(history.deck, changes)
      if (!applied.ok) return refuse(applied.error.code)
      const delta = patches(history.deck, applied.deck).map(patch => ({...patch,places:changes.changes.some(change => change.kind === "move" && change.target === patch.id),adopts:command.run === null && (patch.keys.some(key => key !== "order") || changes.changes.some(change => change.kind === "move" && change.target === patch.id))}))
      if (delta.some(p => !p.before && history.usedIds.includes(p.id))) return refuse("node-id-reused")
      if (command.run !== null) {
        for (const event of history.events) for (const old of event.patches) for (const patch of delta) {
          const conflict = old.id === patch.id && old.keys.some(k => patch.keys.includes(k) || k === "existence" || patch.keys.includes("existence"))
          if (conflict && Math.max(event.seq,event.toggledAt) > command.base) return refuse("stale-base")
          if (event.actor === "person" && old.adopts && old.id === patch.id && Math.max(event.seq,event.toggledAt) > (run?.epoch ?? -1)) return refuse("person-protected")
        }
      }
      history.deck = applied.deck
      history.events.push({ id: command.id, seq: history.seq + 1, actor: command.run === null ? "person" : "agent", run: command.run, patches: delta, active: true, toggledAt: history.seq + 1 })
      history.usedIds.push(...delta.filter(p => !p.before).map(p => p.id))
      break
    }
    case "undo-run":
      if (!run || run.kind === "undone") return refuse("run-closed")
      run.kind = "undone"
      for (const event of history.events) if (event.run === run.id) { event.active = false; event.toggledAt = history.seq + 1 }
      break
    case "undo":
    case "redo": {
      const event = history.events.find(e => e.id === command.target)
      if (!event || event.active === (command.kind === "redo")) return refuse("invalid-undo-target")
      if (command.kind === "redo" && history.events.some(e => e.id !== event.id && Math.max(e.seq,e.toggledAt) > event.toggledAt && e.patches.some(p => event.patches.some(q => q.id === p.id && q.keys.some(k => p.keys.includes(k)))))) return refuse("redo-invalidated")
      event.active = command.kind === "redo"
      event.toggledAt = history.seq + 1
      break
    }
    default: { const exhaustive: never = command; return exhaustive }
  }
  history.seq++
  try { if (command.kind === "undo" || command.kind === "redo" || command.kind === "undo-run") history.deck = projection(history) } catch { return refuse("undo-structure-conflict") }
  history.deck.version=history.seq
  return { history, receipt: { id: command.id, kind: "applied", seq: history.seq } }
}
