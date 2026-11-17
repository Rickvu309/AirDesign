import path from "node:path"
import { fileURLToPath } from "node:url"
import { readDeckId } from "@airdesign/catalog"
import {
  decide,
  elementGone,
  elementId,
  elementsUndoable,
  redoOf,
  slideId,
  undoOf,
  type ElementId,
  type SlideCommand,
  type Undoable,
} from "@airdesign/document"
import { call, indexDeck, openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/multi-step/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Held = { readonly deck: Deck; readonly undoable: Undoable | null }
type Answer = { readonly ok: true; readonly deck: Deck } | { readonly ok: false; readonly refusal: string }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const parsed = readDeckId("multi-step-replay")
if (!parsed.ok) throw new Error("deck")
const deck = parsed.deck
const slide = slideId("256")
const file = [slide]
const nodes = { A: elementId("256.2"), B: elementId("256.3") } as const
const names = ["A", "B"] as const
const person = { actor: "person" } as const
const box = { x: 0, y: 0, cx: 1000, cy: 500 }

function opened(locked: boolean): Deck {
  const size = { width: 12_192_000, height: 6_858_000 }
  const page = {
    deck,
    once: "index",
    offset: 0,
    total: 2,
    slides: [{ id: "256", position: 0, size, free: 4, animated: locked ? ["2"] : [], layout: [] }],
    elements: names.map((name) => ({ node: nodes[name], kind: "shape", value: name, box, grouped: false })),
  }
  const result = indexDeck(openDeck(deck), person, page)
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function removal(node: ElementId): Extract<SlideCommand, { readonly slide: "element-remove" }> {
  return { slide: "element-remove", id: slide, node }
}

function shown(current: Deck): readonly ElementId[] {
  return names.map((name) => nodes[name]).filter((node) => !elementGone(current.register, node))
}

function committed(current: Deck, edits: readonly SlideCommand[]): Answer {
  return call("commit_edits", current, person, { deck, batch: edits.map((edit) => ({ ...edit, file })) })
}

function deleted(current: Deck): { readonly answer: Answer | "told"; readonly undoable: Undoable | null } {
  const undoable = elementsUndoable(current.register, file, shown(current).map(removal))
  if (undoable === null || !("elements" in undoable)) return { answer: "told", undoable: null }
  return {
    answer: committed(
      current,
      undoable.elements.map(({ node }) => removal(node)),
    ),
    undoable,
  }
}

function turned(current: Deck, undoable: Undoable | null, action: string) {
  if (undoable === null) throw new Error(`${action} with no step`)
  const turn = action === "Undo" ? undoOf(current.register, undoable) : redoOf(current.register, undoable)
  if (!turn.ok) return { answer: "told" as const, undoable }
  const edits = turn.commands.map((command) => {
    if (command.command !== "slide") throw new Error("slide")
    return command.edit
  })
  return { answer: committed(current, edits), undoable: turn.undoable }
}

function agentWrote(current: Deck, node: ElementId): Answer {
  const runId = `write-${current.revision}`
  const caller = { actor: "agent", runId } as const
  const started = call("start_run", current, caller, { deck, runId, elements: [{ node }] })
  if (!started.ok) return started
  const readAt = started.deck.register.elements[node]?.readAt ?? 0
  const changes = [{ node, value: "Aira", readAt }]
  const wrote = call("edit_deck", started.deck, caller, { deck, base: started.deck.revision, changes })
  if (!wrote.ok) return wrote
  return call("stop_run", wrote.deck, caller, { deck, runId })
}

function act(held: Held, action: string, target: Spec) {
  if (action === "Delete") return deleted(held.deck)
  if (action === "Undo" || action === "Redo") return turned(held.deck, held.undoable, action)
  const on = target.agentOn
  if (on !== "A" && on !== "B") throw new Error(`${action} on nothing`)
  if (action === "AgentWrite") return { answer: agentWrote(held.deck, nodes[on]), undoable: held.undoable }
  if (action !== "AgentDelete") throw new Error(`${action} is not connected`)
  const caller = { actor: "agent", runId: `delete-${held.deck.revision}` } as const
  const answer = call("edit_deck", held.deck, caller, {
    deck,
    base: held.deck.revision,
    changes: [{ op: "delete", node: nodes[on] }],
  })
  return { answer, undoable: held.undoable }
}

function named(undoable: Undoable | null): readonly ElementId[] {
  return undoable !== null && "elements" in undoable ? undoable.elements.map(({ node }) => node) : []
}

function refusedLocked(current: Deck, node: ElementId): boolean {
  const decision = decide(current.register, { command: "slide", file, edit: removal(node) })
  return decision.decision === "refuse" && decision.code === "locked"
}

function wanted(spec: Spec, key: string): readonly ElementId[] {
  return names.filter((name) => spec[`${key}${name}`] === true).map((name) => nodes[name])
}

function judged(source: Spec, target: Spec, action: string, held: Held, after: Held, failures: string[]) {
  const said = `multi-step ${view.group(source)}: ${view.state(source)} -${action}-> ${view.group(target)}: ${view.state(target)}`
  if (JSON.stringify(shown(after.deck)) !== JSON.stringify(wanted(target, "shown")))
    failures.push(`${said}\n  shows ${JSON.stringify(shown(after.deck))}`)
  const stepped = target.held === "undo" || target.held === "redo"
  if (stepped && JSON.stringify(named(after.undoable)) !== JSON.stringify(wanted(target, "named")))
    failures.push(`${said}\n  the step names ${JSON.stringify(named(after.undoable))}`)
  if (
    action === "Delete" &&
    target.refusedA !== (shown(held.deck).includes(nodes.A) && refusedLocked(held.deck, nodes.A))
  )
    failures.push(`${said}\n  the device and the model disagree on refusing A`)
}

function initialOf(graph: Graph, locked: boolean): string {
  const found = [...graph.states].find(
    ([, state]) =>
      state.lockedA === locked &&
      state.turns === 0 &&
      state.held === "empty" &&
      state.agent === "idle" &&
      state.refusedA === false &&
      state.shownA === true &&
      state.shownB === true,
  )
  if (found === undefined) throw new Error("no initial state")
  return found[0]
}

function replayed(graph: Graph, failures: string[]) {
  const reached = new Map<string, Held>()
  for (const locked of [false, true]) reached.set(initialOf(graph, locked), { deck: opened(locked), undoable: null })
  const queue = [...reached.keys()]
  let told = 0
  let edges = 0
  while (queue.length > 0) {
    const from = queue.shift()
    const held = from === undefined ? undefined : reached.get(from)
    const source = from === undefined ? undefined : graph.states.get(from)
    if (from === undefined || held === undefined || source === undefined) throw new Error("state")
    for (const edge of graph.edges.filter((each) => each.from === from)) {
      const target = graph.states.get(edge.to)
      if (target === undefined) throw new Error("target")
      const dropped = target.held === "dropped" && source.held !== "dropped"
      const nothing = edge.action === "Delete" && target.held === "empty"
      const { answer, undoable } = act(held, edge.action, target)
      edges += 1
      if (answer === "told") {
        if (dropped || nothing) told += 1
        else failures.push(`multi-step ${edge.action} from ${view.state(source)} was told nothing changed`)
        if (!reached.has(edge.to)) {
          reached.set(edge.to, { deck: held.deck, undoable: null })
          queue.push(edge.to)
        }
        continue
      }
      if (dropped || nothing) {
        failures.push(`multi-step ${edge.action} from ${view.state(source)} landed where the spec tells the person`)
        continue
      }
      if (!answer.ok) {
        failures.push(`multi-step ${edge.action} from ${view.state(source)} refused ${answer.refusal}`)
        continue
      }
      const after = { deck: answer.deck, undoable }
      judged(source, target, edge.action, held, after, failures)
      if (!reached.has(edge.to)) {
        reached.set(edge.to, after)
        queue.push(edge.to)
      }
    }
  }
  for (const [id, state] of graph.states)
    if (!reached.has(id)) failures.push(`multi-step state ${view.state(state)} was not reached`)
  return { states: graph.states.size, edges, told }
}

describe("multi-step replay", () => {
  it("drives every edge of a Delete of two elements, its undo and redo, through the engine", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "multi-step")
    if (spec === undefined) throw new Error("no multi-step spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const report = replayed(graph, failures)
    expect(failures, JSON.stringify(report)).toEqual([])
    expect(report.edges).toBe(graph.edges.length)
    expect(report.told).toBeGreaterThan(0)
  }, 60_000)
})
