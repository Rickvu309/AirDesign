import { orderKeyBetween, scene } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { createSceneDeck, openSceneDeck } from "./scene-deck.js"
import { memorySceneRemote } from "./scene-remote.js"
import { memoryStorage } from "./scene-storage.js"

const id = scene.nodeId
const deckNode = id("s:1")
const row = id("s:2")
const slide = id("s:3")
const title = id("s:4")
const at = (parent: scene.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const box = (x: number) => ({ x, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })

const start: scene.Edit = {
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

function counter(prefix: string) {
  let next = 0
  return () => `${prefix}-${(next += 1)}`
}

async function join(remote: ReturnType<typeof memorySceneRemote>, client: string, how: "create" | "open") {
  const opened = await (how === "create" ? createSceneDeck : openSceneDeck)(remote, "chain", {
    once: counter(client),
    client,
    storage: memoryStorage(),
    pause: () => Promise.resolve(),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

const xOf = (view: scene.Scene) => (view.nodes.get(title) as { box?: { x: number } }).box?.x

describe("undo and redo in a row on one property", () => {
  it("takes back each step in turn, however many times the property was written", async () => {
    const mine = await join(memorySceneRemote(start), "a", "create")
    mine.push([{ node: title, prop: "box", value: box(10) }])
    mine.push([{ node: title, prop: "box", value: box(20) }])
    mine.push([{ node: title, prop: "box", value: box(30) }])
    for (const expected of [20, 10, 0]) {
      expect(mine.undo().ok).toBe(true)
      expect(xOf(mine.view())).toBe(expected)
    }
    expect(mine.undo()).toEqual({ ok: false, reason: "nothing" })
    for (const expected of [10, 20, 30]) {
      expect(mine.redo().ok).toBe(true)
      expect(xOf(mine.view())).toBe(expected)
    }
    expect(await mine.sync()).toEqual({ ok: true })
    expect(xOf(mine.server())).toBe(30)
    expect(mine.notices()).toEqual([])
  })

  it("lands every undo and redo on the server in order", async () => {
    const mine = await join(memorySceneRemote(start), "a", "create")
    mine.push([{ node: title, prop: "box", value: box(10) }])
    expect(await mine.sync()).toEqual({ ok: true })
    mine.push([{ node: title, prop: "box", value: box(20) }])
    expect(await mine.sync()).toEqual({ ok: true })
    mine.undo()
    expect(await mine.sync()).toEqual({ ok: true })
    mine.undo()
    expect(await mine.sync()).toEqual({ ok: true })
    expect(xOf(mine.server())).toBe(0)
    mine.redo()
    mine.redo()
    expect(await mine.sync()).toEqual({ ok: true })
    expect(xOf(mine.server())).toBe(20)
    expect(mine.notices()).toEqual([])
  })

  it("still leaves alone a property another writer changed after my step", async () => {
    const shared = memorySceneRemote(start)
    const mine = await join(shared, "a", "create")
    const theirs = await join(shared, "b", "open")
    mine.push([{ node: title, prop: "box", value: box(10) }])
    mine.push([{ node: title, prop: "box", value: box(20) }])
    expect(await mine.sync()).toEqual({ ok: true })
    mine.undo()
    expect(await mine.sync()).toEqual({ ok: true })
    theirs.push([{ node: title, prop: "box", value: box(99) }])
    expect(await theirs.sync()).toEqual({ ok: true })
    await mine.catchUp()
    expect(mine.undo()).toEqual({ ok: false, reason: "nothing" })
    expect(xOf(mine.view())).toBe(99)
  })
})
