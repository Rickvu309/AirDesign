import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck, type DoomRemote } from "@airdesign/live"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/undo-offline/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"
import { starts } from "@airdesign/doom/testing"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Seen = {
  readonly vT: number
  readonly vC: number
  readonly vwT: number
  readonly vwC: number
  readonly vN: number
  readonly vwN: number
  readonly xT: number
  readonly xC: number
  readonly xN: number
  readonly xP: number
  readonly wT: number
  readonly wC: number
  readonly wN: number
  readonly online: boolean
  readonly queued: number
  readonly told: string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const id = doom.nodeId
const [deckNode, row, slide, title, card] = [id("o:1"), id("o:2"), id("o:3"), id("o:4"), id("o:5")] as const
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

const start: doom.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    { node: title, prop: "type", value: "shape" },
    { node: title, prop: "parent", value: at(slide) },
    { node: title, prop: "text", value: words(0) },
    { node: title, prop: "role", value: "title" },
    { node: deckNode, prop: "name", value: starts.deckName },
    { node: deckNode, prop: "nameFollows", value: true },
    { node: card, prop: "type", value: "shape" },
    { node: card, prop: "parent", value: at(slide) },
    { node: card, prop: "box", value: placed(0) },
  ],
}

const textOf = (now: doom.Doom) => Number((now.nodes.get(title) as { text: doom.Text }).text.chars)
const boxOf = (now: doom.Doom) => (now.nodes.get(card) as { box: { x: number } }).box.x
const nameOf = (now: doom.Doom) => {
  const name = (now.nodes.get(deckNode) as { name?: string | null }).name
  return name === undefined || name === null || name === starts.deckName ? 0 : Number(name)
}
const standing = (now: doom.Doom) => (now.nodes.get(title) as { parent: unknown }).parent !== null

const theirEdits: Readonly<Record<string, readonly doom.Write[]>> = {
  OtherDelete: [{ node: title, prop: "parent", value: null }],
  OtherRename: [{ node: deckNode, prop: "name", value: "3" }],
  OtherRetype: [{ node: title, prop: "text", value: words(3) }],
}

const answers = {
  Undo: { ok: "undone", nothing: "nothing to undo", refused: "undo refused" },
  Redo: { ok: "redone", nothing: "nothing to redo", refused: "redo refused" },
} as const

async function played(route: readonly { readonly action: string; readonly from: Spec; readonly to: Spec }[]) {
  const remote = memoryDoomRemote(start)
  const cut = { off: false }
  const reachable =
    <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      if (cut.off) throw new TypeError("offline")
      return call(...args)
    }
  const join = async (client: string, how: "create" | "open", through: DoomRemote) => {
    let next = 0
    const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(through, "offline", {
      once: () => `${client}-${(next += 1)}`,
      client,
      storage: memoryStorage(),
      pause: () => Promise.resolve(),
    })
    if (!opened.ok) throw new Error(JSON.stringify(opened))
    return opened.deck
  }
  const mine = await join("a", "create", { ...remote, edit: reachable(remote.edit), since: reachable(remote.since) })
  const theirs = await join("b", "open", remote)
  const edits = new Map<string, number>([["start", 0]])
  let made = 0
  const named = (deck: typeof mine, pushed: { readonly ok: boolean } & Partial<{ readonly once: string }>) => {
    if (pushed.once === undefined) throw new Error(`nothing was sent: ${JSON.stringify(pushed)}`)
    made += 1
    edits.set(pushed.once, made)
    for (const { once } of deck.pending()) if (!edits.has(once)) edits.set(once, made)
  }
  const first = route[0]?.from
  if (first === undefined) throw new Error("an empty route")
  const typesOnly = Math.floor(Number(first.s2) / 1000) % 10 === 5
  named(mine, mine.push([{ node: card, prop: "box", value: placed(1) }]))
  named(
    mine,
    mine.push([
      { node: title, prop: "text", value: words(2) },
      ...(typesOnly ? [] : [{ node: card, prop: "box" as const, value: placed(2) }]),
    ]),
  )
  expect(await mine.sync()).toEqual({ ok: true })
  let told = "none"
  for (const { action } of route) {
    if (action === "GoOffline") {
      cut.off = true
      told = "none"
    } else if (action in theirEdits) {
      await theirs.catchUp()
      named(theirs, theirs.push(theirEdits[action] as readonly doom.Write[]))
      expect(await theirs.sync()).toEqual({ ok: true })
      if (!cut.off) await mine.catchUp()
      told = "none"
    } else if (action === "Undo" || action === "Redo") {
      const turned = action === "Undo" ? mine.undo() : mine.redo()
      if (turned.ok) named(mine, turned)
      told = answers[action][turned.ok ? "ok" : turned.reason]
      if (!cut.off) expect(await mine.sync()).toEqual({ ok: true })
    } else if (action === "Reconnect") {
      cut.off = false
      expect(await mine.sync()).toEqual({ ok: true })
      await mine.catchUp()
      told = mine.notices().length > 0 ? "set aside" : "none"
    } else throw new Error(`no step for ${action}`)
  }
  await theirs.catchUp()
  const shown = mine.view()
  const held = theirs.server()
  const writerOf = (now: doom.Doom, node: doom.NodeId, prop: "text" | "box" | "name") => {
    const writer = now.revs.get(node)?.get(prop)
    const once = [...now.onces].find(([, rev]) => rev === writer)?.[0]
    return once === undefined ? -1 : (edits.get(once) ?? -1)
  }
  const seen: Seen = {
    vT: textOf(shown),
    vC: boxOf(shown),
    vwT: writerOf(shown, title, "text"),
    vwC: writerOf(shown, card, "box"),
    vN: nameOf(shown),
    vwN: writerOf(shown, deckNode, "name"),
    xT: textOf(held),
    xC: boxOf(held),
    xN: nameOf(held),
    xP: standing(held) ? 1 : 0,
    wT: writerOf(held, title, "text"),
    wC: writerOf(held, card, "box"),
    wN: writerOf(held, deckNode, "name"),
    online: !cut.off,
    queued: mine.pending().length,
    told,
  }
  return seen
}

