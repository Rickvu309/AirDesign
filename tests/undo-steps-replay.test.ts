import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck } from "@airdesign/live"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/undo-steps/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Prop = "T" | "P" | "C"
type Seen = {
  readonly xT: number
  readonly xP: number
  readonly xC: number
  readonly wT: number
  readonly wP: number
  readonly wC: number
  readonly told: string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const id = doom.nodeId
const [deckNode, row, slide, title, card] = [id("r:1"), id("r:2"), id("r:3"), id("r:4"), id("r:5")] as const
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const words = (value: number): doom.Text => ({
  chars: String(value),
  spans: [],
  paras: [{}],
  style: "body",
  resize: "height",
  alignV: "top",
})
const placed = (x: number) => ({ x, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })

const titleWrites: readonly doom.Write[] = [
  { node: title, prop: "type", value: "shape" },
  { node: title, prop: "parent", value: at(slide) },
  { node: title, prop: "text", value: words(0) },
]

const startWith = (titled: boolean): doom.Edit => ({
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    ...(titled ? titleWrites : []),
    { node: card, prop: "type", value: "shape" },
    { node: card, prop: "parent", value: at(slide) },
    { node: card, prop: "box", value: placed(0) },
  ],
})

const props: Readonly<Record<Prop, { readonly node: doom.NodeId; readonly prop: "text" | "parent" | "box" }>> = {
  T: { node: title, prop: "text" },
  P: { node: title, prop: "parent" },
  C: { node: card, prop: "box" },
}
const write = (prop: "T" | "C", value: number): doom.Write => ({
  node: props[prop].node,
  prop: props[prop].prop,
  value: prop === "T" ? words(value) : placed(value),
})

async function join(remote: ReturnType<typeof memoryDoomRemote>, client: string, how: "create" | "open") {
  let next = 0
  const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "steps", {
    once: () => `${client}-${(next += 1)}`,
    client,
    storage: memoryStorage(),
    pause: () => Promise.resolve(),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

const parentOf = (now: doom.Doom) => (now.nodes.get(title) as { parent?: unknown } | undefined)?.parent
const valueOf = (now: doom.Doom, prop: Prop) => {
  if (prop === "C") return (now.nodes.get(card) as { box: { x: number } }).box.x
  if (!now.nodes.has(title)) return prop === "T" ? 0 : 2
  return prop === "T"
    ? Number((now.nodes.get(title) as { text: doom.Text }).text.chars)
    : parentOf(now) === null
      ? 0
      : 1
}
const standing = (now: doom.Doom) => valueOf(now, "P") === 1

const changed = (from: Spec, to: Spec): readonly Prop[] =>
  (["T", "P", "C"] as const).filter(
    (prop) => from[`x${prop}`] !== to[`x${prop}`] || from[`w${prop}`] !== to[`w${prop}`],
  )

function stepWrites(from: Spec, to: Spec, now: doom.Doom): readonly doom.Write[] {
  const value = Number(from.made) + 1
  const moved = changed(from, to)
  const values = (["T", "C"] as const).filter(
    (prop) => moved.includes(prop) || (valueOf(now, prop) === value && (prop === "C" || standing(now))),
  )
  const parent = moved.includes("P") ? to.xP : undefined
  return [
    ...(parent === 1 ? titleWrites.slice(0, 2) : []),
    ...values.map((prop) => write(prop, value)),
    ...(parent === 0 ? [{ node: title, prop: "parent" as const, value: null }] : []),
  ]
}

const answers = {
  Undo: { ok: "undone", nothing: "nothing to undo", refused: "undo refused" },
  Redo: { ok: "redone", nothing: "nothing to redo", refused: "redo refused" },
} as const

async function played(route: readonly { readonly action: string; readonly from: Spec; readonly to: Spec }[]) {
  const remote = memoryDoomRemote(startWith(route[0]?.from.xP !== 2))
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
      const pushed = mine.push(stepWrites(from, to, mine.view()))
      if (!("once" in pushed)) throw new Error(`the step sent nothing: ${JSON.stringify(pushed)}`)
      named(pushed.once)
      told = "none"
    } else if (action === "OtherWrite") {
      const [prop] = changed(from, to)
      if (prop === undefined || prop === "P") throw new Error("the other tab's write changes no value in the model")
      await fromTheirs([write(prop, Number(to[`x${prop}`]))])
      told = "none"
    } else if (action === "OtherDelete") {
      await fromTheirs([{ node: title, prop: "parent", value: null }])
      told = "none"
    } else if (action === "Undo" || action === "Redo") {
      const turned = action === "Undo" ? mine.undo() : mine.redo()
      if (turned.ok) named(turned.once)
      told = answers[action][turned.ok ? "ok" : turned.reason]
    } else throw new Error(`no step for ${action}`)
    expect(await mine.sync()).toEqual({ ok: true })
  }
  const now = mine.view()
  const writerOf = (prop: Prop) => {
    if (prop !== "C" && !now.nodes.has(title)) return 0
    const writer = now.revs.get(props[prop].node)?.get(props[prop].prop)
    const once = [...now.onces].find(([, rev]) => rev === writer)?.[0]
    return once === undefined ? -1 : (edits.get(once) ?? -1)
  }
  const server = mine.server()
  const seen: Seen = {
    xT: valueOf(now, "T"),
    xP: valueOf(now, "P"),
    xC: valueOf(now, "C"),
    wT: writerOf("T"),
    wP: writerOf("P"),
    wC: writerOf("C"),
    told,
  }
  const agreed = (["T", "P", "C"] as const).every((prop) => valueOf(server, prop) === seen[`x${prop}`])
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
  const seen = { starts: firsts.length, edges: 0, passedDeleted: 0, deletedAgain: 0, unmade: 0 }
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
          `undo-steps ${said(source)} -${edge.action}-> ${said(target)}\n  the code disagrees: ${found.join("; ")}`,
        )
      if (target.xP === 0 && edge.action === "Undo" && target.told === "nothing to undo") seen.passedDeleted += 1
      if (source.xP === 1 && target.xP === 0 && edge.action === "Redo") seen.deletedAgain += 1
      if (source.xP === 1 && target.xP === 0 && edge.action === "Undo" && Number(target.s1) % 10000 >= 7000)
        seen.unmade += 1
      if (!paths.has(edge.to)) {
        paths.set(edge.to, route)
        queued.push(edge.to)
      }
    }
  }
  for (const [state, spec] of graph.states)
    if (!paths.has(state)) failures.push(`undo-steps ${said(spec)} was not reached`)
  return seen
}

describe("undo steps replay", () => {
  it("drives every edge of the person's steps, another tab's write and delete, undo and redo through the real device deck", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "undo-steps")
    if (spec === undefined) throw new Error("no undo-steps spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = await replayed(graph, failures)
    expect(failures.slice(0, 5), `${failures.length} edges disagree; ${JSON.stringify(seen)}`).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen).toMatchObject({ starts: 2 })
    expect(seen.passedDeleted).toBeGreaterThan(0)
    expect(seen.deletedAgain).toBeGreaterThan(0)
    expect(seen.unmade).toBeGreaterThan(0)
  }, 120_000)
})
