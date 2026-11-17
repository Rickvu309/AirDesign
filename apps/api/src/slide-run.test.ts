import { createServer } from "node:http"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { postgresInfo } from "./harness.js"
import {
  indexedDeck,
  mcpSteps,
  revisionOf,
  slidesAddedBy,
  stepNode as node,
  toolCalls,
  turnRow,
  wholeCall,
  type Call,
  type McpSteps,
  type Owned,
  type Stores,
} from "./mcp-steps.js"
import { openPool } from "./pool.js"
import { readSaved } from "./saved.js"
import { pathsFrom, specGraph, walks, type Graph, type Path, type SpecState } from "./spec-graph.js"

type Live = Owned & {
  offset: number
  tools: number
  base: number
  agent: Call | undefined
  reading: boolean
  stop: Call | undefined
  minted: number
  stopped: boolean
  stopTold: boolean
  late: number
  foreign: boolean
}

let stores: Stores
let steps: McpSteps

async function stored(live: Live) {
  const saved = await readSaved(stores.deck, live.deck)
  const turn = await turnRow(live)
  if (saved === undefined || saved.register === null || turn === undefined) throw new Error("rows")
  return { revision: saved.revision, register: saved.register, turn }
}

function runWord(runId: string | null | undefined): string {
  if (runId === null || runId === undefined) return "none"
  return runId === "r" ? "r" : "u"
}

function pcOf(call: Call | undefined, ended: string): string {
  if (call === undefined) return "idle"
  if (call.at === "end") return ended
  return { turn: "retry", deck: "turn", write: "deck", save: "settle" }[call.at]
}

async function observed(live: Live): Promise<SpecState> {
  const row = await stored(live)
  const body = row.register.elements[node]
  const element = body?.runId !== "r" ? "none" : body.phase === "running" ? "running" : "stopped"
  const last = row.register.lastRun?.revision === row.revision ? row.register.lastRun : undefined
  return {
    rev: row.revision - live.offset,
    shown: slidesAddedBy(row.register, "r").length,
    element,
    ended: row.register.ended?.includes("r") === true,
    last: runWord(last?.runId),
    covers: last !== undefined && last.since <= live.base,
    turn: runWord(row.turn.run_id),
    turnRev: row.turn.revision - live.offset,
    base: live.base - live.offset,
    aPc: pcOf(live.agent, "idle"),
    sPc: live.stop === undefined ? "idle" : pcOf(live.stop, "done"),
    stopped: live.stopped,
    stopTold: live.stopTold,
    late: live.late,
    foreign: live.foreign,
    tools: (await toolCalls(live)) - live.tools,
  }
}

async function opened(element: string): Promise<Live> {
  const owned = await indexedDeck(stores, "slide-run")
  const added = await wholeCall(steps, owned, "r", "edit_deck", {
    deck: owned.deck,
    base: owned.revision,
    changes: [{ op: "add_slide", after: "256", layout: "256" }],
  })
  let base = revisionOf(added)
  if (element === "running") {
    const edited = await wholeCall(steps, owned, "r", "edit_deck", {
      deck: owned.deck,
      base,
      changes: [{ node, value: "Agent", readAt: 0 }],
    })
    base = revisionOf(edited)
  }
  const live = { ...owned, offset: base - 1, tools: await toolCalls(owned), base, agent: undefined, reading: false }
  return { ...live, stop: undefined, minted: 0, stopped: false, stopTold: false, late: 0, foreign: false }
}

function told(call: Call): boolean {
  return call.at === "end" && call.reply?.ok === true
}

async function act(live: Live, action: string, target: SpecState): Promise<void> {
  const agent = live.agent
  const stop = live.stop
  if (action === "AgentLoadsTurn") {
    if (agent === undefined || agent.at === "end") {
      live.minted += 1
      const args =
        target.aKind === "read"
          ? { deck: live.deck }
          : { deck: live.deck, base: live.base, changes: [{ op: "add_slide", after: "256", layout: "256" }] }
      live.reading = target.aKind === "read"
      const op = live.reading ? "read_deck" : "edit_deck"
      live.agent = await steps.start(live, `u${String(live.minted)}`, op, args)
      await live.agent.release()
    } else await agent.release()
  } else if (action === "AgentLoadsDeck" && agent !== undefined) {
    await agent.release()
    if (live.reading) {
      live.base = agent.read ?? live.base
      live.foreign = false
    }
  } else if (action === "AgentAddsSlide" && agent !== undefined) {
    const before = await observed(live)
    await agent.release()
    const after = await observed(live)
    if (after.shown !== before.shown && live.stopped) live.late += 1
    if (after.rev !== before.rev && after.shown === before.shown) live.foreign = true
  } else if (action === "AgentSavesTurn" && agent !== undefined) await agent.release()
  else if (action === "StopLoadsTurn") {
    if (stop === undefined) {
      live.stop = await steps.start(live, "s", "stop_run", { deck: live.deck, runId: "r" })
      await live.stop.release()
    } else await stop.release()
  } else if (action === "StopLoadsDeck" && stop !== undefined) {
    await stop.release()
    if (stop.at === "save" || told(stop)) live.stopped = true
    live.stopTold = told(stop)
  } else if (action === "StopCommits" && stop !== undefined) {
    const before = (await observed(live)).rev
    await stop.release()
    if ((await observed(live)).rev !== before) live.foreign = true
    if ((await observed(live)).ended) live.stopped = true
    live.stopTold = told(stop)
  } else if (action === "StopSavesTurn" && stop !== undefined) {
    await stop.release()
    live.stopTold = told(stop)
  } else throw new Error(`no step for ${action}`)
}

const compared = [
  "rev",
  "shown",
  "element",
  "ended",
  "last",
  "covers",
  "turn",
  "turnRev",
  "base",
  "aPc",
  "sPc",
  "stopped",
  "stopTold",
  "late",
  "foreign",
  "tools",
]

async function replayWalk(graph: Graph, walk: Path) {
  const first = graph.states.get(walk.root)
  if (first === undefined) return "no root"
  const live = await opened(String(first.element))
  for (const step of walk.steps) {
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
    steps = await mcpSteps(createServer)
  })

  afterAll(async () => {
    await steps.close()
    await Promise.all([stores.deck.end(), stores.session.end()])
  })

  it("drives every edge of the slide-run model through serveMcp, step by step, on Postgres", async () => {
    const graph = await specGraph("slide-run", "SlideRun")
    const paths = pathsFrom(graph, (state) => state.calls === 0 && state.sPc === "idle")
    expect(paths.size).toBe(graph.states.size)
    const states = [...graph.states.values()]
    expect(states.some((state) => state.aPc === "retry")).toBe(true)
    expect(states.some((state) => state.sPc === "retry")).toBe(true)
    const covering = walks(graph, paths)
    const failures: string[] = []
    for (let at = 0; at < covering.length; at += 8) {
      const batch = covering.slice(at, at + 8)
      const told = await Promise.all(batch.map((walk) => replayWalk(graph, walk)))
      for (const line of told) if (line !== null) failures.push(line)
    }
    expect(failures.slice(0, 5)).toEqual([])
  }, 300_000)
})
