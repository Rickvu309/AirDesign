import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { postgresInfo } from "./harness.js"
import {
  decide,
  indexedDeck,
  loadDeck,
  loadTurn,
  request,
  settle,
  slidesAddedBy,
  stepNode as node,
  turnRow,
  wholeCall,
  type Owned,
  type Request,
  type Stores,
} from "./mcp-steps.js"
import { openPool } from "./pool.js"
import { readSaved } from "./saved.js"
import { specGraph, type Graph, type SpecState } from "./spec-graph.js"

type Live = Owned & {
  offset: number
  base: number
  agent: Request | undefined
  stop: Request | undefined
  minted: number
  stopped: boolean
  stopTold: boolean
  late: number
}

let stores: Stores

async function stored(live: Live) {
  const saved = await readSaved(stores.deck, live.deck)
  const turn = await turnRow(live)
  if (saved === undefined || turn === undefined) throw new Error("rows")
  return { revision: saved.revision, register: saved.register, turn }
}

function runWord(runId: string | null | undefined): string {
  if (runId === null || runId === undefined) return "none"
  return runId === "r" ? "r" : "u"
}

async function observed(live: Live): Promise<SpecState> {
  const row = await stored(live)
  const body = row.register.elements[node]
  const element = body?.runId !== "r" ? "none" : body.phase === "running" ? "running" : "stopped"
  return {
    rev: row.revision - live.offset,
    shown: slidesAddedBy(row.register, "r").length,
    element,
    turn: runWord(row.turn.run_id),
    turnRev: row.turn.revision - live.offset,
    base: live.base - live.offset,
    aPc: live.agent?.pc ?? "idle",
    sPc: live.stop === undefined ? "idle" : live.stop.pc === "idle" ? "done" : live.stop.pc,
    stopped: live.stopped,
    stopTold: live.stopTold,
    late: live.late,
  }
}

async function opened(element: string): Promise<Live> {
  const owned = await indexedDeck(stores, "slide-run")
  const live: Live = {
    ...owned,
    offset: 0,
    base: owned.revision,
    agent: undefined,
    stop: undefined,
    minted: 0,
    stopped: false,
    stopTold: false,
    late: 0,
  }
  const added = await wholeCall(live, "r", "add_slide", { deck: live.deck, base: live.base, after: "256", layout: "256" })
  if (!added.ok) throw new Error(added.refusal)
  live.base = added.deck.revision
  if (element === "running") {
    const edited = await wholeCall(live, "r", "edit_deck", {
      deck: live.deck,
      base: live.base,
      changes: [{ node, value: "Agent", readAt: 0 }],
    })
    if (!edited.ok) throw new Error(edited.refusal)
    live.base = edited.deck.revision
  }
  live.offset = live.base - 1
  return live
}

async function act(live: Live, action: string, target: SpecState): Promise<void> {
  const agent = live.agent
  const stop = live.stop
  if (action === "AgentLoadsTurn") {
    live.minted += 1
    live.agent = request(live, `u${String(live.minted)}`)
    live.agent.op = target.aKind === "read" ? "read_deck" : "add_slide"
    await loadTurn(live, live.agent)
  } else if (action === "AgentLoadsDeck" && agent !== undefined) await loadDeck(live, agent)
  else if (action === "AgentReads" && agent !== undefined) {
    const read = await decide(live, agent, "read_deck", { deck: live.deck })
    if (!read.ok || read.reported === undefined || !("revision" in read.reported)) throw new Error("read")
    live.base = read.reported.revision
    if (target.aPc === "idle") await settle(agent)
  } else if (action === "AgentAddsSlide" && agent !== undefined) {
    const added = await decide(live, agent, "add_slide", { deck: live.deck, base: live.base, after: "256", layout: "256" })
    if (added.ok && added.answer?.ok === true && added.answer.runId === "r" && live.stopped) live.late += 1
    if (!added.ok) await settle(agent)
  } else if (action === "AgentSavesTurn" && agent !== undefined) await settle(agent)
  else if (action === "StopLoadsTurn") {
    live.stop = request(live, "s")
    await loadTurn(live, live.stop)
  } else if (action === "StopLoadsDeck" && stop !== undefined) await loadDeck(live, stop)
  else if (action === "StopCommits" && stop !== undefined) {
    const ended = await decide(live, stop, "stop_run", { deck: live.deck, runId: "r" })
    if (ended.ok) live.stopped = true
    if (target.sPc === "done") {
      await settle(stop)
      live.stopTold = ended.ok
    }
  } else if (action === "StopSavesTurn" && stop !== undefined) {
    await settle(stop)
    live.stopTold = true
  } else throw new Error(`no step for ${action}`)
}

const compared = ["rev", "shown", "element", "turn", "turnRev", "base", "aPc", "sPc", "stopped", "stopTold", "late"]

type Path = { readonly root: string; readonly steps: readonly { readonly action: string; readonly to: string }[] }

function pathsFrom(graph: Graph): Map<string, Path> {
  const paths = new Map<string, Path>()
  for (const [id, state] of graph.states) {
    if (state.calls === 0 && state.sPc === "idle") paths.set(id, { root: id, steps: [] })
  }
  const order = [...paths.keys()]
  for (let at = 0; at < order.length; at += 1) {
    const from = order[at]
    const path = from === undefined ? undefined : paths.get(from)
    if (path === undefined) continue
    for (const edge of graph.edges) {
      if (edge.from !== from || paths.has(edge.to)) continue
      paths.set(edge.to, { root: path.root, steps: [...path.steps, { action: edge.action, to: edge.to }] })
      order.push(edge.to)
    }
  }
  return paths
}

async function replayEdge(graph: Graph, paths: Map<string, Path>, edge: Graph["edges"][number]) {
  const path = paths.get(edge.from)
  const first = path === undefined ? undefined : graph.states.get(path.root)
  if (path === undefined || first === undefined) return `no path to ${edge.from}`
  const live = await opened(String(first.element))
  for (const step of [...path.steps, { action: edge.action, to: edge.to }]) {
    const target = graph.states.get(step.to)
    if (target === undefined) return "no target"
    await act(live, step.action, target)
    const seen = await observed(live)
    const wrong = compared.filter((key) => seen[key] !== target[key])
    if (wrong.length > 0) {
      return `${step.action} into ${JSON.stringify(target)}: ${wrong.map((key) => `${key} ${String(seen[key])}`).join(", ")}`
    }
  }
  return null
}

describe("slide-run replay", () => {
  beforeAll(async () => {
    const info = await postgresInfo()
    stores = { deck: openPool(info.deck, "slide-run-deck"), session: openPool(info.session, "slide-run-session") }
  })

  afterAll(async () => {
    await Promise.all([stores.deck.end(), stores.session.end()])
  })

  it("drives every edge of the slide-run model through the MCP request steps on Postgres", async () => {
    const graph = await specGraph("slide-run", "SlideRun")
    const paths = pathsFrom(graph)
    expect(paths.size).toBe(graph.states.size)
    const edges = graph.edges.filter((edge) => edge.action !== "Done")
    const failures: string[] = []
    for (let at = 0; at < edges.length; at += 8) {
      const batch = edges.slice(at, at + 8)
      const told = await Promise.all(batch.map((edge) => replayEdge(graph, paths, edge)))
      for (const line of told) if (line !== null) failures.push(line)
    }
    expect(failures.slice(0, 5)).toEqual([])
  }, 300_000)
})
