import { readDeckId } from "@airdesign/catalog"
import { elementId, nextElementId, readSlideId, redoOf, slideId, undoOf, type Undoable } from "@airdesign/document"
import { call, openDeck, readDeckPage, type Deck } from "@airdesign/engine"
import type { Graph } from "./spec-graph.js"

const parsed = readDeckId("element-replay")
if (!parsed.ok) throw new Error("deck")
const deck = parsed.deck
const node = elementId("256.9")
const file = ["256"]
const element = { node, kind: "shape", value: "", box: { x: 0, y: 0, cx: 1000, cy: 500 }, grouped: false }
const batches: Record<string, unknown> = {
  Add: { slide: "element-add", id: "256", element, file },
  Type: { node, value: "Typed" },
  Remove: { slide: "element-remove", id: "256", node, file },
  OtherRemove: { slide: "element-remove", id: "256", node, file },
  OtherRestore: { slide: "element-restore", id: "256", node, file },
}

function act(current: Deck, action: string) {
  return call("commit_edits", current, { actor: "person" }, { deck, batch: [batches[action]] })
}

function landed(current: Deck, action: string): Deck {
  const answer = act(current, action)
  if (!answer.ok) throw new Error(`${action} ${answer.refusal}`)
  return answer.deck
}

function built(state: Record<string, unknown>): Deck {
  let current = openDeck(deck)
  if (state.added === true) current = landed(current, "Add")
  if (state.typed === true) current = landed(current, "Type")
  if (state.removed === true) current = landed(current, "Remove")
  return current
}

function shown(current: Deck): { readonly added: boolean; readonly typed: boolean } | null {
  const read = readDeckPage(current, { runId: null }).elements.find((each) => each.node === node)
  return read === undefined ? null : { added: true, typed: read.value === "Typed" }
}

function undoableOf(state: Record<string, unknown>): Undoable {
  const added = state.kind === "add"
  return { element: node, slide: slideId("256"), file: [slideId("256")], before: !added, after: added }
}

function turned(source: Record<string, unknown>, action: string) {
  const current = built(source)
  const undoable = undoableOf(source)
  const turn = action === "Undo" ? undoOf(current.register, undoable) : redoOf(current.register, undoable)
  if (!turn.ok) return "told"
  if (turn.command.command !== "slide") throw new Error("slide")
  const batch = [{ ...turn.command.edit, file: turn.command.file }]
  return call("commit_edits", current, { actor: "person" }, { deck, batch })
}

export function replayElement(graph: Graph, failures: string[]) {
  let told = 0
  for (const edge of graph.edges) {
    const target = graph.states.get(edge.to)
    const source = graph.states.get(edge.from)
    if (source === undefined || target === undefined) throw new Error("state")
    const turn = edge.action === "Undo" || edge.action === "Redo"
    const answer = turn ? turned(source, edge.action) : act(built(source), edge.action)
    const dropped = target.held === "dropped" && source.held !== "dropped"
    if (answer === "told") {
      if (dropped) told += 1
      else failures.push(`element ${edge.action} was refused`)
      continue
    }
    if (dropped) {
      failures.push(`element ${edge.action} landed where the spec tells the person nothing changed`)
      continue
    }
    if (!answer.ok) {
      failures.push(`element ${edge.action} refused ${answer.refusal}`)
      continue
    }
    const expected = target.added === true && target.removed !== true ? { added: true, typed: target.typed } : null
    if (JSON.stringify(shown(answer.deck)) !== JSON.stringify(expected))
      failures.push(`element ${edge.action} reads ${JSON.stringify(shown(answer.deck))}`)
  }
  const slide = readSlideId("256")
  if (slide === undefined) throw new Error("slide")
  for (const state of graph.states.values()) {
    if (state.added === true && nextElementId(built(state).register, slide, 9) === node) {
      failures.push("element id handed out again after it was added")
    }
    const forbidden =
      state.removed === true
        ? ["Add", "Type", "Remove"]
        : state.added === true
          ? ["Add", "OtherRestore"]
          : ["OtherRestore"]
    for (const action of forbidden) {
      if (act(built(state), action).ok) failures.push(`element ${action} lands where the spec forbids it`)
    }
  }
  if (graph.edges.length === 0 || told === 0) failures.push("element replay drove no edge where the person is told")
  return { states: graph.states.size, edges: graph.edges.length, told }
}
