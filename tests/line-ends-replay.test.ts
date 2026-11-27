import path from "node:path"
import { fileURLToPath } from "node:url"
import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck, type DoomDeck } from "@airdesign/live"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/line-ends/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"
import { testTheme } from "@airdesign/doom/testing"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Seen = {
  readonly xOn: boolean
  readonly xBox: number
  readonly s: number
  readonly e: number
  readonly vOn: boolean
  readonly vS: number
  readonly vE: number
  readonly queued: number
  readonly told: string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const id = doom.nodeId
const [deckNode, row, slide, shape, line] = [id("e:1"), id("e:2"), id("e:3"), id("e:4"), id("e:5")] as const
const estimate = doom.measureWith({})
const first = doom.orderKeyBetween(null, null)
const at = (parent: doom.NodeId, key = first) => ({ id: parent, at: key })
const placed = (box: number) => ({
  x: box === 0 ? 300 : 550,
  y: 200,
  w: 100,
  h: 50,
  rotation: 0,
  flipH: false,
  flipV: false,
})
const onShape: doom.End = { node: shape, site: "r" }
const spots = [
  { x: 400, y: 225 },
  { x: 650, y: 225 },
  { x: 0, y: 0 },
]
const ends = [
  { x: 40, y: 300 },
  { x: 60, y: 300 },
]
const lineOf = (start: doom.End, end: doom.End) => ({
  kind: "line" as const,
  start,
  end,
  route: "straight" as const,
  arrows: ["none", "none"] as const,
})

const makeShape: readonly doom.Write[] = [
  { node: shape, prop: "type", value: "shape" },
  { node: shape, prop: "parent", value: at(slide) },
  { node: shape, prop: "box", value: placed(0) },
]

const seed = (free: boolean, withoutShape: boolean): doom.Edit => ({
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: deckNode, prop: "theme", value: testTheme },
    { node: deckNode, prop: "size", value: { w: 1920, h: 1080 } },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    ...(withoutShape ? [] : makeShape),
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: at(slide, doom.orderKeyBetween(first, null)) },
    { node: line, prop: "geometry", value: lineOf(free ? spots[2]! : onShape, ends[0]!) },
  ],
})

const geometryOf = (fold: doom.Doom) => {
  const geometry = doom.propOf(fold.nodes.get(line), "geometry")
  if (geometry?.kind !== "line") throw new Error("no line")
  return geometry
}
const startIn = (fold: doom.Doom) => {
  const start = geometryOf(fold).start
  if ("node" in start) return start.node === shape ? -1 : Number.NaN
  return spots.findIndex((spot) => spot.x === start.x && spot.y === start.y)
}
const endIn = (fold: doom.Doom) => {
  const end = geometryOf(fold).end
  return "node" in end ? Number.NaN : ends.findIndex((spot) => spot.x === end.x && spot.y === end.y)
}
const shapeOn = (fold: doom.Doom) => doom.parentOf(fold.nodes.get(shape)) != null
const boxIn = (fold: doom.Doom) => ((doom.propOf(fold.nodes.get(shape), "box")?.x ?? 300) === 300 ? 0 : 1)

async function played(route: readonly { readonly action: string }[], from: Spec) {
  const remote = memoryDoomRemote(seed(from.s === 2 || from.from === "attached", from.from === "attached"))
  const sending = { once: null as string | null }
  const join = async (client: string, how: "create" | "open", gated: boolean) => {
    let next = 0
    const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(
      gated
        ? {
            ...remote,
            edit: async (asked) => {
              if (asked.edit.once !== sending.once) throw new TypeError("offline")
              return remote.edit(asked)
            },
          }
        : remote,
      "ends",
      {
        once: () => `${client}-${(next += 1)}`,
        client,
        storage: memoryStorage(),
        pause: () => Promise.resolve(),
        measure: () => estimate,
      },
    )
    if (!opened.ok) throw new Error(JSON.stringify(opened))
    return opened.deck
  }
  const mine = await join("a", "create", true)
  const theirs = await join("b", "open", false)
  const send = async (deck: DoomDeck) => {
    await deck.sync()
    sending.once = deck.pending()[0]?.once ?? null
    await deck.sync()
    sending.once = null
  }
  const pushed = (result: { readonly ok: boolean }) => {
    if (!result.ok) throw new Error(`the press was refused: ${JSON.stringify(result)}`)
  }
  if (from.from === "undone") {
    pushed(mine.push([{ node: shape, prop: "parent", value: null }]))
    await send(mine)
    pushed(mine.undo())
    await send(mine)
  }
  if (from.from === "attached") {
    pushed(mine.push([...makeShape, { node: line, prop: "geometry", value: lineOf(onShape, ends[0]!) }]))
    await send(mine)
  }
  const theirWrite = async (writes: (now: doom.Doom) => readonly doom.Write[]) => {
    await theirs.catchUp()
    pushed(theirs.push(writes(theirs.view())))
    expect(await theirs.sync()).toEqual({ ok: true })
  }
  let told = "none"
  for (const { action } of route) {
    const before = mine.notices().length
    told = "none"
    if (action === "Delete") pushed(mine.push([{ node: shape, prop: "parent", value: null }]))
    else if (action === "Undo" || action === "UndoAttach") pushed(mine.undo())
    else if (action === "Redo") pushed(mine.redo())
    else if (action === "SendA" || action === "SendB") await send(mine)
    else if (action === "CatchUp") await mine.catchUp()
    else if (action === "BMove") await theirWrite(() => [{ node: shape, prop: "box", value: placed(1) }])
    else if (action === "BAttach")
      await theirWrite((now) => [{ node: line, prop: "geometry", value: { ...geometryOf(now), start: onShape } }])
    else if (action === "BEnd")
      await theirWrite((now) => [{ node: line, prop: "geometry", value: { ...geometryOf(now), end: ends[1]! } }])
    else throw new Error(`no step for ${action}`)
    if (mine.notices().length > before) told = "set aside"
  }
  await theirs.catchUp()
  const held = theirs.server()
  const shown = mine.view()
  const seen: Seen = {
    xOn: shapeOn(held),
    xBox: boxIn(held),
    s: startIn(held),
    e: endIn(held),
    vOn: shapeOn(shown),
    vS: startIn(shown),
    vE: endIn(shown),
    queued: mine.pending().length,
    told,
  }
  return seen
}

