import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, title, card, outer, side] = [
  id("g:1"),
  id("g:2"),
  id("g:3"),
  id("g:4"),
  id("g:5"),
  id("g:6"),
  id("g:7"),
] as const
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const words = (chars: string): doom.Text => ({
  chars,
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
    { node: title, prop: "box", value: placed(0) },
    { node: title, prop: "text", value: words("Title") },
    { node: card, prop: "type", value: "shape" },
    { node: card, prop: "parent", value: at(slide) },
    { node: card, prop: "box", value: placed(0) },
    { node: outer, prop: "type", value: "frame" },
    { node: outer, prop: "parent", value: at(slide) },
    { node: side, prop: "type", value: "frame" },
    { node: side, prop: "parent", value: at(slide) },
  ],
}

async function tabs() {
  const remote = memoryDoomRemote(start)
  const join = async (client: string, how: "create" | "open") => {
    let next = 0
    const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "deleted", {
      once: () => `${client}-${(next += 1)}`,
      client,
      storage: memoryStorage(),
      pause: () => Promise.resolve(),
    })
    if (!opened.ok) throw new Error(JSON.stringify(opened))
    return opened.deck
  }
  const mine = await join("a", "create")
  const theirs = await join("b", "open")
  const fromTheirs = async (writes: readonly doom.Write[]) => {
    expect(await mine.sync()).toEqual({ ok: true })
    await theirs.catchUp()
    expect(theirs.push(writes).ok).toBe(true)
    expect(await theirs.sync()).toEqual({ ok: true })
    await mine.catchUp()
  }
  return { mine, theirs, fromTheirs }
}

const xOf = (view: doom.Doom, node: doom.NodeId) => (view.nodes.get(node) as { box: { x: number } }).box.x
const textOf = (view: doom.Doom) => (view.nodes.get(title) as { text: doom.Text }).text.chars
const parentOf = (view: doom.Doom, node: doom.NodeId) =>
  (view.nodes.get(node) as { parent?: { id: doom.NodeId } | null }).parent?.id ?? null

describe("an undo of a step on a layer another tab deleted", () => {
  it("does nothing, as in Figma, and the next undo takes back the step below", async () => {
    const { mine, fromTheirs } = await tabs()
    expect(mine.push([{ node: card, prop: "box", value: placed(10) }]).ok).toBe(true)
    expect(mine.push([{ node: title, prop: "text", value: words("Typed") }], { step: "typing" }).ok).toBe(true)
    await fromTheirs([{ node: title, prop: "parent", value: null }])
    expect(mine.undo()).toEqual({ ok: false, reason: "nothing" })
    expect(mine.undo().ok).toBe(true)
    expect(xOf(mine.view(), card)).toBe(0)
    expect(parentOf(mine.view(), title)).toBeNull()
    expect(await mine.sync()).toEqual({ ok: true })
    expect(xOf(mine.server(), card)).toBe(0)
  })

  it("takes back the rest of a step that also moved a layer still on the slide", async () => {
    const { mine, fromTheirs } = await tabs()
    expect(
      mine.push([
        { node: title, prop: "box", value: placed(5) },
        { node: card, prop: "box", value: placed(5) },
      ]).ok,
    ).toBe(true)
    await fromTheirs([{ node: title, prop: "parent", value: null }])
    expect(mine.undo().ok).toBe(true)
    expect(xOf(mine.view(), card)).toBe(0)
    expect(mine.redo().ok).toBe(true)
    expect(xOf(mine.view(), card)).toBe(5)
    expect(await mine.sync()).toEqual({ ok: true })
    expect(xOf(mine.server(), card)).toBe(5)
  })

  it("leaves a layer where it is when the frame it came from was deleted", async () => {
    const { mine, fromTheirs } = await tabs()
    expect(mine.push([{ node: card, prop: "box", value: placed(10) }]).ok).toBe(true)
    expect(mine.push([{ node: title, prop: "parent", value: at(outer) }]).ok).toBe(true)
    expect(mine.push([{ node: title, prop: "parent", value: at(side) }]).ok).toBe(true)
    await fromTheirs([{ node: outer, prop: "parent", value: null }])
    expect(mine.undo()).toEqual({ ok: false, reason: "nothing" })
    expect(parentOf(mine.view(), title)).toBe(side)
    expect(mine.undo()).toEqual({ ok: false, reason: "nothing" })
    expect(mine.undo().ok).toBe(true)
    expect(xOf(mine.view(), card)).toBe(0)
  })

  it("does nothing on a redo of it, and the next redo puts back the step above", async () => {
    const { mine, fromTheirs } = await tabs()
    expect(mine.push([{ node: title, prop: "text", value: words("Typed") }], { step: "typing" }).ok).toBe(true)
    expect(mine.push([{ node: card, prop: "box", value: placed(10) }]).ok).toBe(true)
    expect(mine.undo().ok).toBe(true)
    expect(mine.undo().ok).toBe(true)
    await fromTheirs([{ node: title, prop: "parent", value: null }])
    expect(mine.redo()).toEqual({ ok: false, reason: "nothing" })
    expect(mine.redo().ok).toBe(true)
    expect(xOf(mine.view(), card)).toBe(10)
  })

  it("redoes a step that typed in a text box and deleted it once emptied, and every step above it", async () => {
    const { mine } = await tabs()
    expect(mine.push([{ node: card, prop: "box", value: placed(1) }]).ok).toBe(true)
    expect(mine.push([{ node: title, prop: "text", value: words("Draft") }], { step: "text:1" }).ok).toBe(true)
    expect(mine.push([{ node: title, prop: "parent", value: null }], { step: "text:1" }).ok).toBe(true)
    expect(mine.push([{ node: card, prop: "box", value: placed(2) }]).ok).toBe(true)
    expect([mine.undo().ok, mine.undo().ok, mine.undo().ok]).toEqual([true, true, true])
    expect([parentOf(mine.view(), title), textOf(mine.view()), xOf(mine.view(), card)]).toEqual([slide, "Title", 0])
    expect([mine.redo().ok, mine.redo().ok, mine.redo().ok]).toEqual([true, true, true])
    expect([parentOf(mine.view(), title), textOf(mine.view()), xOf(mine.view(), card)]).toEqual([null, "Draft", 2])
    expect(mine.redo()).toEqual({ ok: false, reason: "nothing" })
    expect(await mine.sync()).toEqual({ ok: true })
    expect([parentOf(mine.server(), title), xOf(mine.server(), card)]).toEqual([null, 2])
  })

  it("still puts back a layer the person deleted along with what the step changed on it", async () => {
    const { mine } = await tabs()
    expect(
      mine.push([
        { node: title, prop: "text", value: words("Gone") },
        { node: title, prop: "parent", value: null },
      ]).ok,
    ).toBe(true)
    expect(mine.undo().ok).toBe(true)
    expect(parentOf(mine.view(), title)).toBe(slide)
    expect(textOf(mine.view())).toBe("Title")
  })
})
