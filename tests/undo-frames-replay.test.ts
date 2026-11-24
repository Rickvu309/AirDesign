import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck } from "@airdesign/live"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/undo-frames/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Seen = {
  readonly pK: number
  readonly pH?: number
  readonly pX: number
  readonly wK: number
  readonly wH?: number
  readonly wX: number
  readonly gone: number
  readonly told: string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const id = doom.nodeId
const [deckNode, row] = [id("f:1"), id("f:2")] as const
const layers = [id("f:3"), id("f:4"), id("f:5"), id("f:6"), id("f:7"), id("a:1")] as const
const [slide, outer, inner, card, side, wrap] = layers
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
    ...frame(inner, outer),
    { node: card, prop: "type", value: "shape" },
    { node: card, prop: "parent", value: at(inner) },
    ...frame(side, slide),
  ],
}

async function join(remote: ReturnType<typeof memoryDoomRemote>, client: string, how: "create" | "open") {
  let next = 0
  const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "frames", {
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
const goneOf = (now: doom.Doom, theirs: ReadonlySet<string>) => {
  const writer = now.revs.get(wrap)?.get("parent")
  const wrapGone =
    parentOf(now, wrap) === null && [...now.onces].some(([once, at]) => at === writer && theirs.has(once))
  return (
    ([outer, inner, side, wrap] as const)
      .map((each, index) => (parentOf(now, each) === null ? [1, 2, 4, 5][index]! : 0))
      .find((code) => code !== 0 && (code !== 5 || wrapGone)) ?? 0
  )
}

function moveOf(from: Spec, to: Spec): doom.Write {
  if (from.pK !== to.pK) return { node: card, prop: "parent", value: at(layers[Number(to.pK)]!) }
  if (from.pH !== to.pH) return { node: side, prop: "parent", value: at(layers[Number(to.pH)]!) }
  throw new Error("the model moves no layer")
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
  const sent = new Set<string>()
  const fromTheirs = async (writes: readonly doom.Write[]) => {
    await theirs.catchUp()
    const pushed = theirs.push(writes)
    if (!("once" in pushed)) throw new Error(`the other tab sent nothing: ${JSON.stringify(pushed)}`)
    named(pushed.once)
    sent.add(pushed.once)
    expect(await theirs.sync()).toEqual({ ok: true })
    await mine.catchUp()
  }
  const stepped = (writes: readonly doom.Write[]) => {
    const pushed = mine.push(writes)
    if (!("once" in pushed)) throw new Error(`the step sent nothing: ${JSON.stringify(pushed)}`)
    named(pushed.once)
  }
  for (const { action, from, to } of route) {
    if (action === "PersonDrag") stepped([moveOf(from, to)])
    else if (action === "PersonFrame")
      stepped([...frame(wrap, layers[Number(from.pK)]!), { node: card, prop: "parent", value: at(wrap) }])
    else if (action === "OtherDrag") await fromTheirs([moveOf(from, to)])
    else if (action === "OtherDelete") {
      const gone = { 1: outer, 2: inner, 4: side, 5: wrap }[Number(to.gone)]!
      await fromTheirs([{ node: gone, prop: "parent", value: null }])
    } else if (action === "Undo" || action === "Redo") {
      const turned = action === "Undo" ? mine.undo() : mine.redo()
      if (turned.ok) named(turned.once)
      told = answers[action][turned.ok ? "ok" : turned.reason]
    } else throw new Error(`no step for ${action}`)
    if (action !== "Undo" && action !== "Redo") told = "none"
    expect(await mine.sync()).toEqual({ ok: true })
  }
  const now = mine.view()
  const writerOf = (node: doom.NodeId) => {
    if (!now.nodes.has(node)) return 0
    const writer = now.revs.get(node)?.get("parent")
    const once = [...now.onces].find(([, rev]) => rev === writer)?.[0]
    return once === undefined ? -1 : (edits.get(once) ?? -1)
  }
  const gone = goneOf(now, sent)
  const seen: Seen = {
    pK: codeOf(now, card),
    ...(gone === 4 ? {} : { pH: codeOf(now, side), wH: writerOf(side) }),
    pX: codeOf(now, wrap),
    wK: writerOf(card),
    wX: writerOf(wrap),
    gone,
    told,
  }
  const server = mine.server()
  const agreed =
    codeOf(server, card) === seen.pK &&
    codeOf(server, side) === (seen.pH ?? -1) &&
    codeOf(server, wrap) === seen.pX &&
    goneOf(server, sent) === seen.gone
  return { seen, agreed }
}

function differences(model: Spec, found: Seen): string[] {
  const expected = Number(model.gone) === 5 ? { ...model, pX: -1 } : model
  return (Object.keys(found) as (keyof Seen)[])
    .filter((key) => expected[key] !== found[key])
    .map((key) => `${key} is ${String(found[key])}, the model says ${String(expected[key])}`)
}

const said = (spec: Spec) => `${view.group(spec)}: ${view.state(spec)}`

async function replayed(graph: Graph, failures: string[]) {
  const firsts = [...graph.states].filter(([, state]) => state.n === 0).map(([name]) => name)
  if (firsts.length === 0) throw new Error("no initial state")
  type Leg = { readonly action: string; readonly from: Spec; readonly to: Spec }
  const paths = new Map<string, readonly Leg[]>(firsts.map((name) => [name, []]))
  const queued = [...firsts]
  const seen = { starts: firsts.length, edges: 0, framesKept: 0, framesDeleted: 0, putBack: 0, theirX: 0 }
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
          `undo-frames ${said(source)} -${edge.action}-> ${said(target)}\n  the code disagrees: ${found.join("; ")}`,
        )
      const stack = edge.action === "Undo" ? Number(source.us) : Number(source.rs)
      const slot = Number(source[`s${String(stack % 8)}`] ?? 0)
      const deletes = (edge.action === "Undo" || edge.action === "Redo") && slot % 10 === 8
      if (deletes && Number(source.pX) !== -1 && Number(target.pX) !== -1) seen.framesKept += 1
      if (deletes && Number(source.pX) !== -1 && Number(target.pX) === -1) seen.framesDeleted += 1
      if (target.told === "undone" || target.told === "redone") seen.putBack += 1
      if (Number(target.gone) === 5 && Number(target.presses) > 0) seen.theirX += 1
      if (!paths.has(edge.to)) {
        paths.set(edge.to, route)
        queued.push(edge.to)
      }
    }
  }
  for (const [state, spec] of graph.states)
    if (!paths.has(state)) failures.push(`undo-frames ${said(spec)} was not reached`)
  return seen
}

describe("undo frames replay", () => {
  it("drives every edge of framing a layer, another tab's drag and delete, undo and redo through the real device deck", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "undo-frames")
    if (spec === undefined) throw new Error("no undo-frames spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = await replayed(graph, failures)
    expect(failures.slice(0, 5), `${failures.length} edges disagree; ${JSON.stringify(seen)}`).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen).toMatchObject({ starts: 1 })
    expect(seen.framesKept).toBeGreaterThan(0)
    expect(seen.framesDeleted).toBeGreaterThan(0)
    expect(seen.putBack).toBeGreaterThan(0)
    expect(seen.theirX).toBeGreaterThan(0)
  }, 120_000)
})
