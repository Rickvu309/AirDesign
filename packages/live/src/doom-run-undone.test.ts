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

async function join(remote: ReturnType<typeof memoryDoomRemote>, how: "create" | "open", tab = "tab") {
  let next = 0
  const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "run", {
    once: () => `${tab}-${(next += 1)}`,
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

describe("a run's undone mark on the device", () => {
  async function ranOnce(remote: ReturnType<typeof memoryDoomRemote>) {
    await land(remote, {
      once: "a1",
      author: agent("run-1"),
      phase: "start",
      writes: [{ node: title, prop: "box", value: box(10) }],
    })
    await land(remote, { once: "a2", author: agent("run-1"), phase: "stop", writes: [] })
  }

  it("is written by Undo, so a tab opened after it, and the server, read the run as undone", async () => {
    const remote = memoryDoomRemote(start)
    const mine = await join(remote, "create")
    await ranOnce(remote)
    await mine.catchUp()
    expect(mine.view().runs.get("run-1")?.undone).toBe(false)
    expect((await mine.undoRun("run-1")).ok).toBe(true)
    expect(mine.view().runs.get("run-1")?.undone).toBe(true)
    await mine.sync()
    const reopened = await join(remote, "open", "later")
    expect(reopened.view().runs.get("run-1")?.undone).toBe(true)
    expect(xOf(reopened.view())).toBe(0)
  })

  it("is cleared by redo and set again by undo, as the run's changes come and go", async () => {
    const remote = memoryDoomRemote(start)
    const mine = await join(remote, "create")
    await ranOnce(remote)
    await mine.catchUp()
    await mine.undoRun("run-1")
    expect(mine.redo().ok).toBe(true)
    expect(mine.view().runs.get("run-1")?.undone).toBe(false)
    expect(xOf(mine.view())).toBe(10)
    expect(mine.undo().ok).toBe(true)
    expect(mine.view().runs.get("run-1")?.undone).toBe(true)
    expect(xOf(mine.view())).toBe(0)
  })

  it("answers nothing for a run that is already undone, and lands nothing", async () => {
    const remote = memoryDoomRemote(start)
    const mine = await join(remote, "create")
    await ranOnce(remote)
    await mine.catchUp()
    await mine.undoRun("run-1")
    await mine.sync()
    const rev = mine.server().rev
    expect(await mine.undoRun("run-1")).toEqual({ ok: false, reason: "nothing" })
    await mine.sync()
    expect(mine.server().rev).toBe(rev)
  })
})
