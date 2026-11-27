import path from "node:path"
import { fileURLToPath } from "node:url"
import { catalog, projectTools, readDeckId, type DeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { callTool, emptyLog, type DeckHost, type ToolResult } from "@airdesign/mcp"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/agents/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Agent = "a" | "b"
type ModelRun = "a1" | "a2" | "b1" | "b2"
type World = {
  readonly server: doom.Doom
  readonly xRevs: readonly number[]
  readonly reads: ReadonlyMap<string, doom.Rev>
  readonly person: boolean
  readonly overwrote: boolean
  readonly ids: Readonly<Partial<Record<ModelRun, string>>>
  readonly out: string
  readonly mixed: boolean
  readonly stoppedOther: boolean
  readonly calls: number
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const agentKeys: Readonly<Record<Agent, string>> = { a: "aira:quan", b: "grant:claude" }
const owned: Readonly<Record<Agent, readonly ModelRun[]>> = { a: ["a1", "a2"], b: ["b1", "b2"] }
const modelRuns: readonly ModelRun[] = ["a1", "a2", "b1", "b2"]
const agentNames: readonly Agent[] = ["a", "b"]
const ownerOf = (run: ModelRun): Agent => (run.startsWith("a") ? "a" : "b")
const toolNames = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<
  string,
  string
>
const readDeck = readDeckId("dagentsreplay")
if (!readDeck.ok) throw new Error("the replay deck id does not read")
const deck: DeckId = readDeck.deck

function opened(): { readonly server: doom.Doom; readonly x: doom.NodeId } {
  const server = doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Slide",
        children: [
          {
            type: "shape",
            name: "x",
            props: {
              box: { x: 160, y: 380, w: 1600, h: 160, rotation: 0, flipH: false, flipV: false },
              text: doom.textFromMarkdown("x", "body"),
            },
          },
        ],
      },
    ],
  }).doom
  const x = [...server.nodes.values()].find((node) => node.type === "shape")
  if (x === undefined) throw new Error("no x")
  return { server, x: x.id }
}

const start = opened()

function hosted(world: World) {
  let fold = world.server
  const reads = new Map(world.reads)
  const personRev = world.person ? fold.revs.get(start.x)?.get("text") : undefined
  const host: DeckHost = {
    account: "replay-account",
    agentReads: {
      last: async (_deck, agent) => reads.get(agent),
      remember: async (_deck, agent, rev) => {
        reads.set(agent, rev)
      },
      byPerson: async (_deck, revs) => new Set(personRev !== undefined && revs.includes(personRev) ? [personRev] : []),
    },
    withUndo: async (_deck, undo) => undo({ ...host, undoRevs: async () => new Set() }),
    list: async () => ({ ok: true, decks: [] }),
    create: async () => ({ ok: false, refusal: "deck" }),
    open: async () => ({ ok: true, deck, rev: fold.rev, fold }),
    edit: async (_deck, sent) => {
      const read = doom.readEdit(JSON.parse(JSON.stringify(sent)), fold)
      if (doom.isRefusal(read)) return { ok: false, refusal: "edit", ...read }
      const next = doom.applyEdit(fold, { ...read, rev: doom.rev(fold.rev + 1) })
      if (doom.isRefusal(next)) return { ok: false, refusal: "edit", ...next }
      if (next === fold) return { ok: true, deck, rev: fold.onces.get(read.once) ?? fold.rev }
      fold = next
      return { ok: true, deck, rev: fold.rev }
    },
    run: async () => ({ ok: true, edits: [], replaced: [] }),
  }
  return { host, now: () => fold, reads }
}

async function call(world: World, by: Agent, op: string, args: unknown) {
  const { host, now, reads } = hosted(world)
  const calls = world.calls + 1
  const result: ToolResult = await callTool(
    toolNames[op] ?? op,
    args,
    {
      agent: agentKeys[by],
      mint: () => `mint${String(calls)}`,
      log: emptyLog(),
      now: 0,
      once: `${by}-${String(calls)}`,
    },
    host,
  )
  return { answer: result.answer, server: now(), calls, reads }
}

