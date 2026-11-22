import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderKeyBetween, doom } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/doom/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Key = "T" | "N"
type Phase = "none" | "pending" | "landed" | "refused" | "dropped"
type Draft = { readonly writes: readonly doom.Write[]; readonly bases: Readonly<Record<number, number>> }
type World = {
  readonly server: doom.Doom
  readonly tagRev: ReadonlyMap<number, doom.Rev>
  readonly phases: Readonly<Record<"s" | "u" | "r", Phase>>
  readonly drafts: Readonly<Partial<Record<"s" | "u" | "r", Draft>>>
  readonly viewBefore: Readonly<Partial<Record<"s" | "u", doom.Doom>>>
  readonly sb: readonly [number, number]
  readonly before: readonly [number, number]
  readonly uK: number
  readonly rK: number
  readonly turns: number
  readonly told: "none" | "empty" | "stale"
  readonly g: "none" | "landed" | "fenced" | "person" | "unexpected"
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const person: doom.Author = { kind: "person", id: "quan" }
const agent: doom.Author = { kind: "agent", id: "aira", run: "r" }
const nodes = {
  deck: doom.nodeId("t:1"),
  row: doom.nodeId("t:2"),
  slide: doom.nodeId("t:3"),
  shape: doom.nodeId("t:4"),
}
const places: Readonly<
  Record<Key, { readonly node: doom.NodeId; readonly prop: "text" | "notes"; readonly bit: 1 | 2 }>
> = {
  T: { node: nodes.shape, prop: "text", bit: 1 },
  N: { node: nodes.slide, prop: "notes", bit: 2 },
}
const keyNames: readonly Key[] = ["T", "N"]
const tagOfDraft = { s: 1, u: 3, r: 4 } as const
const order = ["s", "u", "r"] as const

const wordsOf = (id: number): doom.Text => ({
  chars: String(id),
  spans: [],
  paras: [{}],
  style: "body",
  resize: "height",
  alignV: "top",
})
const idOf = (value: unknown): number => Number((value as doom.Text).chars)
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })

function must(result: doom.Doom | doom.Refusal): doom.Doom {
  if (doom.isRefusal(result)) throw new Error(`refused ${JSON.stringify(result)}`)
  return result
}

function land(server: doom.Doom, author: doom.Author, writes: readonly doom.Write[], phase?: "start" | "stop") {
  return doom.applyEdit(server, {
    once: `${author.kind}-${server.rev}`,
    author,
    writes,
    ...(phase === undefined ? {} : { phase }),
    rev: doom.rev(server.rev + 1),
  })
}

function opened(): World {
  const server = must(
    land(doom.emptyDoom, person, [
      { node: nodes.deck, prop: "type", value: "deck" },
      { node: nodes.row, prop: "type", value: "slideRow" },
      { node: nodes.row, prop: "parent", value: at(nodes.deck) },
      { node: nodes.slide, prop: "type", value: "slide" },
      { node: nodes.slide, prop: "parent", value: at(nodes.row) },
      { node: nodes.slide, prop: "notes", value: wordsOf(0) },
      { node: nodes.shape, prop: "type", value: "shape" },
      { node: nodes.shape, prop: "parent", value: at(nodes.slide) },
      { node: nodes.shape, prop: "text", value: wordsOf(0) },
    ]),
  )
  return {
    server,
    tagRev: new Map([[0, server.rev]]),
    phases: { s: "none", u: "none", r: "none" },
    drafts: {},
    viewBefore: {},
    sb: [0, 0],
    before: [0, 0],
    uK: 0,
    rK: 0,
    turns: 0,
    told: "none",
    g: "none",
  }
}

const queue = (world: World): readonly doom.Edit[] =>
  order
    .filter((name) => world.phases[name] === "pending")
    .map((name) => ({ once: name, author: person, writes: world.drafts[name]?.writes ?? [] }))

const viewNow = (world: World) => doom.viewOf(world.server, queue(world))

const tagOfRev = (world: World, rev: doom.Rev | undefined): number | undefined =>
  rev === undefined ? undefined : [...world.tagRev].find(([, landed]) => landed === rev)?.[0]

