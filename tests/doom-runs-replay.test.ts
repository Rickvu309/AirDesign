import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/doom-runs/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Key = "T" | "N"
type RunName = "a" | "b"
type Wrote = "none" | "landed" | "fenced" | "person" | "unexpected"
type World = {
  readonly server: doom.Doom
  readonly tagRev: ReadonlyMap<number, doom.Rev>
  readonly person: boolean
  readonly startA?: doom.Doom
  readonly logA: readonly doom.Landed[]
  readonly wa: Wrote
  readonly wb: Wrote
  readonly ka: "none" | Key
  readonly ua: "none" | "landed" | "empty"
}
type Outcome = { readonly world: World; readonly named?: readonly doom.Write[]; readonly before?: doom.Doom }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const person: doom.Author = { kind: "person", id: "quan" }
const agents: Readonly<Record<RunName, doom.Author>> = {
  a: { kind: "agent", id: "aira", run: "a" },
  b: { kind: "agent", id: "claude", run: "b" },
}
const nodes = {
  deck: doom.nodeId("t:1"),
  row: doom.nodeId("t:2"),
  slide: doom.nodeId("t:3"),
  shape: doom.nodeId("t:4"),
}
const places: Readonly<Record<Key, { readonly node: doom.NodeId; readonly prop: "text" | "notes" }>> = {
  T: { node: nodes.shape, prop: "text" },
  N: { node: nodes.slide, prop: "notes" },
}
const keyNames: readonly Key[] = ["T", "N"]
const writeTag: Readonly<Record<RunName, number>> = { a: 2, b: 5 }

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

function land(
  server: doom.Doom,
  author: doom.Author,
  writes: readonly doom.Write[],
  phase?: "start" | "stop",
): doom.Doom | doom.Refusal {
  return doom.applyEdit(server, landedEdit(server, author, writes, phase))
}

function landedEdit(
  server: doom.Doom,
  author: doom.Author,
  writes: readonly doom.Write[],
  phase?: "start" | "stop",
): doom.Landed {
  return {
    once: `${author.kind}-${author.run ?? author.id}-${server.rev}`,
    author,
    writes,
    ...(phase === undefined ? {} : { phase }),
    rev: doom.rev(server.rev + 1),
  }
}

function must(result: doom.Doom | doom.Refusal): doom.Doom {
  if (doom.isRefusal(result)) throw new Error(`refused ${JSON.stringify(result)}`)
  return result
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
    person: false,
    logA: [],
    wa: "none",
    wb: "none",
    ka: "none",
    ua: "none",
  }
}

const revOf = (doc: doom.Doom, key: Key) => doc.revs.get(places[key].node)?.get(places[key].prop)
const valueOf = (doc: doom.Doom, key: Key) =>
  idOf((doc.nodes.get(places[key].node) as unknown as Record<string, unknown>)[places[key].prop])
const tagOf = (world: World, key: Key) =>
  [...world.tagRev].find(([, landed]) => landed === revOf(world.server, key))?.[0] ?? -1

function phaseOf(world: World, name: RunName): "idle" | "running" | "stopped" {
  return world.server.runs.get(name)?.phase ?? "idle"
}

const guardedFor = (world: World, name: RunName, key: Key) =>
  world.server.runs.get(name)?.guarded.has(places[key].node) ?? false

function observe(world: World): Spec {
  return {
    vT: valueOf(world.server, "T"),
    tT: tagOf(world, "T"),
    vN: valueOf(world.server, "N"),
    tN: tagOf(world, "N"),
    p: world.person,
    ra: phaseOf(world, "a"),
    rb: phaseOf(world, "b"),
    gaT: guardedFor(world, "a", "T"),
    gaN: guardedFor(world, "a", "N"),
    gbT: guardedFor(world, "b", "T"),
    wa: world.wa,
    wb: world.wb,
    ka: world.ka,
    saT: world.startA === undefined ? 0 : valueOf(world.startA, "T"),
    saN: world.startA === undefined ? 0 : valueOf(world.startA, "N"),
    ua: world.ua,
  }
}

