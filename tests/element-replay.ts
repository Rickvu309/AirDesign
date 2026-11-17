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
  slideUndoable,
  takes,
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
const wroteTable = writeTableValue(changedTable(opening, { change: "cell", row: 0, column: 0, text: "Aira" })!)
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
const personSteps = new Set(["Add", "AddPicture", "Remove"])
type Answer = ReturnType<typeof call> | "told"
type Held = { readonly deck: Deck; readonly undoable: Undoable | null }

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

function turned(current: Deck, undoable: Undoable | null, action: string): Answer {
  if (undoable === null) throw new Error(`${action} with no step`)
  const turn = action === "Undo" ? undoOf(current.register, undoable) : redoOf(current.register, undoable)
  const [command] = turn.ok ? turn.commands : []
  if (command === undefined) return "told"
  if (command.command !== "slide") throw new Error("slide")
  const batch = [{ ...command.edit, file: command.file }]
  return call("commit_edits", current, person, { deck, batch })
}

function agentWrote(current: Deck): Answer {
  const runId = `write-${current.revision}`
  const caller = { actor: "agent", runId } as const
  const started = call("start_run", current, caller, { deck, runId, elements: [{ node }] })
  if (!started.ok) return started
  const readAt = started.deck.register.elements[node]?.readAt ?? 0
  const change =
    kind === "table"
      ? { op: "set", target: node, table: { value: wroteValue() } }
      : { node, value: wroteValue(), readAt }
  const wrote = call("edit_deck", started.deck, caller, { deck, base: started.deck.revision, changes: [change] })
  if (!wrote.ok) return wrote
  return call("stop_run", wrote.deck, caller, { deck, runId })
}

function writeUndone(current: Deck): Answer {
  const row = current.register.elements[node]?.landed.find((each) => each.actor === "agent" && each.visible)
  if (row?.runId === undefined) throw new Error("no agent row to undo")
  return call("undo_run", current, person, { deck, runId: row.runId })
}

function act(current: Deck, source: Spec, action: string, undoable: Undoable | null = null): Answer {
  if (action === "Undo" || action === "Redo") return turned(current, undoable, action)
  if (action === "AgentWrite") return agentWrote(current)
  if (action === "UndoWrite") return writeUndone(current)
  if (action === "AgentAdd") {
    return call("edit_deck", current, agent, {
      deck,
      base: current.revision,
      changes: [{ op: "add", kind: "shape", slide: "256", box: { x: 0, y: 0, w: box.cx / 12700, h: box.cy / 12700 } }],
    })
  }
  if (action === "AgentRemove" || action === "AgentRemoveRefused") {
    return call("edit_deck", current, agent, { deck, base: current.revision, changes: [{ op: "delete", node }] })
  }
  if (action === "UndoRun" || action === "UndoRunRefused")
    return call("undo_run", current, person, { deck, runId: "run" })
  return call("commit_edits", current, person, { deck, batch: [batch(source, action)] })
}

function wroteValue(): string {
  return kind === "table" ? wroteTable : "Aira"
}

function shown(current: Deck, state: Spec) {
  const read = readDeckPage(current, { runId: null }).elements.find((each) => each.node === node)
  if (read === undefined) return null
  const shows = read.value === typedValue(state) ? "typed" : read.value === wroteValue() ? "aira" : "opening"
  const rows = current.register.elements[node]?.landed ?? []
  return { added: true, shows, agent: rows.some((row) => row.actor === "agent" && row.visible) }
}

function heldAfter(from: Held, answer: Answer, action: string): Held {
  if (answer === "told" || !answer.ok) return from
  if (!personSteps.has(action)) return { deck: answer.deck, undoable: from.undoable }
  const edit = answer.deck.register.order.at(-1)
  if (edit === undefined) throw new Error(`${action} landed no slide edit`)
  return { deck: answer.deck, undoable: slideUndoable(from.deck.register, [slideId("256")], edit) }
}

function initialId(graph: Graph): string {
  const found = [...graph.states].find(
    ([, state]) => state.added === false && state.run === "none" && state.last === "none" && state.exported === false,
  )
  if (found === undefined) throw new Error("no initial state")
  return found[0]
}