function viewTag(world: World, shown: doom.Doom, key: Key): number {
  const rev = shown.revs.get(places[key].node)?.get(places[key].prop)
  if (rev === undefined) throw new Error("no rev")
  if (rev <= world.server.rev) return tagOfRev(world, rev) ?? -1
  const pending = order.filter((name) => world.phases[name] === "pending")
  const name = pending[rev - world.server.rev - 1]
  return name === undefined ? -1 : tagOfDraft[name]
}

const viewValue = (shown: doom.Doom, key: Key): number =>
  idOf((shown.nodes.get(places[key].node) as unknown as Record<string, unknown>)[places[key].prop])

const serverValue = (world: World, key: Key) => viewValue(world.server, key)
const serverTag = (world: World, key: Key) =>
  tagOfRev(world, world.server.revs.get(places[key].node)?.get(places[key].prop)) ?? -1

const has = (mask: number, bit: number) => Math.floor(mask / bit) % 2 === 1

function modelView(spec: Spec, key: Key): { readonly tag: number; readonly value: number } {
  const bit = places[key].bit
  const before = key === "T" ? spec.bT : spec.bN
  if (spec.r === "pending" && has(spec.rK as number, bit)) return { tag: 4, value: 1 }
  if (spec.u === "pending" && has(spec.uK as number, bit)) return { tag: 3, value: before as number }
  if (spec.s === "pending") return { tag: 1, value: 1 }
  return {
    tag: key === "T" ? (spec.tT as number) : (spec.tN as number),
    value: key === "T" ? (spec.vT as number) : (spec.vN as number),
  }
}

function observe(world: World): Spec {
  const phase = world.server.runs.get("r")?.phase
  const guarded = world.server.runs.get("r")?.guarded
  return {
    vT: serverValue(world, "T"),
    tT: serverTag(world, "T"),
    vN: serverValue(world, "N"),
    tN: serverTag(world, "N"),
    s: world.phases.s,
    u: world.phases.u,
    r: world.phases.r,
    sbT: world.sb[0],
    sbN: world.sb[1],
    bT: world.before[0],
    bN: world.before[1],
    uK: world.uK,
    rK: world.rK,
    run: phase === "running" ? "running" : phase === "stopped" ? "stopped" : "idle",
    gT: guarded?.has(nodes.shape) ?? false,
    gN: guarded?.has(nodes.slide) ?? false,
    g: world.g,
    told: world.told,
    turns: world.turns,
  }
}

const mask = (writes: readonly doom.Write[]) =>
  writes.reduce((sum, write) => sum + (write.node === nodes.shape ? 1 : write.node === nodes.slide ? 2 : 0), 0)

function draftOf(writes: readonly doom.Write[], base: number): Draft {
  return { writes: writes.map(({ node, prop, value }) => ({ node, prop, value })), bases: { 1: base, 2: base } }
}

function invertedEdit(world: World, name: "s" | "u", shown: doom.Doom): doom.Landed {
  const draft = world.drafts[name]
  if (draft === undefined) throw new Error(`no ${name} draft`)
  const phase = world.phases[name]
  const named = draft.writes[0]
  const rev =
    phase === "landed"
      ? (world.tagRev.get(tagOfDraft[name]) as doom.Rev)
      : phase === "pending" && named !== undefined
        ? (shown.revs.get(named.node)?.get(named.prop) as doom.Rev)
        : doom.rev(world.server.rev + 1_000)
  return { once: name, author: person, writes: draft.writes, rev }
}

function realWrites(world: World, draft: Draft): readonly doom.Write[] {
  return draft.writes.map((write) => {
    const bit = write.node === nodes.shape ? 1 : 2
    const tag = draft.bases[bit] as number
    return { ...write, base: world.tagRev.get(tag) ?? doom.rev(0) }
  })
}

function changedOutside(before: doom.Doom, after: doom.Doom, named: readonly doom.Write[]): string[] {
  const touched = new Set(named.map((write) => `${write.node}/${write.prop}`))
  const found: string[] = []
  for (const [id, node] of after.nodes) {
    const was = before.nodes.get(id) as unknown as Record<string, unknown> | undefined
    const now = node as unknown as Record<string, unknown>
    for (const prop of new Set([...Object.keys(now), ...Object.keys(was ?? {})])) {
      if (prop === "rev" || touched.has(`${id}/${prop}`)) continue
      if (JSON.stringify(was?.[prop]) !== JSON.stringify(now[prop])) found.push(`${id}/${prop}`)
    }
  }
  return found
}

