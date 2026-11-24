import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck } from "@airdesign/live"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/undo-deleted-frames/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Seen = {
  readonly pK: number
  readonly cK: number
  readonly wK: number
  readonly wC: number
  readonly gone: number
  readonly told: string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const id = doom.nodeId
const [deckNode, row] = [id("h:1"), id("h:2")] as const
const layers = [id("h:3"), id("h:4"), id("h:5"), id("h:6"), id("h:7")] as const
const [slide, outer, inner, card, side] = layers
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const frame = (node: doom.NodeId, parent: doom.NodeId): readonly doom.Write[] => [
  { node, prop: "type", value: "frame" },
  { node, prop: "parent", value: at(parent) },
]
const colours = ["accent1", "accent2"] as const
const paint = (colour: number): doom.Write => ({
  node: card,
  prop: "fills",
  value: [{ kind: "solid", color: { var: colours[colour]! } }],
})

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
    paint(0),
    ...frame(side, slide),
  ],
}

async function join(remote: ReturnType<typeof memoryDoomRemote>, client: string, how: "create" | "open") {
  let next = 0
  const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "deleted-frames", {
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
const codeOf = (now: doom.Doom) => {
  const parent = parentOf(now, card)
  return parent == null ? -1 : layers.indexOf(parent.id as (typeof layers)[number])
}
const colourOf = (now: doom.Doom) =>
  (now.nodes.get(card) as { fills?: readonly { color?: { var?: string } }[] }).fills?.[0]?.color?.var === colours[1]
    ? 1
    : 0
const goneOf = (now: doom.Doom) => (parentOf(now, outer) === null ? 1 : parentOf(now, inner) === null ? 2 : 0)

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
      const writes: doom.Write[] =
        Number(to.pK) === -1
          ? [{ node: card, prop: "parent", value: null }]
          : [{ node: card, prop: "parent", value: at(side) }, ...(from.cK === to.cK ? [] : [paint(Number(to.cK))])]
      const pushed = mine.push(writes)
      if (!("once" in pushed)) throw new Error(`the step sent nothing: ${JSON.stringify(pushed)}`)
      named(pushed.once)
    } else if (action === "OtherDelete")
      await fromTheirs([{ node: Number(to.gone) === 1 ? outer : inner, prop: "parent", value: null }])
    else if (action === "OtherPaint") await fromTheirs([paint(Number(to.cK))])
    else if (action === "OtherUndo") {
      await theirs.catchUp()
      const turned = theirs.undo()
      if (!turned.ok) throw new Error(`the other tab's undo answered ${JSON.stringify(turned)}`)
      named(turned.once)
      expect(await theirs.sync()).toEqual({ ok: true })
      await mine.catchUp()
    } else if (action === "Undo" || action === "Redo") {
      const turned = action === "Undo" ? mine.undo() : mine.redo()
      if (turned.ok) named(turned.once)
      told = answers[action][turned.ok ? "ok" : turned.reason]
    } else throw new Error(`no step for ${action}`)
    if (action !== "Undo" && action !== "Redo") told = "none"
    expect(await mine.sync()).toEqual({ ok: true })
  }
  const now = mine.view()
  const writerOf = (prop: "parent" | "fills") => {
    const writer = now.revs.get(card)?.get(prop)
    const once = [...now.onces].find(([, rev]) => rev === writer)?.[0]
    return once === undefined ? -1 : (edits.get(once) ?? -1)
  }
  const seen: Seen = {
    pK: codeOf(now),
    cK: colourOf(now),
    wK: writerOf("parent"),
    wC: writerOf("fills"),
    gone: goneOf(now),
    told,
  }
  const server = mine.server()
  const agreed = codeOf(server) === seen.pK && colourOf(server) === seen.cK && goneOf(server) === seen.gone
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
  const seen = { starts: firsts.length, edges: 0, backUnderDeleted: 0, colourWithoutMove: 0, broughtBack: 0 }
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
          `undo-deleted-frames ${said(source)} -${edge.action}-> ${said(target)}\n  the code disagrees: ${found.join("; ")}`,
        )
      const pressed = edge.action === "Undo" || edge.action === "Redo"
      if (pressed && Number(source.pK) === -1 && Number(target.pK) === 2 && Number(source.gone) === 1)
        seen.backUnderDeleted += 1
      if (pressed && source.pK === target.pK && source.cK !== target.cK) seen.colourWithoutMove += 1
      if (edge.action === "OtherUndo" && Number(source.pK) === 2) seen.broughtBack += 1
      if (!paths.has(edge.to)) {
        paths.set(edge.to, route)
        queued.push(edge.to)
      }
    }
  }
  for (const [state, spec] of graph.states)
    if (!paths.has(state)) failures.push(`undo-deleted-frames ${said(spec)} was not reached`)
  return seen
}

describe("undo deleted frames replay", () => {
  it("drives every edge of a card's steps, another tab's delete, paint and undo, and the person's undo and redo through the real device deck", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "undo-deleted-frames")
    if (spec === undefined) throw new Error("no undo-deleted-frames spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = await replayed(graph, failures)
    expect(failures.slice(0, 5), `${failures.length} edges disagree; ${JSON.stringify(seen)}`).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen).toMatchObject({ starts: 1 })
    expect(seen.backUnderDeleted).toBeGreaterThan(0)
    expect(seen.colourWithoutMove).toBeGreaterThan(0)
    expect(seen.broughtBack).toBeGreaterThan(0)
  }, 120_000)
})
