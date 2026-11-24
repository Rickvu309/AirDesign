import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck } from "@airdesign/live"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/undo-turns/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Seen = {
  readonly pK: number
  readonly rK: number
  readonly tH: number
  readonly gone: boolean
  readonly told: string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const id = doom.nodeId
const [deckNode, row, slide, oldFrame, newFrame, card] = [
  id("u:1"),
  id("u:2"),
  id("u:3"),
  id("u:4"),
  id("u:5"),
  id("u:6"),
] as const
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const unit = 15
const turnP = 2
const boxOf = (x: number, units: number) => ({
  x,
  y: 0,
  w: 100,
  h: 50,
  rotation: doom.wrapRotation(units * unit),
  flipH: false,
  flipV: false,
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
    { node: oldFrame, prop: "type", value: "frame" },
    { node: oldFrame, prop: "parent", value: at(slide) },
    { node: oldFrame, prop: "box", value: boxOf(0, turnP) },
    { node: newFrame, prop: "type", value: "frame" },
    { node: newFrame, prop: "parent", value: at(slide) },
    { node: newFrame, prop: "box", value: boxOf(400, 0) },
    { node: card, prop: "type", value: "shape" },
    { node: card, prop: "parent", value: at(oldFrame) },
    { node: card, prop: "box", value: boxOf(0, 0) },
  ],
}

async function join(remote: ReturnType<typeof memoryDoomRemote>, client: string, how: "create" | "open") {
  let next = 0
  const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "turns", {
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
const unitsOf = (now: doom.Doom, node: doom.NodeId) => {
  const units = Math.round((doom.propOf(now.nodes.get(node), "box")?.rotation ?? 0) / unit)
  return units > 12 ? units - 24 : units
}
const seenIn = (now: doom.Doom) => ({
  pK: parentOf(now, card)?.id === oldFrame ? 1 : parentOf(now, card)?.id === newFrame ? 4 : -1,
  rK: unitsOf(now, card),
  tH: unitsOf(now, newFrame),
  gone: parentOf(now, oldFrame) === null,
})

async function played(route: readonly { readonly action: string; readonly from: Spec; readonly to: Spec }[]) {
  const remote = memoryDoomRemote(start)
  const mine = await join(remote, "a", "create")
  const theirs = await join(remote, "b", "open")
  let told = "none"
  let run: string | undefined
  const fromTheirs = async (writes: readonly doom.Write[]) => {
    expect(await mine.sync()).toEqual({ ok: true })
    await theirs.catchUp()
    expect(theirs.push(writes).ok).toBe(true)
    expect(await theirs.sync()).toEqual({ ok: true })
    await mine.catchUp()
  }
  for (const { action, from, to } of route) {
    if (action === "Step") {
      const writes: doom.Write[] = [
        { node: card, prop: "parent", value: at(newFrame) },
        { node: card, prop: "box", value: boxOf(10, Number(to.rK)) },
        ...(Number(to.byH) === 1 ? [{ node: newFrame, prop: "box" as const, value: boxOf(400, Number(to.tH)) }] : []),
      ]
      if (to.run === true) {
        run = "run-1"
        const author = { kind: "agent" as const, id: "aira", run }
        expect(await mine.sync()).toEqual({ ok: true })
        expect(
          (await remote.edit({ deck: "turns", edit: { once: `${run}-1`, author, writes, phase: "start" } })).ok,
        ).toBe(true)
        await remote.edit({ deck: "turns", edit: { once: `${run}-stop`, author, phase: "stop", writes: [] } })
        await theirs.catchUp()
        await mine.catchUp()
      } else expect(mine.push(writes).ok).toBe(true)
    } else if (action === "OtherTurn")
      await fromTheirs([{ node: newFrame, prop: "box", value: boxOf(400, Number(to.tH)) }])
    else if (action === "OtherDelete") await fromTheirs([{ node: oldFrame, prop: "parent", value: null }])
    else if (action === "Undo") {
      if (from.run === true) {
        const turned = await mine.undoRun(run!)
        told = turned.ok ? "undone" : turned.reason === "left" ? "nothing to undo" : `undo refused: ${turned.reason}`
      } else {
        const turned = mine.undo()
        told = turned.ok ? "undone" : turned.reason === "nothing" ? "nothing to undo" : "undo refused"
      }
    } else throw new Error(`no step for ${action}`)
    expect(await mine.sync()).toEqual({ ok: true })
  }
  const seen: Seen = { ...seenIn(mine.view()), told }
  const server = seenIn(mine.server())
  const agreed = (Object.keys(server) as (keyof typeof server)[]).every((key) => server[key] === seen[key])
  return { seen, agreed }
}

function differences(expected: Spec, found: Seen): string[] {
  return (Object.keys(found) as (keyof Seen)[])
    .filter((key) => expected[key] !== found[key])
    .map((key) => `${key} is ${String(found[key])}, the model says ${String(expected[key])}`)
}

const said = (spec: Spec) => `${view.group(spec)}: ${view.state(spec)}`

async function replayed(graph: Graph, failures: string[]) {
  const firsts = [...graph.states].filter(([, state]) => state.made === false).map(([name]) => name)
  type Leg = { readonly action: string; readonly from: Spec; readonly to: Spec }
  const paths = new Map<string, readonly Leg[]>()
  const queued: string[] = []
  for (const name of firsts)
    if (graph.edges.every((edge) => edge.to !== name)) {
      paths.set(name, [])
      queued.push(name)
    }
  if (queued.length === 0) throw new Error("no initial state")
  const seen = { starts: queued.length, edges: 0, keptTheirs: 0, runKept: 0 }
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
          `undo-turns ${said(source)} -${edge.action}-> ${said(target)}\n  the code disagrees: ${found.join("; ")}`,
        )
      const left = edge.action === "Undo" && Number(target.pK) === 4
      if (left && Number(source.dH) === 1 && source.run === false) seen.keptTheirs += 1
      if (left && Number(source.dH) === 1 && source.run === true) seen.runKept += 1
      if (!paths.has(edge.to)) {
        paths.set(edge.to, route)
        queued.push(edge.to)
      }
    }
  }
  for (const [state, spec] of graph.states)
    if (!paths.has(state)) failures.push(`undo-turns ${said(spec)} was not reached`)
  return seen
}

describe("undo turns replay", () => {
  it("drives every edge of a card's move out of a turned frame, another tab's turn and delete, and the undo through the real device deck", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "undo-turns")
    if (spec === undefined) throw new Error("no undo-turns spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = await replayed(graph, failures)
    expect(failures.slice(0, 5), `${failures.length} edges disagree; ${JSON.stringify(seen)}`).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen).toMatchObject({ starts: 1 })
    expect(seen.keptTheirs).toBeGreaterThan(0)
    expect(seen.runKept).toBeGreaterThan(0)
  }, 120_000)
})
