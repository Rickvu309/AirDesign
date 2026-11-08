import type {Id} from "../../../deck/src/model.ts"
import {parseNativeArchiveV3, type NativeDeck} from "../../../deck/src/text/native-v3.ts"
import {parseNativeChangeSet, type NativeChangeSet, type NativeValue} from "../../../deck/src/text/operations.ts"
import {executeWithModel, materializeNodes, type Command, type ExecutionIdentity, type History, type HistoryModel, type Node} from "../index.ts"
import {materializeTextBody, textBodyNodes} from "./body-nodes.ts"

export function nativeNodes(value: NativeValue, parent: Id | null = null, order = 0): Node[] {
  const fields: Node["fields"] = {}
  const source: Record<string, import("../index.ts").Json | undefined> = value
  for (const [key, field] of Object.entries(source)) if (field !== undefined && !["id", "version", "slides", "elements", "children", "body"].includes(key)) fields[key] = field
  const node = {id: value.id, parent, order, fields}
  if ("body" in value) return [node, ...textBodyNodes(value.id, value.body)]
  const children = "slides" in value ? value.slides : "elements" in value ? value.elements : value.kind === "group" ? value.children : []
  return [node, ...children.flatMap((child, index) => nativeNodes(child, value.id, index))]
}
function decode(value: unknown): NativeDeck { return parseNativeArchiveV3({version: 3, deck: value}).deck }
function materialize(list: Node[], id: Id, seq: number): NativeDeck {
  const deck = materializeNodes(list, id, seq, decode, materializeTextBody)
  const ids = new Set(list.map(node => node.id)), themes = new Set<string>(deck.themes.map(theme => theme.id))
  for (const node of list) {
    if (node.parent !== null && !ids.has(node.parent)) throw new Error("invalid-native-parent")
    if (typeof node.fields.theme === "string" && !themes.has(node.fields.theme)) throw new Error("invalid-theme-reference")
    if (typeof node.fields.placeholder === "string" && !deck.placeholders?.some(id => id === node.fields.placeholder)) throw new Error("invalid-placeholder-reference")
    if (typeof node.fields.overlap === "string" && !deck.overlaps?.some(id => id === node.fields.overlap)) throw new Error("invalid-overlap-reference")
  }
  return deck
}
function applyNative(deck: NativeDeck, input: NativeChangeSet): ReturnType<HistoryModel<NativeDeck, NativeChangeSet>["apply"]> {
  try {
    const changes = parseNativeChangeSet(input)
    let tree = nativeNodes(deck)
    function subtree(id: Id): Set<Id> {
      const found = new Set<Id>()
      function visit(target: Id) {
        if (found.has(target)) throw new Error("history-cycle")
        found.add(target)
        tree.filter(node => node.parent === target).forEach(node => visit(node.id))
      }
      visit(id)
      return found
    }
    function reorder(parent: Id | null) { tree.filter(node => node.parent === parent).sort((a,b) => a.order-b.order).forEach((node,index) => {node.order=index}) }
    for (const change of changes.changes) {
      if (change.kind === "set") {
        const target = tree.find(node => node.id === change.target)
        if (!target || change.value.id !== target.id) throw new Error("invalid-reference")
        const removed = subtree(target.id)
        const replacement = nativeNodes(change.value, target.parent, target.order)
        tree = [...tree.filter(node => !removed.has(node.id)), ...replacement]
      } else if (change.kind === "remove") {
        const target = tree.find(node => node.id === change.target)
        if (!target || target.parent === null || target.fields.kind === "text-frame") throw new Error("invalid-reference")
        const removed = subtree(target.id)
        tree = tree.filter(node => !removed.has(node.id)); reorder(target.parent)
      } else {
        const parent = tree.find(node => node.id === change.parent)
        if (!parent) throw new Error("invalid-reference")
        const target = change.kind === "move" ? tree.find(node => node.id === change.target) : undefined
        if (change.kind === "move" && (!target || subtree(target.id).has(parent.id))) throw new Error("invalid-reference")
        const added = change.kind === "insert" ? nativeNodes(change.value, parent.id, change.index) : target ? [target] : []
        const first = added[0]
        if (!first || first.fields.kind === "text-frame") throw new Error("invalid-structure")
        const paragraph = first.fields.kind === "paragraph"
        const slide = "size" in first.fields
        if (paragraph ? parent.fields.kind !== "text" || target && target.parent !== parent.id || change.index < 1 : slide ? parent.parent !== null : !("size" in parent.fields || parent.fields.kind === "group")) throw new Error("invalid-structure")
        const siblings = tree.filter(node => node.parent === parent.id && node.id !== target?.id).sort((a,b) => a.order-b.order)
        if (change.index > siblings.length) throw new Error("invalid-structure")
        if (target) { const previous = target.parent; tree = tree.filter(node => node.id !== target.id); reorder(previous) }
        first.parent=parent.id; siblings.splice(change.index,0,first); siblings.forEach((node,index) => {node.order=index})
        tree.push(...added)
      }
    }
    if (new Set(tree.map(node => node.id)).size !== tree.length) throw new Error("duplicate-node-id")
    const previous = nativeNodes(deck)
    for (const child of previous.filter(node => node.fields.kind === "text-frame" || node.fields.kind === "paragraph")) {
      const next = tree.find(node => node.id === child.id)
      if (next && (next.parent !== child.parent || next.fields.kind !== child.fields.kind)) throw new Error("text-node-identity-changed")
    }
    for (const text of previous.filter(node => node.fields.kind === "text")) if (tree.some(node => node.id === text.id && node.fields.kind === "text")) {
      const frame = previous.find(node => node.parent === text.id && node.fields.kind === "text-frame")
      if (!tree.some(node => node.id === frame?.id && node.parent === text.id && node.fields.kind === "text-frame")) throw new Error("text-frame-identity-changed")
    }
    return {ok: true, deck: materialize(tree, deck.id, deck.version + 1)}
  } catch (error) { return {ok: false, error: {code: error instanceof Error && error.message === "invalid-reference" ? "invalid-reference" : "invalid-data"}} }
}
export const nativeHistoryModel: HistoryModel<NativeDeck, NativeChangeSet> = {
  staleConflicts: "all",
  nodes: nativeNodes,
  materialize,
  replace: deck => ({changes: [{kind: "set", target: deck.id, value: deck}]}),
  apply: applyNative,
  projectionMetadata: (deck, history) => history.deck.version === history.seq ? {...deck, slides: deck.slides.map(slide => ({...slide, version: history.deck.slides.find(current => current.id === slide.id)?.version ?? slide.version}))} : deck,
  complete: (tree, history) => {
    const snapshots = [...nativeNodes(history.initial), ...history.events.flatMap(event => event.patches.flatMap(patch => patch.after ? [patch.after] : []))]
    for (const node of tree.values()) if (node.fields.kind === "text") {
      const children = [...tree.values()].filter(child => child.parent === node.id)
      for (const kind of ["text-frame", "paragraph"]) if (!children.some(child => child.fields.kind === kind)) {
        const child = snapshots.findLast(child => child.parent === node.id && child.fields.kind === kind)
        if (!child) throw new Error("missing-adopted-text-child")
        tree.set(child.id, structuredClone(child))
      }
      const ordered = [...tree.values()].filter(child => child.parent === node.id).sort((a,b) => Number(b.fields.kind === "text-frame") - Number(a.fields.kind === "text-frame") || a.order-b.order || a.id.localeCompare(b.id))
      ordered.forEach((child,index) => { child.order=index })
    }
  }
}
export function initialNativeHistory(deck: NativeDeck): History<NativeDeck> {
  const parsed = decode(deck)
  return {initial: parsed, deck: parsed, seq: 0, events: [], runs: [], usedIds: nativeNodes(parsed).map(node => node.id)}
}
export function executeNative(history: History<NativeDeck>, command: Command<NativeChangeSet>, identity: ExecutionIdentity = {kind: "person"}) {
  return executeWithModel(history, command, nativeHistoryModel, identity)
}
