import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, title, outer, inner, side] = [
  id("s:1"),
  id("s:2"),
  id("s:3"),
  id("s:4"),
  id("s:5"),
  id("s:6"),
  id("s:7"),
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
    { node: title, prop: "text", value: words("Title") },
    { node: outer, prop: "type", value: "frame" },
    { node: outer, prop: "parent", value: at(slide) },
    { node: inner, prop: "type", value: "frame" },
    { node: inner, prop: "parent", value: at(outer) },
    { node: side, prop: "type", value: "frame" },
    { node: side, prop: "parent", value: at(slide) },
  ],
}

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

const textOf = (view: doom.Doom) => (view.nodes.get(title) as { text?: doom.Text }).text?.chars
const parentOf = (view: doom.Doom, node: doom.NodeId) =>
  (view.nodes.get(node) as { parent?: { id: doom.NodeId } | null }).parent?.id

describe("an undo the deck refuses", () => {
  it("keeps its step, so the undo works once the deck allows it", async () => {
    const shared = memoryDoomRemote(start)
    const mine = await join(shared, "a", "create")
    const theirs = await join(shared, "b", "open")
    expect(mine.push([{ node: inner, prop: "parent", value: at(side) }]).ok).toBe(true)
    expect(await mine.sync()).toEqual({ ok: true })
    await theirs.catchUp()
    expect(theirs.push([{ node: outer, prop: "parent", value: at(inner) }]).ok).toBe(true)
    expect(await theirs.sync()).toEqual({ ok: true })
    await mine.catchUp()
    expect(mine.undo()).toMatchObject({ ok: false, reason: "refused", refused: { refused: "cycle" } })
    expect(parentOf(mine.view(), inner)).toBe(side)
    expect(theirs.push([{ node: outer, prop: "parent", value: at(slide) }]).ok).toBe(true)
    expect(await theirs.sync()).toEqual({ ok: true })
    await mine.catchUp()
    expect(mine.undo().ok).toBe(true)
    expect(parentOf(mine.view(), inner)).toBe(outer)
    expect(await mine.sync()).toEqual({ ok: true })
    expect(parentOf(mine.server(), inner)).toBe(outer)
  })
})

describe("pushes that share a step", () => {
  it("undo as one step and redo to the last of them", async () => {
    const mine = await join(memoryDoomRemote(start), "a", "create")
    for (const chars of ["T", "Ty", "Typed"])
      expect(mine.push([{ node: title, prop: "text", value: words(chars) }], { step: "typing" }).ok).toBe(true)
    expect(mine.push([{ node: title, prop: "text", value: words("Again") }], { step: "next" }).ok).toBe(true)
    expect(mine.undo().ok).toBe(true)
    expect(textOf(mine.view())).toBe("Typed")
    expect(mine.undo().ok).toBe(true)
    expect(textOf(mine.view())).toBe("Title")
    expect(mine.undo()).toEqual({ ok: false, reason: "nothing" })
    expect(mine.redo().ok).toBe(true)
    expect(textOf(mine.view())).toBe("Typed")
    expect(await mine.sync()).toEqual({ ok: true })
    expect(textOf(mine.server())).toBe("Typed")
  })

  it("start a new step after an undo, even with the same key", async () => {
    const mine = await join(memoryDoomRemote(start), "a", "create")
    expect(mine.push([{ node: title, prop: "text", value: words("One") }], { step: "typing" }).ok).toBe(true)
    expect(mine.undo().ok).toBe(true)
    expect(mine.push([{ node: title, prop: "text", value: words("Two") }], { step: "typing" }).ok).toBe(true)
    expect(mine.push([{ node: title, prop: "text", value: words("Three") }], { step: "typing" }).ok).toBe(true)
    expect(mine.undo().ok).toBe(true)
    expect(textOf(mine.view())).toBe("Title")
    expect(mine.redo().ok).toBe(true)
    expect(textOf(mine.view())).toBe("Three")
  })
})
