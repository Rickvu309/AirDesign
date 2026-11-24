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
  readonly base: Readonly<Record<Agent, number>>
  readonly xRevs: readonly number[]
  readonly ids: Readonly<Partial<Record<ModelRun, string>>>
  readonly out: string
  readonly overwrote: boolean
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

function opened(): { readonly server: doom.Doom; readonly x: string } {
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

function hosted(server: doom.Doom): { readonly host: DeckHost; readonly now: () => doom.Doom } {
  let fold = server
  const host: DeckHost = {
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
  return { host, now: () => fold }
}

async function call(
  world: World,
  by: Agent,
  op: string,
  args: unknown,
): Promise<{ readonly answer: Record<string, unknown>; readonly server: doom.Doom; readonly calls: number }> {
  const { host, now } = hosted(world.server)
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
  return { answer: result.answer as Record<string, unknown>, server: now(), calls }
}

function phaseOf(world: World, run: ModelRun): "idle" | "running" | "stopped" {
  const id = world.ids[run]
  return id === undefined ? "idle" : (world.server.runs.get(id)?.phase ?? "idle")
}

const verAt = (world: World, base: number) => world.xRevs.filter((each) => each <= base).length

function observe(world: World): Spec {
  return {
    pa1: phaseOf(world, "a1"),
    pa2: phaseOf(world, "a2"),
    pb1: phaseOf(world, "b1"),
    pb2: phaseOf(world, "b2"),
    ver: world.xRevs.length,
    readA: verAt(world, world.base.a),
    readB: verAt(world, world.base.b),
    out: world.out,
    overwrote: world.overwrote,
    mixed: world.mixed,
    stoppedOther: world.stoppedOther,
  }
}

const refusalOf = (answer: Record<string, unknown>) =>
  answer.ok === true ? undefined : typeof answer.refusal === "string" ? answer.refusal : "unexpected"

async function reads(world: World, by: Agent): Promise<World> {
  const done = await call(world, by, "read_deck", { deck })
  const rev = done.answer.rev
  if (typeof rev !== "number") throw new Error(`read_deck answered ${JSON.stringify(done.answer)}`)
  return { ...world, calls: done.calls, base: { ...world.base, [by]: rev }, out: "none" }
}

async function edits(world: World, by: Agent, run?: ModelRun): Promise<World> {
  const fresh = owned[by].find((each) => world.ids[each] === undefined)
  const into = run ?? fresh
  if (into === undefined) return { ...world, out: "a third run, beyond the model" }
  const named = run === undefined ? undefined : world.ids[run]
  const done = await call(world, by, "edit_deck", {
    deck,
    base: world.base[by],
    changes: [{ op: "set", target: start.x, text: `${by}${String(world.calls + 1)}` }],
    ...(named === undefined ? {} : { runId: named }),
  })
  const refusal = refusalOf(done.answer)
  if (refusal !== undefined) return { ...world, calls: done.calls, out: refusal }
  const rev = done.answer.rev
  const runId = done.answer.runId
  if (typeof rev !== "number" || typeof runId !== "string")
    throw new Error(`edit_deck answered ${JSON.stringify(done.answer)}`)
  const lastX = world.xRevs.at(-1) ?? 0
  return {
    ...world,
    calls: done.calls,
    server: done.server,
    base: { ...world.base, [by]: rev },
    xRevs: [...world.xRevs, rev],
    ids: run === undefined ? { ...world.ids, [into]: runId } : world.ids,
    out: "landed",
    overwrote: world.overwrote || world.base[by] < lastX,
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

async function step(world: World, action: string): Promise<readonly World[]> {
  const named = modelRuns.filter((run) => world.ids[run] !== undefined)
  if (action === "AgentReads") return Promise.all(agentNames.map((by) => reads(world, by)))
  if (action === "AgentStarts") return Promise.all(agentNames.map((by) => edits(world, by)))
  if (action === "AgentWrites")
    return Promise.all(agentNames.flatMap((by) => named.map((run) => edits(world, by, run))))
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
  const first = [...graph.states].find(([, state]) => state.ver === 0 && state.pa1 === "idle" && state.pb1 === "idle")
  if (first === undefined) throw new Error("no initial state")
  const empty: World = {
    server: start.server,
    base: { a: start.server.rev, b: start.server.rev },
    xRevs: [],
    ids: {},
    out: "none",
    overwrote: false,
    mixed: false,
    stoppedOther: false,
    calls: 0,
  }
  const reached = new Map<string, World>([[first[0], empty]])
  const queued = [first[0]]
  const seen = { edges: 0, landed: 0, fenced: 0, stale: 0, stopped: 0, already: 0, restarted: 0 }
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
        if (target.out === "landed") seen.landed += 1
        if (target.out === "run-fenced") seen.fenced += 1
        if (target.out === "stale") seen.stale += 1
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
  it("drives every edge of two agents' runs on one deck through the real edit_deck, stop_run and read_deck", async () => {
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
    expect(seen.stale).toBeGreaterThan(0)
    expect(seen.stopped).toBeGreaterThan(0)
    expect(seen.already).toBeGreaterThan(0)
    expect(seen.restarted).toBeGreaterThan(0)
  }, 60_000)
})
