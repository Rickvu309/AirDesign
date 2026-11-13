import { createServer } from "node:http"

import type { DeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { afterAll, beforeAll, expect, it } from "vitest"

import {
  finish,
  indexedDeck,
  mcpSteps,
  revisionOf,
  slidesAddedBy,
  stepNode as node,
  wholeCall,
  type Call,
  type McpSteps,
  type Owned,
  type Stores,
} from "./mcp-steps.js"
import { postgresInfo } from "./harness.js"
import { openPool } from "./pool.js"
import { commitEdits, readSaved } from "./saved.js"
import { pathsFrom, specGraph, type Graph, type Path, type SpecState } from "./spec-graph.js"

let stores: Stores
let steps: McpSteps

beforeAll(async () => {
  const info = await postgresInfo()
  stores = { deck: openPool(info.deck, "slide-sibling-deck"), session: openPool(info.session, "slide-sibling-session") }
  steps = await mcpSteps(createServer)
})

afterAll(async () => {
  await steps.close()
  await Promise.all([stores.deck.end(), stores.session.end()])
})

type Turn = Owned & { readonly base: number }

async function liveTurn(): Promise<Turn> {
  const owned = await indexedDeck(stores, "slide-sibling")
  const added = await wholeCall(steps, owned, "r", "add_slide", {
    deck: owned.deck,
    base: owned.revision,
    after: "256",
    layout: "256",
  })
  return { ...owned, base: revisionOf(added) }
}

async function slideHeldAt(turn: Turn, gate: "deck" | "write"): Promise<Call> {
  const slide = await steps.start(turn, "u1", "add_slide", {
    deck: turn.deck,
    base: turn.base,
    after: "256",
    layout: "256",
  })
  while (slide.at !== gate) await slide.release()
  return slide
}

function siblingEdit(turn: Turn) {
  return wholeCall(steps, turn, "u2", "edit_deck", {
    deck: turn.deck,
    base: turn.base,
    changes: [{ node, value: "Agent", readAt: 0 }],
  })
}

async function stored(turn: Turn) {
  const saved = await readSaved(stores.deck, turn.deck)
  if (saved === undefined || saved.register === null) throw new Error("deck")
  return saved
}

for (const gate of ["deck", "write"] as const) {
  it(`lands a slide call and an edit of one turn sent at one base when the edit lands while the slide waits at its ${gate === "deck" ? "deck read" : "deck write"}`, async () => {
    const turn = await liveTurn()
    const slide = await slideHeldAt(turn, gate)
    const edit = await siblingEdit(turn)
    expect(edit.body).toMatchObject({ ok: true, runId: "r", revision: turn.base + 1 })
    const added = await finish(slide)
    expect(added.body).toMatchObject({ ok: true, runId: "r", revision: turn.base + 2 })
    const saved = await stored(turn)
    expect(saved.revision).toBe(turn.base + 2)
    expect(slidesAddedBy(saved.register, "r")).toHaveLength(2)
    expect(saved.register.elements[node]?.runId).toBe("r")
  })
}

async function elementTurn(): Promise<Turn & { readonly slide: string; readonly box: string }> {
  const owned = await indexedDeck(stores, "slide-sibling")
  const added = await wholeCall(steps, owned, "r", "add_slide", {
    deck: owned.deck,
    base: owned.revision,
    after: "256",
    layout: "256",
  })
  const slide = String(added.body?.slide)
  const boxed = await wholeCall(steps, owned, "r", "add_text_box", {
    deck: owned.deck,
    base: revisionOf(added),
    slide,
    box: { x: 0, y: 0, cx: 100, cy: 100 },
  })
  const rows = (boxed.body?.elements ?? []) as { node: string }[]
  const box = rows.at(-1)?.node
  if (box === undefined) throw new Error(JSON.stringify(boxed))
  return { ...owned, base: revisionOf(boxed), slide, box }
}

for (const op of ["add_text_box", "delete_element"] as const) {
  for (const gate of ["deck", "write"] as const) {
    it(`lands ${op} and an edit of one turn sent at one base when the edit lands while ${op} waits at its ${gate === "deck" ? "deck read" : "deck write"}`, async () => {
      const turn = await elementTurn()
      const input =
        op === "add_text_box" ? { slide: turn.slide, box: { x: 0, y: 200, cx: 100, cy: 100 } } : { node: turn.box }
      const call = await steps.start(turn, "u1", op, { deck: turn.deck, base: turn.base, ...input })
      while (call.at !== gate) await call.release()
      const edit = await siblingEdit(turn)
      expect(edit.body).toMatchObject({ ok: true, runId: "r", revision: turn.base + 1 })
      const landed = await finish(call)
      expect(landed.body).toMatchObject({ ok: true, runId: "r", revision: turn.base + 2 })
      expect((await stored(turn)).revision).toBe(turn.base + 2)
    })
  }
}

it("refuses as stale a slide call whose base a person's edit moved while it waited at its deck write", async () => {
  const turn = await liveTurn()
  const slide = await slideHeldAt(turn, "write")
  const person = await commitEdits(stores.deck, { deck: turn.deck, batch: [{ node, value: "Person" }] }, turn.email)
  expect(person).toMatchObject({ ok: true, revision: turn.base + 1 })
  const refused = await finish(slide)
  expect(refused.body).toMatchObject({ ok: false, refusal: "stale", revision: turn.base + 1 })
  expect(slidesAddedBy((await stored(turn)).register, "r")).toHaveLength(1)
})

it("refuses as stale a slide call whose base a person's edit moved before the turn's own edit landed", async () => {
  const turn = await liveTurn()
  const slide = await slideHeldAt(turn, "deck")
  const person = await commitEdits(stores.deck, { deck: turn.deck, batch: [{ node, value: "Person" }] }, turn.email)
  expect(person).toMatchObject({ ok: true, revision: turn.base + 1 })
  const read = await wholeCall(steps, turn, "u2", "read_deck", { deck: turn.deck })
  const rows = (read.body?.elements ?? []) as { node: string; version: number }[]
  const readAt = rows.find((row) => row.node === node)?.version
  const edit = await wholeCall(steps, turn, "u3", "edit_deck", {
    deck: turn.deck,
    base: turn.base + 1,
    changes: [{ node, value: "Agent", readAt }],
  })
  expect(edit.body).toMatchObject({ ok: true, runId: "r", revision: turn.base + 2 })
  const refused = await finish(slide)
  expect(refused.body).toMatchObject({ ok: false, refusal: "stale", revision: turn.base + 2 })
})

type Sibling = Turn & { offset: number; slide?: Call; edit?: Call; foreign: number; person: boolean }

const noted = elementId("257.notes")

function personEdit(deck: DeckId, email: string) {
  return commitEdits(stores.deck, { deck, batch: [{ node: noted, value: "Person" }] }, email)
}

async function rooted(last: string): Promise<Sibling> {
  const turn = await liveTurn()
  if (last === "r") return { ...turn, offset: turn.base - 1, foreign: 0, person: false }
  const typed = await personEdit(turn.deck, turn.email)
  if (!typed.ok) throw new Error(typed.refusal)
  return { ...turn, base: typed.revision, offset: typed.revision - 1, foreign: 1, person: false }
}

function callState(call: Call | undefined, offset: number) {
  const pc = call === undefined ? "idle" : { turn: "idle", write: "write", end: "done" }[call.at as string]
  const refusal = call?.reply?.body?.refusal
  const out = call?.at !== "end" ? "none" : call.reply?.ok === true ? "landed" : String(refusal)
  const rev = call?.read === undefined ? 0 : call.read - offset
  return { pc: pc ?? String(call?.at), rev, tries: call?.tries ?? 0, out }
}

async function observed(live: Sibling): Promise<SpecState> {
  const saved = await stored(live)
  const run = saved.register.lastRun
  const last = run?.revision === saved.revision ? run : undefined
  const slide = callState(live.slide, live.offset)
  const edit = callState(live.edit, live.offset)
  return {
    rev: saved.revision - live.offset,
    last: last === undefined ? "none" : last.runId === "r" ? "r" : "u",
    since: last === undefined ? 0 : Math.max(0, last.since - live.offset),
    slides: slidesAddedBy(saved.register, "r").length - 1,
    edits: (saved.register.elements[node]?.landed ?? []).filter((row) => row.runId === "r").length,
    foreign: live.foreign,
    person: live.person,
    sPc: slide.pc,
    sRev: slide.rev,
    sTries: slide.tries,
    sOut: slide.out,
    ePc: edit.pc,
    eRev: edit.rev,
    eTries: edit.tries,
    eOut: edit.out,
  }
}

async function written(call: Call): Promise<void> {
  await call.release()
  if (call.at === "save") await call.release()
}

async function act(live: Sibling, action: string): Promise<void> {
  const { deck, base } = live
  if (action === "SlideReads") {
    live.slide ??= await steps.start(live, "u1", "add_slide", { deck, base, after: "256", layout: "256" })
    await live.slide.release()
    await live.slide.release()
  } else if (action === "EditReads") {
    const changes = [{ node, value: "Agent", readAt: 0 }]
    live.edit ??= await steps.start(live, "u2", "edit_deck", { deck, base, changes })
    await live.edit.release()
    await live.edit.release()
  } else if (action === "SlideWrites" && live.slide !== undefined) await written(live.slide)
  else if (action === "EditWrites" && live.edit !== undefined) await written(live.edit)
  else if (action === "PersonEdits") {
    const typed = await personEdit(deck, live.email)
    if (!typed.ok) throw new Error(typed.refusal)
    live.foreign = typed.revision - live.offset
    live.person = true
  } else throw new Error(`no step for ${action}`)
}

async function replayEdge(graph: Graph, paths: Map<string, Path>, edge: Graph["edges"][number]) {
  const path = paths.get(edge.from)
  const first = path === undefined ? undefined : graph.states.get(path.root)
  if (path === undefined || first === undefined) return `no path to ${edge.from}`
  const live = await rooted(String(first.last))
  for (const step of [...path.steps, { action: edge.action, to: edge.to }]) {
    const target = graph.states.get(step.to)
    if (target === undefined) return "no target"
    await act(live, step.action)
    const seen = await observed(live)
    const wrong = Object.keys(target).filter((key) => seen[key] !== target[key])
    if (wrong.length > 0) {
      return `${step.action} into ${JSON.stringify(target)}: ${wrong.map((key) => `${key} ${String(seen[key])}`).join(", ")}`
    }
  }
  return null
}

it("drives every edge of the slide-sibling model through serveMcp, step by step, on Postgres", async () => {
  const graph = await specGraph("slide-sibling", "SlideSibling")
  const paths = pathsFrom(graph, (state) => state.sTries === 0 && state.eTries === 0 && state.person === false)
  expect(paths.size).toBe(graph.states.size)
  const states = [...graph.states.values()]
  expect(states.some((state) => state.sTries === 2 && state.sOut === "landed")).toBe(true)
  expect(states.some((state) => state.sOut === "stale")).toBe(true)
  const edges = graph.edges.filter((edge) => edge.action !== "Done")
  const failures: string[] = []
  for (let at = 0; at < edges.length; at += 8) {
    const told = await Promise.all(edges.slice(at, at + 8).map((edge) => replayEdge(graph, paths, edge)))
    for (const line of told) if (line !== null) failures.push(line)
  }
  expect(failures.slice(0, 5)).toEqual([])
}, 300_000)
