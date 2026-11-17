import { createServer } from "node:http"

import { orderKeyBetween, presentSlides, readSlideId, type Register } from "@airdesign/document"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { postgresInfo } from "./harness.js"
import {
  indexedDeck,
  mcpSteps,
  revisionOf,
  slidesAddedBy,
  turnRow,
  wholeCall,
  type McpSteps,
  type Owned,
  type Stores,
} from "./mcp-steps.js"
import { openPool } from "./pool.js"
import { commitEdits, readSaved } from "./saved.js"
import { specGraph, type Graph, type SpecState } from "./spec-graph.js"
import { undoRun } from "./undo.js"

type Live = Owned & {
  offset: number
  minted: number
  moved: boolean
  undone: boolean
  afterUndo: number
  told: string
  adds: number
  undos: number
  dropped: boolean
  added: boolean
}

type Path = { readonly start: SpecState; readonly steps: readonly { readonly action: string; readonly to: string }[] }

const dropping = "257"

let stores: Stores
let steps: McpSteps

async function saved(live: Live) {
  const row = await readSaved(stores.deck, live.deck)
  if (row === undefined || row.register === null) throw new Error("deck")
  return { revision: row.revision, register: row.register }
}

async function opened(dropped = false): Promise<Live> {
  const owned = await indexedDeck(stores, "slide-undo")
  const first = dropped
    ? await wholeCall(steps, owned, "r", "edit_deck", {
        deck: owned.deck,
        base: owned.revision,
        changes: [{ op: "delete_slide", slide: dropping }],
      })
    : await wholeCall(steps, owned, "r", "edit_deck", {
        deck: owned.deck,
        base: owned.revision,
        changes: [{ op: "add_slide", after: "256", layout: "256" }],
      })
  const live = { ...owned, offset: revisionOf(first) - 1, minted: 0, moved: false, undone: false, afterUndo: 0 }
  return { ...live, told: "none", adds: 0, undos: 0, dropped, added: !dropped }
}

function shows(register: Register, slide: string): boolean {
  return presentSlides({ file: register.file, order: register.order }).some((spot) => spot.id === readSlideId(slide))
}

function fenced(register: Register): boolean {
  const first = register.order.findIndex((row) => row.runId === "r")
  const own = new Set(register.order.flatMap((row) => (row.runId === "r" ? [row.id] : [])))
  return register.order
    .slice(first + 1)
    .some((row) => row.runId !== "r" && (row.slide === "remove" || row.slide === "restore") && own.has(row.id))
}

async function act(live: Live, action: string): Promise<void> {
  live.minted += 1
  const fresh = `u${String(live.minted)}`
  if (action === "AgentAddsSlide") {
    const read = await wholeCall(steps, live, fresh, "read_deck", { deck: live.deck })
    const args = { deck: live.deck, base: revisionOf(read), after: "256", layout: "256" }
    const added = await wholeCall(
      steps,
      live,
      fresh,
      "edit_deck",
      (({ deck, base, ...change }) => ({ deck, base, changes: [{ op: "add_slide", ...change }] }))(args),
    )
    revisionOf(added)
    if (added.body?.runId === "r" && live.undone) live.afterUndo += 1
    if (added.body?.runId === "r") live.added = true
    live.adds += 1
  } else if (action === "AgentStops") {
    const stopped = await wholeCall(steps, live, fresh, "stop_run", { deck: live.deck, runId: "r" })
    if (!stopped.ok) throw new Error(JSON.stringify(stopped))
  } else if (action === "PersonMoves") {
    const row = await saved(live)
    const file = row.register.file
    const present = presentSlides({ file, order: row.register.order })
    const moving = readSlideId(slidesAddedBy(row.register, "r")[0] ?? "")
    const first = present[0]
    if (moving === undefined || first === undefined) throw new Error("move")
    const key = orderKeyBetween(null, first.key)
    const batch = [{ slide: "move" as const, id: moving, key, file }]
    const moved = await commitEdits(stores.deck, { deck: live.deck, batch }, live.email)
    if (!moved.ok) throw new Error(moved.refusal)
    live.moved = true
  } else if (action === "PersonDeletes") {
    const row = await saved(live)
    const slide = readSlideId(dropping)
    if (slide === undefined) throw new Error("delete")
    const batch = [{ slide: "remove" as const, id: slide, file: row.register.file }]
    const deleted = await commitEdits(stores.deck, { deck: live.deck, batch }, live.email)
    if (!deleted.ok) throw new Error(deleted.refusal)
  } else if (action === "PersonUndoes") {
    const undone = await undoRun(stores.deck, { deck: live.deck, runId: "r" }, live.email)
    live.told = undone.ok ? "applied" : "refused"
    if (undone.ok) live.undone = true
    live.undos += 1
  } else throw new Error(`no step for ${action}`)
}