type Outcome = { readonly world: World; readonly named?: readonly doom.Write[]; readonly before?: doom.Doom }

function turn(world: World, name: "u" | "r", target: Spec): Outcome | null {
  const source = name === "u" ? "s" : "u"
  const shown = viewNow(world)
  const writes = doom.invert(world.viewBefore[source] as doom.Doom, shown, invertedEdit(world, source, shown))
  const kept = mask(writes)
  const wanted = (name === "u" ? target.uK : target.rK) as number
  if (kept !== wanted) return null
  const restored = writes.every(
    (write) =>
      idOf(write.value) === (name === "u" ? (write.node === nodes.shape ? world.before[0] : world.before[1]) : 1),
  )
  if (!restored) return null
  const stepped: World = { ...world, turns: world.turns + 1, ...(name === "u" ? { uK: kept } : { rK: kept }) }
  if (writes.length === 0) {
    return {
      world: { ...stepped, phases: { ...world.phases, [name]: "dropped" }, told: "empty" },
    }
  }
  return {
    world: {
      ...stepped,
      phases: { ...world.phases, [name]: "pending" },
      drafts: { ...world.drafts, [name]: draftOf(writes, tagOfDraft[source]) },
      viewBefore: name === "u" ? { ...world.viewBefore, u: shown } : world.viewBefore,
    },
  }
}

function sync(world: World, name: "s" | "u" | "r"): Outcome {
  const draft = world.drafts[name]
  if (draft === undefined) throw new Error(`no ${name} draft`)
  const writes = realWrites(world, draft)
  const result = land(world.server, person, writes)
  if (doom.isRefusal(result)) {
    expect(result.refused, `${name} refused`).toBe("stale")
    return { world: { ...world, phases: { ...world.phases, [name]: "refused" }, told: "stale" } }
  }
  return {
    world: {
      ...world,
      server: result,
      tagRev: new Map([...world.tagRev, [tagOfDraft[name], result.rev]]),
      phases: { ...world.phases, [name]: "landed" },
    },
    named: writes,
    before: world.server,
  }
}

function agentAttempts(world: World): readonly Outcome[] {
  return keyNames.map((key) => {
    const place = places[key]
    const base = world.server.revs.get(place.node)?.get(place.prop)
    const write: doom.Write = {
      node: place.node,
      prop: place.prop,
      value: wordsOf(2),
      ...(base === undefined ? {} : { base }),
    }
    const result = land(world.server, agent, [write])
    if (!doom.isRefusal(result)) {
      return {
        world: { ...world, server: result, tagRev: new Map([...world.tagRev, [2, result.rev]]), g: "landed" as const },
        named: [write],
        before: world.server,
      }
    }
    const g = result.refused === "run-fenced" ? "fenced" : result.refused === "person" ? "person" : "unexpected"
    return { world: { ...world, g } }
  })
}

function runPhase(world: World, phase: "start" | "stop"): Outcome {
  return { world: { ...world, server: must(land(world.server, agent, [], phase)) } }
}

function personStep(world: World): Outcome {
  const shown = viewNow(world)
  const sb = [viewTag(world, shown, "T"), viewTag(world, shown, "N")] as const
  const before = [viewValue(shown, "T"), viewValue(shown, "N")] as const
  const writes: readonly doom.Write[] = keyNames.map((key) => ({
    node: places[key].node,
    prop: places[key].prop,
    value: wordsOf(1),
  }))
  return {
    world: {
      ...world,
      phases: { ...world.phases, s: "pending" },
      drafts: { ...world.drafts, s: { writes, bases: { 1: sb[0], 2: sb[1] } } },
      viewBefore: { ...world.viewBefore, s: shown },
      sb,
      before,
    },
  }
}

function differences(expected: Spec, found: Spec): string[] {
  return Object.keys(found)
    .filter((key) => expected[key] !== found[key])
    .map((key) => `${key} is ${String(found[key])}, the model says ${String(expected[key])}`)
}

function said(source: Spec, action: string, target: Spec): string {
  return `doom ${view.group(source)}: ${view.state(source)} -${action}-> ${view.group(target)}: ${view.state(target)}`
}