function expected(spec: Spec): Seen {
  const v = spec as {
    readonly [key in "xOn" | "seen" | "ga" | "gbw"]: boolean
  } & { readonly [key in "xBox" | "s" | "e" | "sa" | "ea" | "sb" | "eb"]: number } & {
    readonly [key in "other" | "qa" | "qb" | "ka" | "kb" | "told"]: string
  }
  const kS = v.other === "attach" && !v.seen ? 2 : v.s
  const kE = v.other === "end" && !v.seen ? 0 : v.e
  const a = v.qa === "queued"
  const b = v.qb === "queued"
  const kBox = v.other === "move" && !v.seen ? 0 : v.xBox
  const vOn = b ? v.kb === "undo" : a ? v.ka === "undo" : v.xOn
  const afterA = a && v.ga ? v.sa : a && kS === -1 && v.ka !== "undo" ? kBox : kS
  return {
    xOn: v.xOn,
    xBox: v.xBox,
    s: v.s,
    e: v.e,
    vOn,
    vS: b && v.gbw ? v.sb : afterA,
    vE: b && v.gbw ? v.eb : a && v.ga ? v.ea : kE,
    queued: Number(a) + Number(b),
    told: v.told,
  }
}

function differences(spec: Spec, found: Seen): string[] {
  const want = expected(spec)
  return (Object.keys(found) as (keyof Seen)[])
    .filter((key) => want[key] !== found[key])
    .map((key) => `${key} is ${String(found[key])}, the model says ${String(want[key])}`)
}

const said = (spec: Spec) => `${view.group(spec)}: ${view.state(spec)}`

async function replayed(graph: Graph, failures: string[]) {
  const firsts = [...graph.states]
    .filter(([, state]) => state.ka === "none" && state.other === "none")
    .map(([name]) => name)
  type Leg = { readonly action: string }
  const paths = new Map<string, readonly Leg[]>(firsts.map((name) => [name, []]))
  const origin = new Map<string, Spec>(firsts.map((name) => [name, graph.states.get(name) as Spec]))
  const queued = [...firsts]
  const seen = { starts: firsts.length, edges: 0, refused: 0 }
  while (queued.length > 0) {
    const from = queued.shift() as string
    const source = graph.states.get(from) as Spec
    for (const edge of graph.edges.filter((each) => each.from === from)) {
      const target = graph.states.get(edge.to) as Spec
      const route = [...(paths.get(from) as readonly Leg[]), { action: edge.action }]
      seen.edges += 1
      const found = await played(route, origin.get(from) as Spec).then(
        (result) => differences(target, result),
        (error: unknown) => [error instanceof Error ? error.message : String(error)],
      )
      if (found.length > 0)
        failures.push(
          `line-ends ${said(source)} -${edge.action}-> ${said(target)}\n  the code disagrees: ${found.join("; ")}`,
        )
      if (target.told === "set aside" && source.told !== "set aside") seen.refused += 1
      if (!paths.has(edge.to)) {
        paths.set(edge.to, route)
        origin.set(edge.to, origin.get(from) as Spec)
        queued.push(edge.to)
      }
    }
  }
  for (const [state, spec] of graph.states)
    if (!paths.has(state)) failures.push(`line-ends ${said(spec)} was not reached`)
  return seen
}

describe("line ends replay", () => {
  it("drives every edge of a late delete, undo and redo beside another tab's move, attach or end change through the real device deck, and never sets one aside", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "line-ends")
    if (spec === undefined) throw new Error("no line-ends spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = await replayed(graph, failures)
    expect(failures.slice(0, 5), `${failures.length} edges disagree; ${JSON.stringify(seen)}`).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen).toMatchObject({ starts: 4 })
    expect(seen.refused).toBe(0)
  }, 120_000)
})
