import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck } from "@airdesign/live"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/undo-strays/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Seen = {
  readonly p: number
  readonly x: number
  readonly wp: number
  readonly wx: number
  readonly told: string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const id = doom.nodeId
const [deckNode, row, slide, frame, card] = [id("m:1"), id("m:2"), id("m:3"), id("m:4"), id("m:5")] as const
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const parents = [slide, frame] as const
const boxAt = (x: number) => ({ x: x * 40, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })

const start: doom.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    { node: frame, prop: "type", value: "frame" },
    { node: frame, prop: "parent", value: at(slide) },
    { node: card, prop: "type", value: "shape" },
    { node: card, prop: "parent", value: at(frame) },
    { node: card, prop: "box", value: boxAt(0) },
  ],
}

async function join(remote: ReturnType<typeof memoryDoomRemote>, client: string, how: "create" | "open") {
  let next = 0
  const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "strays", {
    once: () => `${client}-${(next += 1)}`,
    client,
    storage: memoryStorage(),
    pause: () => Promise.resolve(),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

const parentOf = (now: doom.Doom) =>
  (now.nodes.get(card) as { parent?: { id: doom.NodeId } | null } | undefined)?.parent?.id
const xOf = (now: doom.Doom) => (now.nodes.get(card) as { box: { x: number } }).box.x / 40

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
  const fromMine = (writes: readonly doom.Write[]) => {
    const pushed = mine.push(writes)
    if (!("once" in pushed)) throw new Error(`the step sent nothing: ${JSON.stringify(pushed)}`)
    named(pushed.once)
  }
  const fromTheirs = async (writes: readonly doom.Write[]) => {
    expect(await mine.sync()).toEqual({ ok: true })
    await theirs.catchUp()
    const pushed = theirs.push(writes)
    if (!("once" in pushed)) throw new Error(`the other tab sent nothing: ${JSON.stringify(pushed)}`)
    named(pushed.once)
    expect(await theirs.sync()).toEqual({ ok: true })
    await mine.catchUp()
  }
  for (const { action, to } of route) {
    const [moveTo, placeAt] = [parents[Number(to.p)]!, boxAt(Number(to.x))]
    if (action === "Nudge") {
      fromMine([{ node: card, prop: "box", value: placeAt }])
      told = "none"
    } else if (action === "Drag") {
      fromMine([
        { node: card, prop: "parent", value: at(moveTo) },
        { node: card, prop: "box", value: placeAt },
      ])
      told = "none"
    } else if (action === "OtherMove") {
      await fromTheirs([{ node: card, prop: "parent", value: at(moveTo) }])
      told = "none"
    } else if (action === "OtherWrite") {
      await fromTheirs([{ node: card, prop: "box", value: placeAt }])
      told = "none"
    } else if (action === "Undo" || action === "Redo") {
      const turned = action === "Undo" ? mine.undo() : mine.redo()
      if (turned.ok) named(turned.once)
      told = answers[action][turned.ok ? "ok" : turned.reason]
    } else throw new Error(`no step for ${action}`)
    expect(await mine.sync()).toEqual({ ok: true })
  }
  const now = mine.view()
  const writerOf = (prop: "parent" | "box") => {
    const writer = now.revs.get(card)?.get(prop)
    const once = [...now.onces].find(([, rev]) => rev === writer)?.[0]
    return once === undefined ? -1 : (edits.get(once) ?? -1)
  }
  const seen: Seen = {
    p: parents.indexOf(parentOf(now) as (typeof parents)[number]),
    x: xOf(now),
    wp: writerOf("parent"),
    wx: writerOf("box"),
    told,
  }
  const server = mine.server()
  const agreed = parentOf(server) === parentOf(now) && xOf(server) === seen.x
  return { seen, agreed }
}

function differences(expected: Spec, found: Seen): string[] {
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
  const seen = { starts: firsts.length, edges: 0, keptStrayed: 0, putBack: 0 }
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
          `undo-strays ${route.map((leg) => leg.action).join(" ")} ${said(source)} -${edge.action}-> ${said(target)}\n  the code disagrees: ${found.join("; ")}`,
        )
      const pressed = edge.action === "Undo" || edge.action === "Redo"
      if (pressed && String(target.told).startsWith("nothing") && source.acted === true) seen.keptStrayed += 1
      if (pressed && (target.told === "undone" || target.told === "redone")) seen.putBack += 1
      if (!paths.has(edge.to)) {
        paths.set(edge.to, route)
        queued.push(edge.to)
      }
    }
  }
  for (const [state, spec] of graph.states)
    if (!paths.has(state)) failures.push(`undo-strays ${said(spec)} was not reached`)
  return seen
}

describe("undo strays replay", () => {
  it("drives every edge of the person's nudges and drags, another writer's move and write, undo and redo through the real device deck", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "undo-strays")
    if (spec === undefined) throw new Error("no undo-strays spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = await replayed(graph, failures)
    expect(failures.slice(0, 5), `${failures.length} edges disagree; ${JSON.stringify(seen)}`).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen).toMatchObject({ starts: 1 })
    expect(seen.keptStrayed).toBeGreaterThan(0)
    expect(seen.putBack).toBeGreaterThan(0)
  }, 120_000)
})
