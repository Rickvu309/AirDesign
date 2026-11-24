import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, title, card, outer, side, group, inner] = [
  id("g:1"),
  id("g:2"),
  id("g:3"),
  id("g:4"),
  id("g:5"),
  id("g:6"),
  id("g:7"),
  id("g:8"),
  id("g:9"),
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
    { node: group, prop: "type", value: "frame" },
    { node: group, prop: "parent", value: at(outer) },
    { node: inner, prop: "type", value: "frame" },
    { node: inner, prop: "parent", value: at(group) },
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
  const theirUndo = async () => {
    expect(await mine.sync()).toEqual({ ok: true })
    await theirs.catchUp()
    expect(theirs.undo().ok).toBe(true)
    expect(await theirs.sync()).toEqual({ ok: true })
    await mine.catchUp()
  }
  return { remote, mine, theirs, fromTheirs, theirUndo }
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

  it("leaves a frame where it is when putting it back would put it inside itself, and the next undo goes on", async () => {
    const { mine, fromTheirs } = await tabs()
    expect(mine.push([{ node: card, prop: "box", value: placed(10) }]).ok).toBe(true)
    expect(mine.push([{ node: inner, prop: "parent", value: at(side) }]).ok).toBe(true)
    expect(mine.push([{ node: group, prop: "parent", value: at(inner) }]).ok).toBe(true)
    await fromTheirs([{ node: outer, prop: "parent", value: null }])
    expect(mine.undo()).toEqual({ ok: false, reason: "nothing" })
    expect(mine.undo()).toEqual({ ok: false, reason: "nothing" })
    expect([parentOf(mine.view(), inner), parentOf(mine.view(), group)]).toEqual([side, inner])
    expect(mine.undo().ok).toBe(true)
    expect(xOf(mine.view(), card)).toBe(0)
    expect(await mine.sync()).toEqual({ ok: true })
    expect(xOf(mine.server(), card)).toBe(0)
  })

  it("puts a layer framed under a frame another tab deleted back where it was, so their undo brings it back unframed", async () => {
    const { mine, theirs, fromTheirs, theirUndo } = await tabs()
    const wrap = id("a:90")
    expect(
      mine.push([
        { node: card, prop: "parent", value: at(inner) },
        { node: card, prop: "box", value: placed(20) },
      ]).ok,
    ).toBe(true)
    expect(
      mine.push([
        { node: wrap, prop: "type", value: "frame" },
        { node: wrap, prop: "parent", value: at(inner) },
        { node: wrap, prop: "box", value: placed(20) },
        { node: card, prop: "parent", value: at(wrap) },
        { node: card, prop: "box", value: placed(0) },
      ]).ok,
    ).toBe(true)
    await fromTheirs([{ node: outer, prop: "parent", value: null }])
    expect(mine.undo().ok).toBe(true)
    await theirUndo()
    for (const view of [mine.view(), theirs.view()])
      expect([parentOf(view, card), parentOf(view, wrap), parentOf(view, outer), xOf(view, card)]).toEqual([
        inner,
        null,
        slide,
        20,
      ])
  })

  it("puts back a layer the person deleted under a frame another tab deleted since, so their undo brings both back", async () => {
    for (const emptied of [false, true]) {
      const { mine, theirs, fromTheirs, theirUndo } = await tabs()
      expect(mine.push([{ node: title, prop: "parent", value: at(inner) }]).ok).toBe(true)
      expect(
        mine.push([
          ...(emptied ? [{ node: title, prop: "text" as const, value: words("") }] : []),
          { node: title, prop: "parent", value: null },
        ]).ok,
      ).toBe(true)
      await fromTheirs([{ node: outer, prop: "parent", value: null }])
      expect(mine.undo().ok).toBe(true)
      await theirUndo()
      for (const view of [mine.view(), theirs.view(), mine.server()])
        expect([parentOf(view, title), parentOf(view, inner), parentOf(view, outer), textOf(view)]).toEqual([
          inner,
          group,
          slide,
          "Title",
        ])
    }
  })

  it("puts back the colour and words an agent run gave a layer it leaves in the frame the run moved it to", async () => {
    const { remote, mine, fromTheirs } = await tabs()
    const red = [{ kind: "solid", color: { var: "accent2" } }]
    expect(mine.push([{ node: title, prop: "parent", value: at(side) }]).ok).toBe(true)
    expect(await mine.sync()).toEqual({ ok: true })
    const author = { kind: "agent" as const, id: "aira", run: "run-1" }
    const base = mine.view().revs.get(title)!.get("text")!
    for (const edit of [
      {
        once: "r1",
        author,
        phase: "start" as const,
        writes: [
          { node: title, prop: "parent" as const, value: at(inner) },
          { node: title, prop: "fills" as const, value: red },
          { node: title, prop: "text" as const, value: words("ai"), base },
        ],
      },
      { once: "r2", author, phase: "stop" as const, writes: [] },
    ])
      expect((await remote.edit({ deck: "deleted", edit })).ok).toBe(true)
    await mine.catchUp()
    await fromTheirs([{ node: side, prop: "parent", value: null }])
    const undone = await mine.undoRun("run-1")
    expect(undone).toMatchObject({ ok: true, left: [title] })
    expect(await mine.sync()).toEqual({ ok: true })
    for (const view of [mine.view(), mine.server()]) {
      expect([parentOf(view, title), textOf(view)]).toEqual([inner, "Title"])
      expect(view.nodes.get(title)).not.toHaveProperty("fills")
    }
  })

  it("names the layer an agent run only moved when the frame it came from is gone, and lands nothing", async () => {
    const { remote, mine, fromTheirs } = await tabs()
    expect(mine.push([{ node: title, prop: "parent", value: at(side) }]).ok).toBe(true)
    expect(await mine.sync()).toEqual({ ok: true })
    const author = { kind: "agent" as const, id: "aira", run: "run-1" }
    for (const edit of [
      {
        once: "r1",
        author,
        phase: "start" as const,
        writes: [{ node: title, prop: "parent" as const, value: at(inner) }],
      },
      { once: "r2", author, phase: "stop" as const, writes: [] },
    ])
      expect((await remote.edit({ deck: "deleted", edit })).ok).toBe(true)
    await mine.catchUp()
    await fromTheirs([{ node: side, prop: "parent", value: null }])
    expect(await mine.undoRun("run-1")).toEqual({ ok: false, reason: "left", left: [title] })
    expect(parentOf(mine.view(), title)).toBe(inner)
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