function reached(graph: Graph, failures: string[]): Map<string, Held> {
  const decks = new Map<string, Held>([[initialId(graph), { deck: opened(), undoable: null }]])
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
      const answer = act(current.deck, source, edge.action, current.undoable)
      const refused = answer === "told" || !answer.ok
      if (refused && refusedBy[edge.action] === undefined && answer !== "told") continue
      decks.set(edge.to, heldAfter(current, answer, edge.action))
      queue.push(edge.to)
    }
  }
  for (const [id, state] of graph.states) {
    if (decks.has(id) || ((state.typed === true || state.agent !== "none") && holdsNoText(state))) continue
    failures.push(`element state ${JSON.stringify(state)} was not reached`)
  }
  return decks
}

function takenByKind(failures: string[]): void {
  const facts = { grouped: false, animated: false }
  const taken = {
    box: takes({ ...facts, kind: "shape", text: true }),
    shape: takes({ ...facts, kind: "shape", text: false }),
    table: takes({ ...facts, kind: "table", text: true }),
    picture: takes({ ...facts, kind: "picture", text: false }),
  }
  const values = ["text.value", "notes.value", "table.value"]
  if (!taken.box.includes("text.value")) failures.push("element TraitTakenByKind: a text box takes no text")
  if (!taken.table.includes("table.value")) failures.push("element TraitTakenByKind: a table takes no table value")
  if (taken.shape.includes("text.value"))
    failures.push("element TraitTakenByKind: a shape with no text body takes text")
  if (taken.picture.some((field) => values.includes(field)))
    failures.push("element TraitTakenByKind: a picture takes a text or table value")
}

export function replayElement(graph: Graph, failures: string[]) {
  takenByKind(failures)
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
    const held = decks.get(edge.from)
    if (source === undefined || target === undefined || held === undefined) continue
    const current = held.deck
    if (edge.action === "Upload") {
      if (addedPictures(current.register).length !== 1) failures.push("element Upload has no picture to send")
      continue
    }
    if (edge.action === "ExportElsewhere") {
      if (!exportable(current.register, source.uploaded === true))
        failures.push("element ExportElsewhere refused a deck whose pictures all uploaded")
      continue
    }
    const answer = act(current, source, edge.action, held.undoable)
    if ((edge.action === "Type" || edge.action === "AgentWrite") && holdsNoText(source)) {
      if (answer === "told" || answer.ok || answer.refusal !== "kind")
        failures.push(`element ${kind} ${edge.action} on a drawn shape was not refused kind ${JSON.stringify(source)}`)
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
    const shows = { added: true, shows: target.shows, agent: target.agent === "before" || target.agent === "since" }
    const expected = target.added === true && target.removed !== true ? shows : null
    if (JSON.stringify(shown(answer.deck, target)) !== JSON.stringify(expected))
      failures.push(`element ${kind} ${edge.action} reads ${JSON.stringify(shown(answer.deck, target))}`)
  }
  const slide = readSlideId("256")
  if (slide === undefined) throw new Error("slide")
  for (const [id, state] of graph.states) {
    const current = decks.get(id)?.deck
    if (current === undefined) continue
    if (state.added === true && nextElementId(current.register, slide, 9) === node) {
      failures.push("element id handed out again after it was added")
    }
    const forbidden =
      state.removed === true
        ? ["Add", "AddPicture", "Type", "Remove", "AgentRemove", "AgentWrite"]
        : state.added === true
          ? ["Add", "AddPicture", "OtherRestore", ...(state.picture === true ? ["Type", "AgentWrite"] : [])]
          : ["OtherRestore", "AgentWrite"]
    if (state.added === true) {
      const another = call(
        "edit_deck",
        current,
        { actor: "agent", runId: "next" },
        {
          deck,
          base: current.revision,
          changes: [
            { op: "add", kind: "shape", slide: "256", box: { x: 0, y: 0, w: box.cx / 12700, h: box.cy / 12700 } },
          ],
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
