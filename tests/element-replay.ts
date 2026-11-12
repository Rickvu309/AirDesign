import { readDeckId } from "@airdesign/catalog"
import { addedPictures, elementId, nextElementId, readSlideId, type Register } from "@airdesign/document"
import { call, openDeck, readDeckPage, type Deck } from "@airdesign/engine"
import type { Graph } from "./spec-graph.js"

const parsed = readDeckId("element-replay")
if (!parsed.ok) throw new Error("deck")
const deck = parsed.deck
const node = elementId("256.9")
const file = ["256"]
const element = { node, kind: "shape", value: "", box: { x: 0, y: 0, cx: 1000, cy: 500 }, grouped: false }
const media = { sha256: "d".repeat(64), type: "image/png" }
const picture = { ...element, kind: "picture", value: null }
const batches: Record<string, unknown> = {
  Add: { slide: "element-add", id: "256", element, file },
  AddPicture: { slide: "element-add", id: "256", element: picture, media, file },
  Type: { node, value: "Typed" },
  Remove: { slide: "element-remove", id: "256", node, file },
}

function act(current: Deck, action: string) {
  return call("commit_edits", current, { actor: "person" }, { deck, batch: [batches[action]] })
}

function landed(current: Deck, action: string): Deck {
  const answer = act(current, action)
  if (!answer.ok) throw new Error(`${action} ${answer.refusal}`)
  return answer.deck
}

const deckActions = new Set(["Add", "AddPicture", "Type", "Remove"])

function exportable(register: Register, uploaded: boolean): boolean {
  return addedPictures(register).every((each) => uploaded && each.sha256 === media.sha256)
}

function built(state: Record<string, unknown>): Deck {
  let current = openDeck(deck)
  if (state.added === true) current = landed(current, state.picture === true ? "AddPicture" : "Add")
  if (state.typed === true) current = landed(current, "Type")
  if (state.removed === true) current = landed(current, "Remove")
  return current
}

function shown(current: Deck): { readonly added: boolean; readonly typed: boolean } | null {
  const read = readDeckPage(current, { runId: null }).elements.find((each) => each.node === node)
  return read === undefined ? null : { added: true, typed: read.value === "Typed" }
}

export function replayElement(graph: Graph, failures: string[]) {
  for (const edge of graph.edges) {
    const target = graph.states.get(edge.to)
    const source = graph.states.get(edge.from)
    if (source === undefined || target === undefined) throw new Error("state")
    if (edge.action === "Upload") {
      if (addedPictures(built(source).register).length !== 1) failures.push("element Upload has no picture to send")
      continue
    }
    if (edge.action === "ExportElsewhere") {
      if (!exportable(built(source).register, source.uploaded === true))
        failures.push("element ExportElsewhere refused a deck whose pictures all uploaded")
      continue
    }
    const answer = act(built(source), edge.action)
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
        ? ["Add", "AddPicture", "Type", "Remove"]
        : state.added === true
          ? ["Add", "AddPicture"]
          : []
    for (const action of forbidden.filter((each) => deckActions.has(each))) {
      if (act(built(state), action).ok) failures.push(`element ${action} lands where the spec forbids it`)
    }
    if (state.picture === true && state.uploaded !== true && exportable(built(state).register, false))
      failures.push("element ExportElsewhere lands without the picture's bytes")
  }
  return { states: graph.states.size, edges: graph.edges.length }
}