const queuedIn = (spec: Spec) => [spec.qa, spec.qb].filter((each) => each !== 0).length

function differences(expected: Spec, found: Seen): string[] {
  return (Object.keys(found) as (keyof Seen)[])
    .filter((key) => (key === "queued" ? queuedIn(expected) : expected[key]) !== found[key])
    .map(
      (key) =>
        `${key} is ${String(found[key])}, the model says ${String(key === "queued" ? queuedIn(expected) : expected[key])}`,
    )
}

const said = (spec: Spec) => `${view.group(spec)}: ${view.state(spec)}`

async function replayed(graph: Graph, failures: string[]) {
  const firsts = [...graph.states].filter(([, state]) => state.n === 2 && !state.wentOff).map(([name]) => name)
  type Leg = { readonly action: string; readonly from: Spec; readonly to: Spec }
  const paths = new Map<string, readonly Leg[]>(firsts.map((name) => [name, []]))
  const queued = [...firsts]
  const seen = { starts: firsts.length, edges: 0, landedPart: 0, quietlyGone: 0 }
  while (queued.length > 0) {
    const from = queued.shift() as string
    const source = graph.states.get(from) as Spec
    for (const edge of graph.edges.filter((each) => each.from === from)) {
      const target = graph.states.get(edge.to) as Spec
      const route = [...(paths.get(from) as readonly Leg[]), { action: edge.action, from: source, to: target }]
      seen.edges += 1
      const found = await played(route).then(
        (seen) => differences(target, seen),
        (error: unknown) => [error instanceof Error ? error.message : String(error)],
      )
      if (found.length > 0)
        failures.push(
          `undo-offline ${said(source)} -${edge.action}-> ${said(target)}\n  the code disagrees: ${found.join("; ")}`,
        )
      if (edge.action === "Reconnect" && source.others !== 0 && source.qa !== 0) {
        if (target.rs === source.rs && target.us === source.us) seen.landedPart += 1
        else seen.quietlyGone += 1
      }
      if (!paths.has(edge.to)) {
        paths.set(edge.to, route)
        queued.push(edge.to)
      }
    }
  }
  for (const [state, spec] of graph.states)
    if (!paths.has(state)) failures.push(`undo-offline ${said(spec)} was not reached`)
  return seen
}

describe("undo offline replay", () => {
  it("drives every edge of undo and redo made offline, another tab's delete, rename or retype and the reconnect through the real device deck", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "undo-offline")
    if (spec === undefined) throw new Error("no undo-offline spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = await replayed(graph, failures)
    expect(failures.slice(0, 5), `${failures.length} edges disagree; ${JSON.stringify(seen)}`).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen).toMatchObject({ starts: 2 })
    expect(seen.landedPart).toBeGreaterThan(0)
    expect(seen.quietlyGone).toBeGreaterThan(0)
  }, 120_000)
})
