import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, title] = [id("u:1"), id("u:2"), id("u:3"), id("u:4")] as const
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const box = (x: number) => ({ x, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })
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
    { node: title, prop: "box", value: box(0) },
    { node: title, prop: "name", value: "Title" },
    { node: title, prop: "text", value: words("Title") },
  ],
}

function counted(remote: DoomRemote) {
  const sent: doom.Edit[] = []
  const spy: DoomRemote = { ...remote, edit: (body) => (sent.push(body.edit), remote.edit(body)) }
  return { spy, sent }
}

async function join(remote: DoomRemote, client: string, how: "create" | "open") {
  let next = 0
  const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "unchanged", {
    once: () => `${client}-${(next += 1)}`,
    client,
    storage: memoryStorage(),
    pause: () => Promise.resolve(),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

const xOf = (view: doom.Doom) => (view.nodes.get(title) as { box: { x: number } }).box.x
const nameOf = (view: doom.Doom) => (view.nodes.get(title) as { name?: string }).name
const textOf = (view: doom.Doom) => (view.nodes.get(title) as { text: doom.Text }).text.chars

describe("an edit that changes nothing", () => {
  it("makes no undo step and sends nothing, so one undo takes back the change before it", async () => {
    const { spy, sent } = counted(memoryDoomRemote(start))
    const mine = await join(spy, "a", "create")
    expect(mine.push([{ node: title, prop: "box", value: box(10) }]).ok).toBe(true)
    expect(mine.push([{ node: title, prop: "box", value: { ...box(10) } }])).toEqual({ ok: true, unchanged: true })
    expect(mine.push([{ node: title, prop: "name", value: "Title" }])).toEqual({ ok: true, unchanged: true })
    expect(mine.pending()).toHaveLength(1)
    expect(mine.undo().ok).toBe(true)
    expect(xOf(mine.view())).toBe(0)
    expect(await mine.sync()).toEqual({ ok: true })
    expect(sent.map((edit) => edit.writes.map((write) => write.prop))).toEqual([["box"], ["box"]])
  })

  it("sends only the writes that change something, and undo restores only those", async () => {
    const mine = await join(memoryDoomRemote(start), "a", "create")
    mine.push([
      { node: title, prop: "name", value: "Title" },
      { node: title, prop: "box", value: box(10) },
    ])
    expect(mine.pending()[0]!.writes).toEqual([{ node: title, prop: "box", value: box(10) }])
    expect(mine.undo().ok).toBe(true)
    expect(xOf(mine.view())).toBe(0)
  })

  it("sends nothing for one edit that sets a value and sets it back, so undo takes back the step before it", async () => {
    const mine = await join(memoryDoomRemote(start), "a", "create")
    mine.push([{ node: title, prop: "box", value: box(10) }])
    const there = { node: title, prop: "box", value: box(20) } as const
    const back = { node: title, prop: "box", value: box(10) } as const
    expect(mine.push([there, back])).toEqual({ ok: true, unchanged: true })
    expect(mine.pending()).toHaveLength(1)
    expect(mine.undo().ok).toBe(true)
    expect(xOf(mine.view())).toBe(0)
  })

  it("never undoes another writer's change it has not seen yet", async () => {
    const shared = memoryDoomRemote(start)
    const mine = await join(shared, "a", "create")
    const theirs = await join(shared, "b", "open")
    theirs.push([{ node: title, prop: "name", value: "Theirs" }])
    expect(await theirs.sync()).toEqual({ ok: true })
    expect(mine.push([{ node: title, prop: "name", value: "Title" }])).toEqual({ ok: true, unchanged: true })
    expect(await mine.sync()).toEqual({ ok: true })
    await mine.catchUp()
    expect(nameOf(mine.view())).toBe("Theirs")
    expect(nameOf(mine.server())).toBe("Theirs")
  })

  it("takes back the step below a step that only partly came back, as its own edits still hold that property", async () => {
    const mine = await join(memoryDoomRemote(start), "a", "create")
    mine.push([{ node: title, prop: "box", value: box(10) }])
    mine.push(
      [
        { node: title, prop: "box", value: box(20) },
        { node: title, prop: "text", value: words("Hello") },
      ],
      { step: "edit" },
    )
    expect(await mine.sync()).toEqual({ ok: true })
    mine.push([{ node: title, prop: "box", value: box(10) }], { step: "edit" })
    expect(mine.undo().ok).toBe(true)
    expect(textOf(mine.view())).toBe("Title")
    expect(mine.undo().ok).toBe(true)
    expect(xOf(mine.view())).toBe(0)
  })

  it("still takes back what a step's landed edits left when a later edit of the step is refused", async () => {
    const shared = memoryDoomRemote(start)
    const mine = await join(shared, "a", "create")
    const theirs = await join(shared, "b", "open")
    mine.push(
      [
        { node: title, prop: "text", value: words("Hello") },
        { node: title, prop: "box", value: box(10) },
      ],
      { step: "text:1" },
    )
    expect(await mine.sync()).toEqual({ ok: true })
    await theirs.catchUp()
    theirs.push([{ node: title, prop: "text", value: words("Theirs") }])
    expect(await theirs.sync()).toEqual({ ok: true })
    mine.push(
      [
        { node: title, prop: "text", value: words("Hello!") },
        { node: title, prop: "box", value: box(20) },
      ],
      { step: "text:1" },
    )
    await mine.sync()
    expect(mine.notices()).toMatchObject([{ refused: "stale" }])
    expect(xOf(mine.view())).toBe(10)
    expect(mine.undo().ok).toBe(true)
    expect(xOf(mine.view())).toBe(0)
    expect(textOf(mine.view())).toBe("Theirs")
  })
})