async function observed(live: Live): Promise<SpecState> {
  const row = await saved(live)
  const turn = await turnRow(live)
  const runId = turn?.run_id ?? null
  return {
    rev: row.revision - live.offset,
    shown: slidesAddedBy(row.register, "r").length,
    moved: live.moved,
    turn: runId === null ? "none" : runId === "r" ? "r" : "u",
    ended: row.register.ended?.includes("r") === true,
    adds: live.adds,
    undos: live.undos,
    undone: live.undone,
    afterUndo: live.afterUndo,
    told: live.told,
    dropped: live.dropped,
    dShows: shows(row.register, dropping),
    added: live.added,
    fenced: fenced(row.register),
  }
}

function pathsFrom(graph: Graph): Map<string, Path> {
  const paths = new Map<string, Path>()
  for (const [id, state] of graph.states)
    if (state.adds === 0 && state.undos === 0 && state.rev === 1 && state.turn === "r")
      paths.set(id, { start: state, steps: [] })
  const order = [...paths.keys()]
  for (let at = 0; at < order.length; at += 1) {
    const from = order[at]
    const path = from === undefined ? undefined : paths.get(from)
    if (path === undefined) continue
    for (const edge of graph.edges) {
      if (edge.from !== from || paths.has(edge.to)) continue
      paths.set(edge.to, { start: path.start, steps: [...path.steps, { action: edge.action, to: edge.to }] })
      order.push(edge.to)
    }
  }
  return paths
}

async function replayEdge(graph: Graph, path: Path) {
  const live = await opened(path.start.dropped === true)
  for (const step of path.steps) {
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

describe("slide-undo replay", () => {
  beforeAll(async () => {
    const info = await postgresInfo()
    stores = { deck: openPool(info.deck, "slide-undo-deck"), session: openPool(info.session, "slide-undo-session") }
    steps = await mcpSteps(createServer)
  })

  afterAll(async () => {
    await steps.close()
    await Promise.all([stores.deck.end(), stores.session.end()])
  })

  it("drives every edge of the slide-undo model through run Undo, person moves and serveMcp calls on Postgres", async () => {
    const graph = await specGraph("slide-undo", "SlideUndo")
    const paths = pathsFrom(graph)
    expect(paths.size).toBe(graph.states.size)
    const edges = graph.edges.filter((edge) => edge.action !== "Done")
    const failures: string[] = []
    for (let at = 0; at < edges.length; at += 8) {
      const batch = edges.slice(at, at + 8)
      const told = await Promise.all(
        batch.map((edge) => {
          const path = paths.get(edge.from)
          if (path === undefined) return Promise.resolve(`no path to ${edge.from}`)
          return replayEdge(graph, { start: path.start, steps: [...path.steps, { action: edge.action, to: edge.to }] })
        }),
      )
      for (const line of told) if (line !== null) failures.push(line)
    }
    expect(failures.slice(0, 5)).toEqual([])
    expect(new Set(edges.map((edge) => edge.action))).toEqual(
      new Set(["AgentAddsSlide", "AgentStops", "PersonMoves", "PersonDeletes", "PersonUndoes"]),
    )
  }, 300_000)

  it("brings back a slide the run deleted once, and refuses a second Undo after a person deleted it again", async () => {
    const live = await opened(true)
    await act(live, "PersonUndoes")
    expect(shows((await saved(live)).register, dropping)).toBe(true)
    await act(live, "PersonDeletes")
    await act(live, "PersonUndoes")
    expect(live.told).toBe("refused")
    expect(shows((await saved(live)).register, dropping)).toBe(false)
  })

  it("lands no slide of a run after a person's run Undo took it back", async () => {
    const live = await opened()
    await act(live, "PersonUndoes")
    await act(live, "AgentAddsSlide")
    expect(live.afterUndo).toBe(0)
  })

  it("takes back with run Undo a slide the agent added after an earlier Undo", async () => {
    const live = await opened()
    await act(live, "PersonUndoes")
    await act(live, "AgentAddsSlide")
    const later = (await saved(live)).register.order.at(-1)?.runId
    if (later === undefined) throw new Error("run")
    expect(later).not.toBe("r")
    expect(slidesAddedBy((await saved(live)).register, later)).toHaveLength(1)
    const undone = await undoRun(stores.deck, { deck: live.deck, runId: later }, live.email)
    expect(undone.ok).toBe(true)
    expect(slidesAddedBy((await saved(live)).register, later)).toEqual([])
  })
})
