import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck } from "@airdesign/live"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/undo-moves/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Seen = {
  readonly pG: number
  readonly pJ: number
  readonly wG: number
  readonly wJ: number
  readonly gone: number
  readonly told: string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const id = doom.nodeId
const [deckNode, row] = [id("m:1"), id("m:2")] as const
const layers = [id("m:3"), id("m:4"), id("m:5"), id("m:6"), id("m:7")] as const
const [slide, outer, group, inner, side] = layers
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const frame = (node: doom.NodeId, parent: doom.NodeId): readonly doom.Write[] => [
  { node, prop: "type", value: "frame" },
  { node, prop: "parent", value: at(parent) },
]

const start: doom.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    ...frame(outer, slide),
    ...frame(side, slide),
    ...frame(group, outer),
    ...frame(inner, group),
  ],
}

const moved = { G: group, J: inner } as const

async function join(remote: ReturnType<typeof memoryDoomRemote>, client: string, how: "create" | "open") {
  let next = 0
  const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "moves", {
    once: () => `${client}-${(next += 1)}`,
    client,
    storage: memoryStorage(),
    pause: () => Promise.resolve(),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

const parentOf = (now: doom.Doom, node: doom.NodeId) =>
  (now.nodes.get(node) as { parent?: { id: doom.NodeId } | null } | undefined)?.parent
const codeOf = (now: doom.Doom, node: doom.NodeId) => {
  const parent = parentOf(now, node)
  return parent == null ? -1 : layers.indexOf(parent.id as (typeof layers)[number])
}
const goneOf = (now: doom.Doom) => (parentOf(now, outer) === null ? 1 : parentOf(now, side) === null ? 4 : 0)

const movedIn = (from: Spec, to: Spec): readonly ("G" | "J")[] =>
  (["G", "J"] as const).filter((name) => from[`p${name}`] !== to[`p${name}`])

function moveOf(from: Spec, to: Spec): doom.Write {
  const [name] = movedIn(from, to)
  if (name === undefined) throw new Error("the model moves no layer")
  return { node: moved[name], prop: "parent", value: at(layers[Number(to[`p${name}`])]!) }
}

const answers = {
  Undo: { ok: "undone", nothing: "nothing to undo", refused: "undo refused" },
  Redo: { ok: "redone", nothing: "nothing to redo", refused: "redo refused" },
} as const

async function played(route: readonly { readonly action: string; readonly from: Spec; readonly to: Spec }[]) {
  const remote = memoryDoomRemote(start)
  const mine = await join(remote, "a", "create")
  const theirs = await join(remote, "b", "open")
  const edits = new Map<string, number>([["start", 0]])
  let landed = 0
  let told = "none"
  const named = (once: string) => edits.set(once, (landed += 1))
  const fromTheirs = async (writes: readonly doom.Write[]) => {
    await theirs.catchUp()
    const pushed = theirs.push(writes)
    if (!("once" in pushed)) throw new Error(`the other tab sent nothing: ${JSON.stringify(pushed)}`)
    named(pushed.once)
    expect(await theirs.sync()).toEqual({ ok: true })
    await mine.catchUp()
  }
  for (const { action, from, to } of route) {
    if (action === "PersonStep") {
      const pushed = mine.push([moveOf(from, to)])
      if (!("once" in pushed)) throw new Error(`the step sent nothing: ${JSON.stringify(pushed)}`)
      named(pushed.once)
      told = "none"
    } else if (action === "OtherMove") {
      await fromTheirs([moveOf(from, to)])
      told = "none"
    } else if (action === "OtherDelete") {
      await fromTheirs([{ node: Number(to.gone) === 1 ? outer : side, prop: "parent", value: null }])
      told = "none"
    } else if (action === "Undo" || action === "Redo") {
      const turned = action === "Undo" ? mine.undo() : mine.redo()
      if (turned.ok) named(turned.once)
      told = answers[action][turned.ok ? "ok" : turned.reason]
    } else throw new Error(`no step for ${action}`)
    expect(await mine.sync()).toEqual({ ok: true })
  }
  const now = mine.view()
  const writerOf = (node: doom.NodeId) => {
    const writer = now.revs.get(node)?.get("parent")
    const once = [...now.onces].find(([, rev]) => rev === writer)?.[0]
    return once === undefined ? -1 : (edits.get(once) ?? -1)
  }
  const seen: Seen = {
    pG: codeOf(now, group),
    pJ: codeOf(now, inner),
    wG: writerOf(group),
    wJ: writerOf(inner),
    gone: goneOf(now),
    told,
  }
  const server = mine.server()
  const agreed = codeOf(server, group) === seen.pG && codeOf(server, inner) === seen.pJ && goneOf(server) === seen.gone
  return { seen, agreed }
}

function differences(expected: Spec, found: Seen): string[] {
  return (Object.keys(found) as (keyof Seen)[])
    .filter((key) => expected[key] !== found[key])
    .map((key) => `${key} is ${String(found[key])}, the model says ${String(expected[key])}`)
}

const said = (spec: Spec) => `${view.group(spec)}: ${view.state(spec)}`

const insideOf = (spec: Spec, node: number, frame: number) => {
  for (let at = frame, hops = 0; at > 0 && hops < 5; hops += 1) {
    if (at === node) return true
    at = at === 2 ? Number(spec.pG) : at === 3 ? Number(spec.pJ) : 0
  }
  return false
}

async function replayed(graph: Graph, failures: string[]) {
  const firsts = [...graph.states].filter(([, state]) => state.n === 0).map(([name]) => name)
  if (firsts.length === 0) throw new Error("no initial state")
  type Leg = { readonly action: string; readonly from: Spec; readonly to: Spec }
  const paths = new Map<string, readonly Leg[]>(firsts.map((name) => [name, []]))
  const queued = [...firsts]
  const seen = { starts: firsts.length, edges: 0, leftInside: 0, leftUnderDeleted: 0, putBack: 0 }
  while (queued.length > 0) {
    const from = queued.shift() as string
    const source = graph.states.get(from) as Spec
    for (const edge of graph.edges.filter((each) => each.from === from)) {
      const target = graph.states.get(edge.to) as Spec
      const route = [...(paths.get(from) as readonly Leg[]), { action: edge.action, from: source, to: target }]
      seen.edges += 1
      const found = await played(route).then(
        ({ seen, agreed }) => [
          ...differences(target, seen),
          ...(agreed ? [] : ["the server does not hold what the tab shows"]),
        ],
        (error: unknown) => [error instanceof Error ? error.message : String(error)],
      )
      if (found.length > 0)
        failures.push(
          `undo-moves ${said(source)} -${edge.action}-> ${said(target)}\n  the code disagrees: ${found.join("; ")}`,
        )
      const stack = edge.action === "Undo" ? Number(source.us) : Number(source.rs)
      const slot = Number(source[`s${String(stack % 8)}`] ?? 0)
      const [node, back] = [Math.floor(slot / 10) % 10, slot % 10]
      if (String(target.told).startsWith("nothing") && insideOf(source, node, back)) seen.leftInside += 1
      if (String(target.told).startsWith("nothing") && Number(source.gone) === 1 && back === 2)
        seen.leftUnderDeleted += 1
      if (target.told === "undone" || target.told === "redone") seen.putBack += 1
      if (!paths.has(edge.to)) {
        paths.set(edge.to, route)
        queued.push(edge.to)
      }
    }
  }
  for (const [state, spec] of graph.states)
    if (!paths.has(state)) failures.push(`undo-moves ${said(spec)} was not reached`)
  return seen
}

describe("undo moves replay", () => {
  it("drives every edge of the person's moves, another tab's move and delete, undo and redo through the real device deck", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "undo-moves")
    if (spec === undefined) throw new Error("no undo-moves spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = await replayed(graph, failures)
    expect(failures.slice(0, 5), `${failures.length} edges disagree; ${JSON.stringify(seen)}`).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen).toMatchObject({ starts: 1 })
    expect(seen.leftInside).toBeGreaterThan(0)
    expect(seen.leftUnderDeleted).toBeGreaterThan(0)
    expect(seen.putBack).toBeGreaterThan(0)
  }, 120_000)
})