function phaseOf(world: World, run: ModelRun): "idle" | "running" | "stopped" {
  const id = world.ids[run]
  return id === undefined ? "idle" : (world.server.runs.get(id)?.phase ?? "idle")
}

function observe(world: World): Spec {
  const read = (by: Agent) => {
    const rev = world.reads.get(agentKeys[by])
    return rev === undefined ? -1 : world.xRevs.filter((each) => each <= rev).length
  }
  return {
    readA: read("a"),
    readB: read("b"),
    person: world.person,
    overwrote: world.overwrote,
    pa1: phaseOf(world, "a1"),
    pa2: phaseOf(world, "a2"),
    pb1: phaseOf(world, "b1"),
    pb2: phaseOf(world, "b2"),
    ver: world.xRevs.length,
    out: world.out,
    mixed: world.mixed,
    stoppedOther: world.stoppedOther,
  }
}

const refusalOf = (answer: Record<string, unknown>) =>
  answer.ok === true ? undefined : typeof answer.refusal === "string" ? answer.refusal : "unexpected"

async function edits(world: World, by: Agent, run?: ModelRun): Promise<World> {
  const fresh = owned[by].find((each) => world.ids[each] === undefined)
  const into = run ?? fresh
  if (into === undefined) return { ...world, out: "a third run, beyond the model" }
  const named = run === undefined ? undefined : world.ids[run]
  const done = await call(world, by, "execute", {
    deck,
    script: `update({ target: "${start.x}", text: "${by}${String(world.calls + 1)}" })`,
    ...(named === undefined ? {} : { runId: named }),
  })
  const refusal = refusalOf(done.answer)
  if (refusal !== undefined) return { ...world, calls: done.calls, out: refusal }
  const rev = done.answer.rev
  const runId = done.answer.runId
  if (typeof rev !== "number" || typeof runId !== "string")
    throw new Error(`execute answered ${JSON.stringify(done.answer)}`)
  const read = world.reads.get(agentKeys[by])
  const unseen = world.person && read !== undefined && read < world.server.rev
  return {
    ...world,
    calls: done.calls,
    server: done.server,
    reads: done.reads,
    person: false,
    overwrote: world.overwrote || unseen,
    xRevs: [...world.xRevs, rev],
    ids: run === undefined ? { ...world.ids, [into]: runId } : world.ids,
    out: "landed",
    mixed: world.mixed || done.server.runs.get(runId)?.agent !== agentKeys[by] || ownerOf(into) !== by,
  }
}

async function stops(world: World, by: Agent, run: ModelRun): Promise<World> {
  const done = await call(world, by, "stop_run", { deck, runId: world.ids[run] })
  const refusal = refusalOf(done.answer)
  if (refusal !== undefined) return { ...world, calls: done.calls, out: refusal }
  const moved = done.server !== world.server
  return {
    ...world,
    calls: done.calls,
    server: done.server,
    out: moved ? "stopped" : "already",
    stoppedOther: world.stoppedOther || (moved && ownerOf(run) !== by),
  }
}

async function reads(world: World, by: Agent): Promise<World> {
  const done = await call(world, by, "execute", { deck, script: `get({ target: "${start.x}" })` })
  return {
    ...world,
    calls: done.calls,
    server: done.server,
    reads: done.reads,
    out: refusalOf(done.answer) ?? "read",
  }
}

async function types(world: World): Promise<World> {
  const { host, now } = hosted(world)
  const base = world.server.revs.get(start.x)?.get("text")
  const typed = await host.edit(deck, {
    once: "person-types",
    author: { kind: "person", id: "person" },
    writes: [
      {
        node: start.x,
        prop: "text",
        value: doom.textFromMarkdown("Person's words", "body"),
        ...(base === undefined ? {} : { base }),
      },
    ],
  })
  if (!typed.ok) throw new Error(`person edit refused ${JSON.stringify(typed)}`)
  return { ...world, server: now(), xRevs: [...world.xRevs, typed.rev], person: true, out: "typed" }
}

