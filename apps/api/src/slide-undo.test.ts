import { orderKeyBetween, presentSlides, readSlideId } from "@airdesign/document"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { postgresInfo } from "./harness.js"
import { indexedDeck, slidesAddedBy, turnRow, wholeCall, type Owned, type Stores } from "./mcp-steps.js"
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
}

let stores: Stores

async function saved(live: Live) {
  const row = await readSaved(stores.deck, live.deck)
  if (row === undefined || row.register === null) throw new Error("deck")
  return { revision: row.revision, register: row.register }
}

async function opened(): Promise<Live> {
  const owned = await indexedDeck(stores, "slide-undo")
  const added = await wholeCall(owned, "r", "add_slide", {
    deck: owned.deck,
    base: owned.revision,
    after: "256",
    layout: "256",
  })
  if (!added.ok) throw new Error(added.refusal)
  const live = { ...owned, offset: added.deck.revision - 1, minted: 0, moved: false, undone: false, afterUndo: 0 }
  return { ...live, told: "none", adds: 0, undos: 0 }
}

async function act(live: Live, action: string): Promise<void> {
  live.minted += 1
  const fresh = `u${String(live.minted)}`
  if (action === "AgentAddsSlide") {
    const read = await wholeCall(live, fresh, "read_deck", { deck: live.deck })
    if (!read.ok || read.reported === undefined || !("revision" in read.reported)) throw new Error("read")
    const args = { deck: live.deck, base: read.reported.revision, after: "256", layout: "256" }
    const added = await wholeCall(live, fresh, "add_slide", args)
    if (!added.ok || added.answer?.ok !== true) throw new Error(`add ${added.ok ? "" : added.refusal}`)
    if (added.answer.runId === "r" && live.undone) live.afterUndo += 1
    live.adds += 1
  } else if (action === "AgentStops") {
    const stopped = await wholeCall(live, fresh, "stop_run", { deck: live.deck, runId: "r" })
    if (!stopped.ok) throw new Error(stopped.refusal)
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
    adds: live.adds,
    undos: live.undos,
    undone: live.undone,
    afterUndo: live.afterUndo,
    told: live.told,
  }
}

function pathsFrom(graph: Graph): Map<string, readonly { readonly action: string; readonly to: string }[]> {
  const paths = new Map<string, readonly { readonly action: string; readonly to: string }[]>()
  for (const [id, state] of graph.states)
    if (state.adds === 0 && state.undos === 0 && state.rev === 1 && state.turn === "r") paths.set(id, [])
  const order = [...paths.keys()]
  for (let at = 0; at < order.length; at += 1) {
    const from = order[at]
    const path = from === undefined ? undefined : paths.get(from)
    if (path === undefined) continue
    for (const edge of graph.edges) {
      if (edge.from !== from || paths.has(edge.to)) continue
      paths.set(edge.to, [...path, { action: edge.action, to: edge.to }])
      order.push(edge.to)
    }
  }
  return paths
}

async function replayEdge(graph: Graph, path: readonly { readonly action: string; readonly to: string }[]) {
  const live = await opened()
  for (const step of path) {
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
  })

  afterAll(async () => {
    await Promise.all([stores.deck.end(), stores.session.end()])
  })

  it("drives every edge of the slide-undo model through run Undo, person moves and MCP calls on Postgres", async () => {
    const graph = await specGraph("slide-undo", "SlideUndo")
    const paths = pathsFrom(graph)
    expect(paths.size).toBe(graph.states.size)
    const edges = graph.edges.filter((edge) => edge.action !== "Done")
    const failures: string[] = []
    for (let at = 0; at < edges.length; at += 8) {
      const batch = edges.slice(at, at + 8)
      const told = await Promise.all(
        batch.map((edge) => replayEdge(graph, [...(paths.get(edge.from) ?? []), { action: edge.action, to: edge.to }])),
      )
      for (const line of told) if (line !== null) failures.push(line)
    }
    expect(failures.slice(0, 5)).toEqual([])
  }, 300_000)

  it.fails("lands no slide of a run after a person's run Undo took it back", async () => {
    const live = await opened()
    await act(live, "PersonUndoes")
    await act(live, "AgentAddsSlide")
    expect(live.afterUndo).toBe(0)
  })

  it.fails("takes back with run Undo a slide the run added after an earlier Undo", async () => {
    const live = await opened()
    await act(live, "PersonUndoes")
    await act(live, "AgentAddsSlide")
    await act(live, "PersonUndoes")
    expect(live.told).toBe("applied")
  })
})