function fresh(world: World, key: Key, value: number): doom.Write {
  const base = revOf(world.server, key)
  return { ...places[key], value: wordsOf(value), ...(base === undefined ? {} : { base }) }
}

function personWrites(world: World): Outcome {
  const write = fresh(world, "T", 1)
  const result = land(world.server, person, [write])
  if (doom.isRefusal(result)) return { world }
  return {
    world: { ...world, server: result, person: true, tagRev: new Map([...world.tagRev, [1, result.rev]]) },
    named: [write],
    before: world.server,
  }
}

function runPhase(world: World, name: RunName, phase: "start" | "stop"): Outcome {
  const edit = landedEdit(world.server, agents[name], [], phase)
  const server = must(doom.applyEdit(world.server, edit))
  return {
    world: {
      ...world,
      server,
      ...(name === "a" ? { logA: [...world.logA, edit] } : {}),
      ...(name === "a" && phase === "start" ? { startA: world.server } : {}),
    },
  }
}

function runWrite(world: World, name: RunName, key: Key): Outcome {
  const write = fresh(world, key, writeTag[name])
  const edit = landedEdit(world.server, agents[name], [write])
  const result = doom.applyEdit(world.server, edit)
  const keyed = name === "a" ? { ka: key } : {}
  if (!doom.isRefusal(result)) {
    return {
      world: {
        ...world,
        ...keyed,
        server: result,
        tagRev: new Map([...world.tagRev, [writeTag[name], result.rev]]),
        ...(name === "a" ? { wa: "landed" as const, logA: [...world.logA, edit] } : { wb: "landed" as const }),
      },
      named: [write],
      before: world.server,
    }
  }
  const wrote: Wrote =
    result.refused === "run-fenced" ? "fenced" : result.refused === "person" ? "person" : "unexpected"
  return { world: { ...world, ...keyed, ...(name === "a" ? { wa: wrote } : { wb: wrote }) } }
}

function undoWrites(world: World): readonly doom.Write[] {
  const last = world.logA.at(-1)
  if (world.startA === undefined || last === undefined) return []
  const owned = new Set<doom.Rev>(world.logA.map((each) => each.rev))
  const undo = world.tagRev.get(3)
  if (undo !== undefined) owned.add(undo)
  return doom.invert(
    world.startA,
    world.server,
    { once: last.once, author: person, writes: world.logA.flatMap((each) => each.writes), rev: last.rev },
    owned,
  )
}

function undoA(world: World): Outcome {
  const writes = undoWrites(world)
  if (writes.length === 0) return { world: { ...world, ua: "empty" } }
  const result = land(world.server, person, writes)
  if (doom.isRefusal(result)) return { world: { ...world, ua: "empty" } }
  return {
    world: { ...world, server: result, ua: "landed", tagRev: new Map([...world.tagRev, [3, result.rev]]) },
    named: writes,
    before: world.server,
  }
}

function step(world: World, action: string): readonly Outcome[] {
  if (action === "PersonWrites") return [personWrites(world)]
  if (action === "StartA") return [runPhase(world, "a", "start")]
  if (action === "StartB") return [runPhase(world, "b", "start")]
  if (action === "StopA") return [runPhase(world, "a", "stop")]
  if (action === "StopB") return [runPhase(world, "b", "stop")]
  if (action === "WriteA") return keyNames.map((key) => runWrite(world, "a", key))
  if (action === "WriteB") return [runWrite(world, "b", "T")]
  if (action === "UndoA") return [undoA(world)]
  throw new Error(`${action} is not connected`)
}

