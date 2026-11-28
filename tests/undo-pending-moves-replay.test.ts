import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage, openDoomDeck, type DoomRemote } from "@airdesign/live"
import { describe, expect, it } from "vitest"
import { assertJar, jarPath, topics } from "../scripts/check-specs.mjs"
import * as view from "../specs/undo-pending-moves/view.mjs"
import { dumpTopics } from "./spec-dump.js"
import { parseDot, type Graph } from "./spec-graph.js"

type Spec = Graph["states"] extends Map<string, infer State> ? State : never
type Seen = {
  readonly pK: number
  readonly pP: number
  readonly wK: number
  readonly wP: number
  readonly pending: string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const id = doom.nodeId
const [deckNode, row, slide, frame, card] = [id("m:1"), id("m:2"), id("m:3"), id("m:4"), id("m:5")] as const
const at = (parent: doom.NodeId, key = orderKeyBetween(null, null)) => ({ id: parent, at: key })

const firstBox = { x: 20, y: 30, w: 120, h: 80, rotation: 0, flipH: false, flipV: false }
const movedBox = { ...firstBox, x: 55 }

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
    { node: card, prop: "box", value: firstBox },
  ],
}

async function join(remote: DoomRemote, client: string, how: "create" | "open") {
  let next = 0
  const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "pending-moves", {
    once: () => `${client}-${(next += 1)}`,
    client,
    storage: memoryStorage(),
    pause: () => Promise.resolve(),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

const parentOf = (now: doom.Doom, node: doom.NodeId) =>
  (now.nodes.get(node) as { parent?: { id: doom.NodeId; at: doom.OrderKey } | null } | undefined)?.parent

async function played(route: readonly { readonly action: string; readonly from: Spec; readonly to: Spec }[]) {
  const remote = memoryDoomRemote(start)
  const cut = { off: false }
  const reachable =
    <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      if (cut.off) throw new TypeError("offline")
      return call(...args)
    }
  const mine = await join({ ...remote, edit: reachable(remote.edit), since: reachable(remote.since) }, "a", "create")
  const theirs = await join(remote, "b", "open")
  const edits = new Map<string, number>([["start", 0]])
  let landed = 0
  let pendingOnce: string | undefined
  let queuedInverse = false
  const named = (once: string) => edits.set(once, (landed += 1))
  const settled = async () => {
    expect(await theirs.sync()).toEqual({ ok: true })
    if (!cut.off) {
      expect(await mine.sync()).toEqual({ ok: true })
      await mine.catchUp()
    }
  }
  for (const { action, from, to } of route) {
    if (action === "PersonMove") {
      cut.off = true
      const key = parentOf(mine.view(), card)!.at
      const pushed = mine.push([{ node: card, prop: "parent", value: at(frame, orderKeyBetween(key, null)) }])
      if (!("once" in pushed)) throw new Error(`the reorder sent nothing: ${JSON.stringify(pushed)}`)
      pendingOnce = pushed.once
    } else if (action === "QueueMoveInverse") {
      const key = parentOf(mine.view(), card)!.at
      const moved = mine.push([
        { node: card, prop: "parent", value: at(frame, orderKeyBetween(key, null)) },
        { node: card, prop: "box", value: movedBox },
      ])
      if (!("once" in moved)) throw new Error(`the move sent nothing: ${JSON.stringify(moved)}`)
      await settled()
      const movedRev = mine.server().onces.get(moved.once)
      expect(movedRev).toBeDefined()
      edits.set(moved.once, 0)
      cut.off = true
      const undone = mine.undo()
      if (!undone.ok) throw new Error(`the move inverse sent nothing: ${JSON.stringify(undone)}`)
      pendingOnce = undone.once
      queuedInverse = true
      const pending = mine.pending().find((edit) => edit.once === undone.once)
      expect(pending?.writes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ node: card, prop: "parent", base: movedRev }),
          expect.objectContaining({ node: card, prop: "box", value: firstBox }),
        ]),
      )
    } else if (action === "Replay") {
      if (pendingOnce === undefined) throw new Error("no pending edit")
      cut.off = false
      const deleteRev = theirs.server().revs.get(card)?.get("parent")
      if (queuedInverse) {
        expect(await mine.catchUp()).toEqual({ ok: true })
        expect(mine.pending().some((edit) => edit.once === pendingOnce)).toBe(true)
        const basedOn = mine
          .pending()
          .find((edit) => edit.once === pendingOnce)
          ?.writes.find((write) => write.node === card && write.prop === "parent")?.base
        expect(basedOn).toBeLessThan(deleteRev!)
        expect(parentOf(mine.view(), card), "projected K parent").toBeNull()
        expect(mine.view().revs.get(card)?.get("parent"), "projected K parent writer").toBe(deleteRev)
        expect(mine.view().nodes.get(card), "projected K box").toMatchObject({ box: movedBox })
      }
      expect(await mine.sync()).toEqual({ ok: true })
      await mine.catchUp()
      const landed = mine.server()
      if (landed.onces.has(pendingOnce)) named(pendingOnce)
      if (queuedInverse) {
        expect(landed.onces.has(pendingOnce), "the inverse edit row landed").toBe(true)
        expect(parentOf(landed, card), "landed K parent").toBeNull()
        expect(landed.revs.get(card)?.get("parent"), "landed K parent writer").toBe(deleteRev)
        expect(landed.nodes.get(card), "landed K box").toMatchObject({ box: movedBox })
      }
    } else if (action === "PersonDelete") {
      const pushed = mine.push([{ node: card, prop: "parent", value: null }])
      if (!("once" in pushed)) throw new Error(`the delete sent nothing: ${JSON.stringify(pushed)}`)
      named(pushed.once)
    } else if (action === "PersonUndo") {
      const turned = mine.undo()
      if (turned.ok) named(turned.once)
      else if (turned.reason === "refused") throw new Error(`the undo was refused: ${JSON.stringify(turned)}`)
    } else if (action === "OtherDelete") {
      await theirs.catchUp()
      const node = Number(to.pP) !== Number(from.pP) ? frame : card
      const pushed = theirs.push([{ node, prop: "parent", value: null }])
      if (!("once" in pushed)) throw new Error(`the other tab sent nothing: ${JSON.stringify(pushed)}`)
      named(pushed.once)
    } else if (action === "OtherUndo") {
      await theirs.catchUp()
      const turned = theirs.undo()
      if (turned.ok) named(turned.once)
      else if (turned.reason === "refused")
        throw new Error(`the other tab's undo was refused: ${JSON.stringify(turned)}`)
    } else throw new Error(`no step for ${action}`)
    await settled()
  }
  await theirs.catchUp()
  const now = theirs.server()
  const writerOf = (node: doom.NodeId) => {
    const writer = now.revs.get(node)?.get("parent")
    const once = [...now.onces].find(([, rev]) => rev === writer)?.[0]
    return once === undefined ? -1 : (edits.get(once) ?? -1)
  }
  const pending =
    pendingOnce === undefined
      ? "none"
      : mine.pending().some((edit) => edit.once === pendingOnce)
        ? queuedInverse
          ? "inverse"
          : "queued"
        : now.onces.has(pendingOnce)
          ? "landed"
          : mine.notices().some((notice) => notice.once === pendingOnce && notice.refused === "missing")
            ? "refused"
            : "lost"
  const seen: Seen = {
    pK: parentOf(now, card) === null ? -1 : 1,
    pP: parentOf(now, frame) === null ? -1 : 0,
    wK: writerOf(card),
    wP: writerOf(frame),
    pending,
  }
  const agreed = cut.off || [card, frame].every((node) => parentOf(mine.view(), node)?.id === parentOf(now, node)?.id)
  return { seen, agreed }
}

