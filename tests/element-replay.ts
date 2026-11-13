import { readDeckId } from "@airdesign/catalog"
import {
  addedPictures,
  changedTable,
  elementId,
  nextElementId,
  openingTable,
  readSlideId,
  redoOf,
  slideId,
  undoOf,
  writeTableValue,
  type Register,
  type Undoable,
} from "@airdesign/document"
import { call, indexDeck, openDeck, readDeckPage, type Deck } from "@airdesign/engine"
import type { Graph } from "./spec-graph.js"

const parsed = readDeckId("element-replay")
if (!parsed.ok) throw new Error("deck")
const deck = parsed.deck
const node = elementId("256.9")
const file = ["256"]
const box = { x: 0, y: 0, cx: 1000, cy: 500 }
const opening = openingTable(2, 2)
const grown = changedTable(changedTable(opening, { change: "cell", row: 0, column: 0, text: "Typed" })!, {
  change: "row",
  row: 1,
  place: "below",
})!
const kinds = {
  box: { element: { node, kind: "shape", value: "", box, grouped: false }, typed: "Typed" },
  shape: { element: { node, kind: "shape", value: null, box, grouped: false }, geometry: "ellipse", typed: null },
  table: {
    element: { node, kind: "table", value: writeTableValue(opening), box, grouped: false },
    typed: writeTableValue(grown),
  },
}
let kind: keyof typeof kinds = "box"
const media = { sha256: "d".repeat(64), type: "image/png" }
const picture = { node, kind: "picture", value: null, box, grouped: false }
const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
type Spec = Graph["states"] extends Map<string, infer State> ? State : never

function typedValue(state: Spec): string {
  return state.run === "add" || state.run === "both" ? "Typed" : (kinds[kind].typed ?? "Typed")
}

function holdsNoText(state: Spec): boolean {
  return kinds[kind].typed === null && state.run !== "add" && state.run !== "both"
}

function batch(source: Spec, action: string): unknown {
  if (action === "Add") {
    const shape = kinds[kind]
    const geometry = "geometry" in shape ? { geometry: shape.geometry } : {}
    return { slide: "element-add", id: "256", element: shape.element, ...geometry, file }
  }
  if (action === "AddPicture") return { slide: "element-add", id: "256", element: picture, media, file }
  if (action === "Type") return { node, value: typedValue(source) }
  if (action === "OtherRestore") return { slide: "element-restore", id: "256", node, file }
  return { slide: "element-remove", id: "256", node, file }
}

const unchanged = new Set(["Upload", "ExportElsewhere"])

function exportable(register: Register, uploaded: boolean): boolean {
  return addedPictures(register).every((each) => uploaded && each.sha256 === media.sha256)
}
const refusedBy: Record<string, string> = { AgentRemoveRefused: "person-protected", UndoRunRefused: "run-fenced" }
type Answer = ReturnType<typeof call> | "told"