async function step(world: World, action: string): Promise<readonly World[]> {
  const named = modelRuns.filter((run) => world.ids[run] !== undefined)
  if (action === "AgentReads") return Promise.all(agentNames.map((by) => reads(world, by)))
  if (action === "PersonTypes") return [await types(world)]
  if (action === "AgentStarts") return Promise.all(agentNames.map((by) => edits(world, by)))
  if (action === "AgentWrites") {
    const outcomes: World[] = []
    for (const by of agentNames) {
      for (const run of named) outcomes.push(await edits(world, by, run))
    }
    return outcomes
  }
  if (action === "AgentStops") return Promise.all(agentNames.flatMap((by) => named.map((run) => stops(world, by, run))))
  if (action === "Done") return [world]
  throw new Error(`${action} is not connected`)
}

function differences(expected: Spec, found: Spec): string[] {
  return Object.keys(found)
    .filter((key) => expected[key] !== found[key])
    .map((key) => `${key} is ${String(found[key])}, the model says ${String(expected[key])}`)
}

function said(source: Spec, action: string, target: Spec): string {
  return `agents ${view.group(source)}: ${view.state(source)} -${action}-> ${view.group(target)}: ${view.state(target)}`
}

async function replayed(graph: Graph, failures: string[]) {
  const first = [...graph.states].find(([, state]) => state.ver === 0 && state.out === "none")
  if (first === undefined) throw new Error("no initial state")
  const empty: World = {
    server: start.server,
    xRevs: [],
    reads: new Map(),
    person: false,
    overwrote: false,
    ids: {},
    out: "none",
    mixed: false,
    stoppedOther: false,
    calls: 0,
  }
  const reached = new Map<string, World>([[first[0], empty]])
  const queued = [first[0]]
  const seen = { edges: 0, landed: 0, fenced: 0, stopped: 0, already: 0, restarted: 0, stale: 0, reread: 0 }
  while (queued.length > 0) {
    const from = queued.shift() as string
    const world = reached.get(from) as World
    const source = graph.states.get(from) as Spec
    const found = differences(source, observe(world))
    if (found.length > 0) failures.push(`agents ${view.state(source)}\n  the code holds ${found.join("; ")}`)
    for (const edge of graph.edges.filter((each) => each.from === from)) {
      const target = graph.states.get(edge.to) as Spec
      seen.edges += 1
      const outcomes = await step(world, edge.action)
      const matching = outcomes.find((outcome) => differences(target, observe(outcome)).length === 0)
      if (matching === undefined) {
        const nearest = outcomes
          .map((outcome) => differences(target, observe(outcome)))
          .sort((one, other) => one.length - other.length)[0]
        failures.push(`${said(source, edge.action, target)}\n  the code disagrees: ${(nearest ?? []).join("; ")}`)
        continue
      }
      if (edge.action !== "Done") {
        if (target.out === "stale") seen.stale += 1
        if (edge.action === "AgentReads" && source.out === "stale") seen.reread += 1
        if (target.out === "landed") seen.landed += 1
        if (target.out === "run-fenced") seen.fenced += 1
        if (target.out === "stopped") seen.stopped += 1
        if (target.out === "already") seen.already += 1
        if (edge.action === "AgentStarts" && target.out === "landed") {
          const stoppedNow = modelRuns.filter(
            (run) => source[`p${run}`] === "running" && target[`p${run}`] === "stopped",
          )
          if (stoppedNow.length > 0) seen.restarted += 1
        }
      }
      if (!reached.has(edge.to)) {
        reached.set(edge.to, matching)
        queued.push(edge.to)
      }
    }
  }
  for (const [id, state] of graph.states)
    if (!reached.has(id)) failures.push(`agents state ${view.state(state)} was not reached`)
  return seen
}

describe("agents replay", () => {
  it("drives every edge of two agents' runs on one deck through the real execute and stop_run", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "agents")
    if (spec === undefined) throw new Error("no agents spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = await replayed(graph, failures)
    expect(failures, JSON.stringify(seen)).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen.landed).toBeGreaterThan(0)
    expect(seen.fenced).toBeGreaterThan(0)
    expect(seen.stopped).toBeGreaterThan(0)
    expect(seen.already).toBeGreaterThan(0)
    expect(seen.restarted).toBeGreaterThan(0)
    expect(seen.stale).toBeGreaterThan(0)
    expect(seen.reread).toBeGreaterThan(0)
  }, 60_000)
})