function probe(world: World, where: string, failures: string[]) {
  for (const name of ["a", "b"] as const) {
    if (phaseOf(world, name) === "idle") continue
    const again = land(world.server, agents[name], [], "start")
    if (!doom.isRefusal(again) || again.refused !== "run-fenced")
      failures.push(`${where}\n  a second start of run ${name} was not fenced`)
  }
  for (const name of ["a", "b"] as const) {
    if (phaseOf(world, name) !== "running") continue
    for (const key of name === "a" ? keyNames : (["T"] as const)) {
      if (guardedFor(world, name, key)) continue
      const stale = land(world.server, agents[name], [{ ...places[key], value: wordsOf(9), base: doom.rev(0) }])
      if (!doom.isRefusal(stale) || stale.refused !== "stale")
        failures.push(`${where}\n  run ${name}'s write of ${key} on a rev it never read was not refused as stale`)
    }
  }
  if (world.ua === "landed") {
    const again = undoWrites(world)
    const moved = again.filter((write) => {
      const key = keyNames.find((each) => places[each].node === write.node && places[each].prop === write.prop)
      return key === undefined || idOf(write.value) !== valueOf(world.server, key)
    })
    if (moved.length > 0) failures.push(`${where}\n  a second undo of run a would change ${moved.length} properties`)
  }
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

function differences(expected: Spec, found: Spec): string[] {
  return Object.keys(found)
    .filter((key) => expected[key] !== found[key])
    .map((key) => `${key} is ${String(found[key])}, the model says ${String(expected[key])}`)
}

function said(source: Spec, action: string, target: Spec): string {
  return `doom-runs ${view.group(source)}: ${view.state(source)} -${action}-> ${view.group(target)}: ${view.state(target)}`
}

function replayed(graph: Graph, failures: string[]) {
  const first = [...graph.states].find(
    ([, state]) => state.ra === "idle" && state.rb === "idle" && state.p === false && state.vT === 0,
  )
  if (first === undefined) throw new Error("no initial state")
  const reached = new Map<string, World>([[first[0], opened()]])
  const queued = [first[0]]
  const seen = { edges: 0, landed: 0, fenced: 0, protected: 0, undone: 0, empty: 0 }
  while (queued.length > 0) {
    const from = queued.shift() as string
    const world = reached.get(from) as World
    const source = graph.states.get(from) as Spec
    const found = differences(source, observe(world))
    if (found.length > 0) failures.push(`doom-runs ${view.state(source)}\n  the code holds ${found.join("; ")}`)
    probe(world, `doom-runs ${view.group(source)}: ${view.state(source)}`, failures)
    for (const edge of graph.edges.filter((each) => each.from === from)) {
      const target = graph.states.get(edge.to) as Spec
      const where = said(source, edge.action, target)
      seen.edges += 1
      const outcomes = step(world, edge.action)
      const matching = outcomes.filter((outcome) => differences(target, observe(outcome.world)).length === 0)
      if (matching.length === 0) {
        failures.push(`${where}\n  the code disagrees: ${differences(target, observe(outcomes[0]!.world)).join("; ")}`)
        continue
      }
      const outcome = matching[0] as Outcome
      if (outcome.named !== undefined && outcome.before !== undefined) {
        const moved = changedOutside(outcome.before, outcome.world.server, outcome.named)
        if (moved.length > 0)
          failures.push(`${where}\n  the edit changed properties it did not name: ${moved.join(", ")}`)
        seen.landed += 1
      }
      if (target.wa !== source.wa && target.wa === "fenced") seen.fenced += 1
      if ((target.wa !== source.wa && target.wa === "person") || (target.wb !== source.wb && target.wb === "person"))
        seen.protected += 1
      if (target.ua !== source.ua && target.ua === "landed") seen.undone += 1
      if (target.ua !== source.ua && target.ua === "empty") seen.empty += 1
      if (!reached.has(edge.to)) {
        reached.set(edge.to, outcome.world)
        queued.push(edge.to)
      }
    }
  }
  for (const [id, state] of graph.states)
    if (!reached.has(id)) failures.push(`doom-runs state ${view.state(state)} was not reached`)
  return seen
}

describe("doom runs replay", () => {
  it("drives every edge of two agent runs, a person's write and the undo of a run through the real doom core", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "doom-runs")
    if (spec === undefined) throw new Error("no doom-runs spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = replayed(graph, failures)
    expect(failures, JSON.stringify(seen)).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen.landed).toBeGreaterThan(0)
    expect(seen.fenced).toBeGreaterThan(0)
    expect(seen.protected).toBeGreaterThan(0)
    expect(seen.undone).toBeGreaterThan(0)
    expect(seen.empty).toBeGreaterThan(0)
  }, 60_000)
})