function differences(expected: Spec, found: Seen): string[] {
  return (Object.keys(found) as (keyof Seen)[])
    .filter((key) => expected[key] !== found[key])
    .map((key) => `${key} is ${String(found[key])}, the model says ${String(expected[key])}`)
}

const said = (spec: Spec) => `${view.group(spec)}: ${view.state(spec)}`

async function replayed(graph: Graph, failures: string[]) {
  const firsts = [...graph.states]
    .filter(([, state]) => state.n === 0 && state.pending === "none")
    .map(([name]) => name)
  type Leg = { readonly action: string; readonly from: Spec; readonly to: Spec }
  const paths = new Map<string, readonly Leg[]>(firsts.map((name) => [name, []]))
  const queued = [...firsts]
  const seen = {
    starts: firsts.length,
    edges: 0,
    refused: 0,
    restoredIntoDeleted: 0,
    olderIntoStanding: 0,
    olderIntoDeleted: 0,
  }
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
          ...(agreed ? [] : ["the person's tab does not hold what the server holds"]),
        ],
        (error: unknown) => [error instanceof Error ? error.message : String(error)],
      )
      if (found.length > 0)
        failures.push(
          `undo-pending-moves ${route.map((leg) => leg.action).join(" ")} ${said(source)} -${edge.action}-> ${said(target)}\n  the code disagrees: ${found.join("; ")}`,
        )
      if (edge.action === "Replay" && target.pending === "refused" && Number(source.pK) === -1) seen.refused += 1
      if (edge.action === "Replay" && source.pending === "inverse") {
        if (source.pP === 0) seen.olderIntoStanding += 1
        else seen.olderIntoDeleted += 1
      }
      if (edge.action === "PersonUndo" && Number(source.pP) === -1 && Number(target.pK) === 1)
        seen.restoredIntoDeleted += 1
      if (!paths.has(edge.to)) {
        paths.set(edge.to, route)
        queued.push(edge.to)
      }
    }
  }
  for (const [state, spec] of graph.states)
    if (!paths.has(state)) failures.push(`undo-pending-moves ${said(spec)} was not reached`)
  return seen
}

describe("undo pending moves replay", () => {
  it("drives queued reorders, move inverses and both tabs' undos through the real device deck", async () => {
    assertJar(jarPath())
    const spec = topics(root).find((topic: { name: string }) => topic.name === "undo-pending-moves")
    if (spec === undefined) throw new Error("no undo-pending-moves spec")
    const [dumped] = await dumpTopics([spec])
    if (dumped === undefined) throw new Error("no graph")
    const graph = parseDot(dumped.graph)
    const failures: string[] = []
    const seen = await replayed(graph, failures)
    expect(failures.slice(0, 5), `${failures.length} edges disagree; ${JSON.stringify(seen)}`).toEqual([])
    expect(seen.edges).toBe(graph.edges.length)
    expect(seen).toMatchObject({ starts: 1, olderIntoStanding: 1, olderIntoDeleted: 1 })
    expect(seen.refused).toBeGreaterThan(0)
    expect(seen.restoredIntoDeleted).toBeGreaterThan(0)
  }, 120_000)
})
