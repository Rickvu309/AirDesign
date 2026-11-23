import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const deckNode = id("s:1")
const row = id("s:2")
const slide = id("s:3")
const title = id("s:4")
const made = id("agent:1")
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const box = (x: number) => ({ x, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })

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
    { node: title, prop: "box", value: box(0) },
  ],
}

const agent = (run: string): doom.Author => ({ kind: "agent", id: "aira", run })

async function join(remote: ReturnType<typeof memoryDoomRemote>, how: "create" | "open") {
  let next = 0
  const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "run", {
    once: () => `tab-${(next += 1)}`,
    client: "tab",
    storage: memoryStorage(),
    pause: () => Promise.resolve(),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

async function land(remote: ReturnType<typeof memoryDoomRemote>, edit: doom.Edit) {
  const answer = await remote.edit({ deck: "run", edit })
  expect(answer.ok).toBe(true)
}

const xOf = (view: doom.Doom) => (view.nodes.get(title) as { box?: { x: number } }).box?.x

describe("undoing an agent's run", () => {
  it("takes every edit of the run back in one step and paints it at once", async () => {
    const remote = memoryDoomRemote(start)
    const mine = await join(remote, "create")
    await land(remote, {
      once: "a1",
      author: agent("run-1"),
      phase: "start",
      writes: [{ node: title, prop: "box", value: box(10) }],
    })
    await land(remote, {
      once: "a2",
      author: agent("run-1"),
      writes: [
        { node: title, prop: "box", value: box(20) },
        { node: made, prop: "type", value: "shape" },
        { node: made, prop: "parent", value: at(slide) },
      ],
    })
    await land(remote, { once: "a3", author: agent("run-1"), phase: "stop", writes: [] })
    await mine.catchUp()
    expect(xOf(mine.view())).toBe(20)
    expect(mine.view().children.get(slide)).toContain(made)

    const turned = await mine.undoRun("run-1")

    expect(turned.ok).toBe(true)
    expect(xOf(mine.view())).toBe(0)
    expect(mine.view().children.get(slide) ?? []).not.toContain(made)
    if (!turned.ok) return
    await turned.saved
    expect((await mine.sync()).ok).toBe(true)
    const other = await join(remote, "open")
    expect(xOf(other.view())).toBe(0)
  })

  it("puts back a group the run took apart, with its layers inside it", async () => {
    const group = id("s:5")
    const remote = memoryDoomRemote({
      ...start,
      writes: [
        ...start.writes.filter((write) => write.node !== title || write.prop !== "parent"),
        { node: group, prop: "type", value: "frame" },
        { node: group, prop: "parent", value: at(slide) },
        { node: title, prop: "parent", value: at(group) },
      ],
    })
    const mine = await join(remote, "create")
    await land(remote, {
      once: "a1",
      author: agent("run-1"),
      phase: "start",
      writes: [
        { node: title, prop: "parent", value: { id: slide, at: orderKeyBetween(at(slide).at, null) } },
        { node: group, prop: "parent", value: null },
      ],
    })
    await land(remote, { once: "a2", author: agent("run-1"), phase: "stop", writes: [] })
    await mine.catchUp()
    expect(mine.view().children.get(slide)).toEqual([title])

    expect((await mine.undoRun("run-1")).ok).toBe(true)
    expect(mine.view().children.get(slide)).toEqual([group])
    expect(mine.view().children.get(group)).toEqual([title])
  })

  it("leaves what a person wrote after the run, and says so when nothing is left to undo", async () => {
    const remote = memoryDoomRemote(start)
    const mine = await join(remote, "create")
    await land(remote, {
      once: "a1",
      author: agent("run-1"),
      phase: "start",
      writes: [{ node: title, prop: "box", value: box(10) }],
    })
    await land(remote, { once: "a2", author: agent("run-1"), phase: "stop", writes: [] })
    await mine.catchUp()
    mine.push([{ node: title, prop: "box", value: box(77) }])
    await mine.sync()

    expect(await mine.undoRun("run-1")).toEqual({ ok: false, reason: "nothing" })
    expect(xOf(mine.view())).toBe(77)
  })

  it("finds a run the tab did not see land, after a reload", async () => {
    const remote = memoryDoomRemote(start)
    await join(remote, "create")
    await land(remote, {
      once: "a1",
      author: agent("run-9"),
      phase: "start",
      writes: [{ node: title, prop: "box", value: box(40) }],
    })
    await land(remote, { once: "a2", author: agent("run-9"), phase: "stop", writes: [] })
    const later = await join(remote, "open")
    await later.catchUp()

    expect((await later.undoRun("run-9")).ok).toBe(true)
    expect(xOf(later.view())).toBe(0)
  })

  it("undoes a run it watched land without reading the deck's log again", async () => {
    const base = memoryDoomRemote(start)
    const asked: number[] = []
    const remote = {
      ...base,
      since: async (...args: Parameters<typeof base.since>) => (asked.push(args[0].rev), base.since(...args)),
    }
    const mine = await join(remote, "create")
    for (let step = 1; step <= 30; step += 1)
      await land(remote, {
        once: `p${step}`,
        author: { kind: "person", id: "other" },
        writes: [{ node: title, prop: "box", value: box(step) }],
      })
    await land(remote, {
      once: "a1",
      author: agent("run-1"),
      phase: "start",
      writes: [{ node: title, prop: "box", value: box(500) }],
    })
    await land(remote, { once: "a2", author: agent("run-1"), writes: [{ node: title, prop: "box", value: box(600) }] })
    await mine.catchUp()
    asked.length = 0

    expect((await mine.undoRun("run-1")).ok).toBe(true)

    expect(xOf(mine.view())).toBe(30)
    expect(Math.min(...asked)).toBeGreaterThanOrEqual(mine.server().rev)
  })

  it("undoes a run it did not see land, after a reload, without reading the deck's log from the start", async () => {
    const base = memoryDoomRemote(start)
    const asked: number[] = []
    const remote = {
      ...base,
      since: async (...args: Parameters<typeof base.since>) => (asked.push(args[0].rev), base.since(...args)),
    }
    await join(remote, "create")
    for (let step = 1; step <= 30; step += 1)
      await land(remote, {
        once: `p${step}`,
        author: { kind: "person", id: "other" },
        writes: [{ node: title, prop: "box", value: box(step) }],
      })
    await land(remote, {
      once: "a1",
      author: agent("run-1"),
      phase: "start",
      writes: [{ node: title, prop: "box", value: box(500) }],
    })
    await land(remote, {
      once: "a2",
      author: agent("run-1"),
      writes: [
        { node: title, prop: "box", value: box(600) },
        { node: made, prop: "type", value: "shape" },
        { node: made, prop: "parent", value: at(slide) },
      ],
    })
    await land(remote, { once: "a3", author: agent("run-1"), writes: [{ node: made, prop: "name", value: "Made" }] })
    const later = await join(remote, "open")
    asked.length = 0

    expect((await later.undoRun("run-1")).ok).toBe(true)

    expect(xOf(later.view())).toBe(30)
    expect(later.view().children.get(slide) ?? []).not.toContain(made)
    expect(Math.min(...asked)).toBeGreaterThanOrEqual(later.server().rev)
  })

  it("redoes the run with the person's redo", async () => {
    const remote = memoryDoomRemote(start)
    const mine = await join(remote, "create")
    await land(remote, {
      once: "a1",
      author: agent("run-1"),
      phase: "start",
      writes: [{ node: title, prop: "box", value: box(10) }],
    })
    await mine.catchUp()
    expect((await mine.undoRun("run-1")).ok).toBe(true)
    expect(mine.redo().ok).toBe(true)
    expect(xOf(mine.view())).toBe(10)
  })

  it("names a run the log never held", async () => {
    const remote = memoryDoomRemote(start)
    const mine = await join(remote, "create")
    expect(await mine.undoRun("run-none")).toEqual({ ok: false, reason: "nothing" })
  })
})