function opened(): Deck {
  const size = { width: 12_192_000, height: 6_858_000 }
  const page = {
    deck,
    once: "index",
    offset: 0,
    total: 0,
    slides: [{ id: "256", position: 0, size, free: 9, animated: [] }],
    elements: [],
  }
  const result = indexDeck(openDeck(deck), person, page)
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function turned(current: Deck, source: Spec, action: string): Answer {
  const added = source.kind === "add"
  const undoable: Undoable = {
    element: node,
    slide: slideId("256"),
    file: [slideId("256")],
    before: !added,
    after: added,
  }
  const turn = action === "Undo" ? undoOf(current.register, undoable) : redoOf(current.register, undoable)
  if (!turn.ok) return "told"
  if (turn.command.command !== "slide") throw new Error("slide")
  const batch = [{ ...turn.command.edit, file: turn.command.file }]
  return call("commit_edits", current, person, { deck, batch })
}

function act(current: Deck, source: Spec, action: string): Answer {
  if (action === "Undo" || action === "Redo") return turned(current, source, action)
  if (action === "AgentAdd") {
    return call("add_text_box", current, agent, { deck, base: current.revision, slide: "256", box })
  }
  if (action === "AgentRemove" || action === "AgentRemoveRefused") {
    return call("delete_element", current, agent, { deck, base: current.revision, node })
  }
  if (action === "UndoRun" || action === "UndoRunRefused")
    return call("undo_run", current, person, { deck, runId: "run" })
  return call("commit_edits", current, person, { deck, batch: [batch(source, action)] })
}

function shown(current: Deck, state: Spec): { readonly added: boolean; readonly typed: boolean } | null {
  const read = readDeckPage(current, { runId: null }).elements.find((each) => each.node === node)
  return read === undefined ? null : { added: true, typed: read.value === typedValue(state) }
}

function initialId(graph: Graph): string {
  const found = [...graph.states].find(
    ([, state]) => state.added === false && state.run === "none" && state.last === "none" && state.exported === false,
  )
  if (found === undefined) throw new Error("no initial state")
  return found[0]
}

function reached(graph: Graph, failures: string[]): Map<string, Deck> {
  const decks = new Map<string, Deck>([[initialId(graph), opened()]])
  const queue = [...decks.keys()]
  while (queue.length > 0) {
    const from = queue.shift()
    const current = from === undefined ? undefined : decks.get(from)
    const source = from === undefined ? undefined : graph.states.get(from)
    if (from === undefined || current === undefined || source === undefined) throw new Error("state")
    for (const edge of graph.edges) {
      if (edge.from !== from || decks.has(edge.to)) continue
      if (unchanged.has(edge.action)) {
        decks.set(edge.to, current)
        queue.push(edge.to)
        continue
      }
      const answer = act(current, source, edge.action)
      const refused = answer === "told" || !answer.ok
      if (refused && refusedBy[edge.action] === undefined && answer !== "told") continue
      decks.set(edge.to, answer === "told" || !answer.ok ? current : answer.deck)
      queue.push(edge.to)
    }
  }
  for (const [id, state] of graph.states) {
    if (decks.has(id) || (state.typed === true && holdsNoText(state))) continue
    failures.push(`element state ${JSON.stringify(state)} was not reached`)
  }
  return decks
}

export function replayElement(graph: Graph, failures: string[]) {
  let told = 0
  for (const each of ["box", "shape", "table"] as const) {
    kind = each
    told += replayKind(graph, failures)
  }
  if (graph.edges.length === 0 || told === 0) failures.push("element replay drove no edge where the person is told")
  return { states: graph.states.size, edges: graph.edges.length, told }
}

function replayKind(graph: Graph, failures: string[]): number {
  let told = 0
  const decks = reached(graph, failures)
  for (const edge of graph.edges) {
    const target = graph.states.get(edge.to)
    const source = graph.states.get(edge.from)
    const current = decks.get(edge.from)
    if (source === undefined || target === undefined || current === undefined) continue
    if (edge.action === "Upload") {
      if (addedPictures(current.register).length !== 1) failures.push("element Upload has no picture to send")
      continue
    }
    if (edge.action === "ExportElsewhere") {
      if (!exportable(current.register, source.uploaded === true))
        failures.push("element ExportElsewhere refused a deck whose pictures all uploaded")
      continue
    }
    const answer = act(current, source, edge.action)
    if (edge.action === "Type" && holdsNoText(source)) {
      if (answer === "told" || answer.ok || answer.refusal !== "kind")
        failures.push(`element ${kind} Type on a drawn shape was not refused kind ${JSON.stringify(source)}`)
      continue
    }
    const refusal = refusedBy[edge.action]
    if (refusal !== undefined) {
      if (answer === "told" || answer.ok || answer.refusal !== refusal) {
        failures.push(
          `element ${edge.action} was not refused ${refusal} from ${JSON.stringify(source)} ${JSON.stringify(answer)}`,
        )
      } else told += 1
      continue
    }
    const dropped = target.held === "dropped" && source.held !== "dropped"
    if (answer === "told") {
      if (dropped) told += 1
      else failures.push(`element ${kind} ${edge.action} was refused`)
      continue
    }
    if (dropped) {
      failures.push(`element ${edge.action} landed where the spec tells the person nothing changed`)
      continue
    }
    if (!answer.ok) {
      failures.push(`element ${kind} ${edge.action} refused ${answer.refusal} from ${JSON.stringify(source)}`)
      continue
    }
    const expected = target.added === true && target.removed !== true ? { added: true, typed: target.typed } : null
    if (JSON.stringify(shown(answer.deck, target)) !== JSON.stringify(expected))
      failures.push(`element ${kind} ${edge.action} reads ${JSON.stringify(shown(answer.deck, target))}`)
  }
  const slide = readSlideId("256")
  if (slide === undefined) throw new Error("slide")
  for (const [id, state] of graph.states) {
    const current = decks.get(id)
    if (current === undefined) continue
    if (state.added === true && nextElementId(current.register, slide, 9) === node) {
      failures.push("element id handed out again after it was added")
    }
    const forbidden =
      state.removed === true
        ? ["Add", "AddPicture", "Type", "Remove", "AgentRemove"]
        : state.added === true
          ? ["Add", "AddPicture", "OtherRestore", ...(state.picture === true ? ["Type"] : [])]
          : ["OtherRestore"]
    if (state.added === true) {
      const another = call(
        "add_text_box",
        current,
        { actor: "agent", runId: "next" },
        {
          deck,
          base: current.revision,
          slide: "256",
          box,
        },
      )
      const order = another === "told" || !another.ok ? [] : another.deck.register.order
      const last = order.at(-1)
      if (last?.slide !== "element-add" || last.element.node === node) {
        failures.push(`element AgentAdd reused the id of a box already added ${JSON.stringify(state)}`)
      }
    }
    for (const action of forbidden) {
      const answer = act(current, state, action)
      if (answer !== "told" && answer.ok && !(action === "AgentRemove" && state.removed !== true))
        failures.push(`element ${action} lands where the spec forbids it ${JSON.stringify(state)}`)
    }
    if (state.picture === true && state.uploaded !== true && exportable(current.register, false))
      failures.push("element ExportElsewhere lands without the picture's bytes")
  }
  return told
}