function judgeView(world: World, spec: Spec, failures: string[], where: string) {
  const shown = viewNow(world)
  for (const key of keyNames) {
    const expected = modelView(spec, key)
    const found = { tag: viewTag(world, shown, key), value: viewValue(shown, key) }
    if (found.tag !== expected.tag || found.value !== expected.value)
      failures.push(
        `${where}\n  the view of ${key} is ${JSON.stringify(found)}, the model says ${JSON.stringify(expected)}`,
      )
  }
  const stepWrites = world.drafts.s
  if (world.phases.u === "landed" && world.phases.s === "landed" && stepWrites !== undefined) {
    const second = doom.invert(world.viewBefore.s as doom.Doom, world.server, invertedEdit(world, "s", shown))
    if (second.length > 0)
      failures.push(`${where}\n  a second undo of the step would still put back ${second.length} properties`)
  }
}

function step(world: World, action: string, target: Spec): readonly Outcome[] {
  if (action === "PersonStep") return [personStep(world)]
  if (action === "PersonUndo" || action === "PersonRedo") {
    const outcome = turn(world, action === "PersonUndo" ? "u" : "r", target)
    return outcome === null ? [] : [outcome]
  }
  if (action === "SyncStep") return [sync(world, "s")]
  if (action === "SyncUndo") return [sync(world, "u")]
  if (action === "SyncRedo") return [sync(world, "r")]
  if (action === "AgentStart") return [runPhase(world, "start")]
  if (action === "AgentStop") return [runPhase(world, "stop")]
  if (action === "AgentWrite") return agentAttempts(world)
  throw new Error(`${action} is not connected`)
}

function replayed(graph: Graph, failures: string[]) {
  const first = [...graph.states].find(
    ([, state]) =>
      state.s === "none" && state.run === "idle" && state.vT === 0 && state.turns === 0 && state.g === "none",
  )
  if (first === undefined) throw new Error("no initial state")
  const reached = new Map<string, World>([[first[0], opened()]])
  const queued = [first[0]]
  const seen = { edges: 0, refused: 0, dropped: 0, agentRefused: 0, landed: 0 }
  while (queued.length > 0) {
    const from = queued.shift() as string
    const world = reached.get(from) as World
    const source = graph.states.get(from) as Spec
    judgeView(world, source, failures, `doom ${view.group(source)}: ${view.state(source)}`)
    for (const edge of graph.edges.filter((each) => each.from === from)) {
      const target = graph.states.get(edge.to) as Spec
      const where = said(source, edge.action, target)
      seen.edges += 1
      const outcomes = step(world, edge.action, target)
      const matching = outcomes.filter((outcome) => differences(target, observe(outcome.world)).length === 0)
      if (matching.length === 0) {
        const nearest = outcomes[0]
        failures.push(
          `${where}\n  the code disagrees: ${nearest === undefined ? "no real step produced the model's undo" : differences(target, observe(nearest.world)).join("; ")}`,
        )
        continue
      }
      const outcome = matching[0] as Outcome
      if (outcome.named !== undefined && outcome.before !== undefined) {
        const moved = changedOutside(outcome.before, outcome.world.server, outcome.named)
        if (moved.length > 0)
          failures.push(`${where}\n  the edit changed properties it did not name: ${moved.join(", ")}`)
        seen.landed += 1
      }
      if (target.told !== source.told && target.told === "stale") seen.refused += 1
      if (target.told !== source.told && target.told === "empty") seen.dropped += 1
      if (target.g === "fenced" || target.g === "person") seen.agentRefused += 1
      if (!reached.has(edge.to)) {
        reached.set(edge.to, outcome.world)
        queued.push(edge.to)
      }
    }
  }
  for (const [id, state] of graph.states)
    if (!reached.has(id)) failures.push(`doom state ${view.state(state)} was not reached`)
  return seen
}

describe("doom replay", () => {
  it("drives every edge of a person's step, undo and redo against an agent's run through the real doom core", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "doom")
    if (spec === undefined) throw new Error("no doom spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = replayed(graph, failures)
    expect(failures, JSON.stringify(seen)).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen.landed).toBeGreaterThan(0)
    expect(seen.refused).toBeGreaterThan(0)
    expect(seen.dropped).toBeGreaterThan(0)
    expect(seen.agentRefused).toBeGreaterThan(0)
  }, 60_000)
})
