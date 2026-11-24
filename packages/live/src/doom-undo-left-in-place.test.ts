import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, card, outer, group, inner, tied, side, line, later, holder, anchor, link] = [
  id("g:1"),
  id("g:2"),
  id("g:3"),
  id("g:5"),
  id("g:6"),
  id("g:8"),
  id("g:9"),
  id("g:10"),
  id("g:11"),
  id("g:12"),
  id("g:13"),
  id("g:14"),
  id("g:15"),
  id("g:16"),
] as const
const lineFrom = (start: unknown) => ({
  kind: "line",
  start,
  end: { x: 10, y: 10 },
  route: "straight",
  arrows: ["none", "none"],
})
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
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
    { node: later, prop: "type", value: "slide" },
    { node: later, prop: "parent", value: { id: row, at: orderKeyBetween(orderKeyBetween(null, null), null) } },
    { node: card, prop: "type", value: "shape" },
    { node: card, prop: "parent", value: at(slide) },
    { node: card, prop: "box", value: placed(0) },
    { node: outer, prop: "type", value: "frame" },
    { node: outer, prop: "parent", value: at(slide) },
    { node: group, prop: "type", value: "frame" },
    { node: group, prop: "parent", value: at(outer) },
    { node: inner, prop: "type", value: "frame" },
    { node: inner, prop: "parent", value: at(group) },
    { node: tied, prop: "type", value: "shape" },
    { node: tied, prop: "parent", value: at(slide) },
    { node: tied, prop: "box", value: placed(300) },
    { node: side, prop: "type", value: "frame" },
    { node: side, prop: "parent", value: at(slide) },
    { node: side, prop: "box", value: placed(500) },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: at(outer) },
    { node: line, prop: "box", value: placed(0) },
    { node: line, prop: "geometry", value: lineFrom({ node: tied, site: "r" }) },
    { node: holder, prop: "type", value: "frame" },
    { node: holder, prop: "parent", value: at(slide) },
    { node: holder, prop: "box", value: placed(200) },
    { node: anchor, prop: "type", value: "shape" },
    { node: anchor, prop: "parent", value: at(holder) },
    { node: anchor, prop: "box", value: placed(300) },
    { node: link, prop: "type", value: "shape" },
    { node: link, prop: "parent", value: at(outer) },
    { node: link, prop: "box", value: placed(0) },
    { node: link, prop: "geometry", value: lineFrom({ node: anchor, site: "r" }) },
  ],
}

async function tabs() {
  const remote = memoryDoomRemote(start)
  const join = async (client: string, how: "create" | "open") => {
    let next = 0
    const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "left", {
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

const parentOf = (view: doom.Doom, node: doom.NodeId) =>
  (view.nodes.get(node) as { parent?: { id: doom.NodeId } | null }).parent?.id ?? null

describe("an undo that leaves a layer in the frame it was moved to", () => {
  it("leaves a layer turning with the frame it was framed in when another tab turned that frame and deleted the old one", async () => {
    const { mine, theirs, fromTheirs, theirUndo } = await tabs()
    const wrap = id("a:90")
    const turned = (rotation: number) => ({ ...placed(0), rotation })
    expect(
      mine.push([
        { node: outer, prop: "box", value: turned(30) },
        { node: card, prop: "parent", value: at(outer) },
      ]).ok,
    ).toBe(true)
    expect(
      mine.push([
        { node: wrap, prop: "type", value: "frame" },
        { node: wrap, prop: "parent", value: at(outer) },
        { node: wrap, prop: "box", value: placed(10) },
        { node: card, prop: "parent", value: at(wrap) },
        { node: card, prop: "box", value: placed(-10) },
      ]).ok,
    ).toBe(true)
    await fromTheirs([{ node: wrap, prop: "box", value: { ...placed(10), rotation: 45 } }])
    await fromTheirs([{ node: outer, prop: "parent", value: null }])
    expect(mine.undo()).toEqual({ ok: false, reason: "nothing" })
    await theirUndo()
    for (const view of [mine.view(), theirs.view()])
      expect([parentOf(view, card), parentOf(view, wrap), doom.propOf(view.nodes.get(card), "box")]).toEqual([
        wrap,
        outer,
        placed(-10),
      ])
  })

  it("leaves a layer where an agent run put it, at its turn, through Undo on the run and the Ctrl+Z presses after it", async () => {
    const { remote, mine } = await tabs()
    const turned = (x: number, w: number, h: number, rotation: number) => ({ ...placed(x), y: x, w, h, rotation })
    expect(
      mine.push([
        { node: outer, prop: "box", value: turned(100, 600, 400, 20) },
        { node: group, prop: "box", value: turned(50, 400, 300, 10) },
        { node: inner, prop: "box", value: turned(30, 200, 150, 0) },
        { node: card, prop: "parent", value: at(inner) },
        { node: card, prop: "box", value: turned(10, 100, 50, 0) },
      ]).ok,
    ).toBe(true)
    expect(
      mine.push([
        { node: card, prop: "parent", value: at(group) },
        { node: card, prop: "box", value: turned(40, 100, 50, 0) },
        { node: inner, prop: "parent", value: null },
      ]).ok,
    ).toBe(true)
    expect(await mine.sync()).toEqual({ ok: true })
    const author = { kind: "agent" as const, id: "aira", run: "run-1" }
    const moved = turned(190, 100, 50, 0)
    for (const edit of [
      {
        once: "r1",
        author,
        phase: "start" as const,
        writes: [
          { node: card, prop: "parent" as const, value: at(slide) },
          { node: card, prop: "box" as const, value: moved },
        ],
      },
      { once: "r2", author, phase: "stop" as const, writes: [] },
    ])
      expect((await remote.edit({ deck: "left", edit })).ok).toBe(true)
    await mine.catchUp()
    expect(mine.push([{ node: outer, prop: "parent", value: null }]).ok).toBe(true)
    expect(await mine.undoRun("run-1")).toEqual({ ok: false, reason: "left", kept: [], left: [card], waiting: [] })
    const stays = () => [parentOf(mine.view(), card), doom.propOf(mine.view().nodes.get(card), "box")]
    expect(stays()).toEqual([slide, moved])
    expect(mine.undo().ok).toBe(true)
    expect(stays()).toEqual([slide, moved])
    expect(mine.undo().ok).toBe(true)
    expect(stays()).toEqual([slide, moved])
    expect(await mine.sync()).toEqual({ ok: true })
    expect([parentOf(mine.server(), card), doom.propOf(mine.server().nodes.get(card), "box")]).toEqual([slide, moved])
  })

  it("keeps the end of a line an agent run freed when the person deletes the shape it was attached to and the frame it left, then presses Undo on the run", async () => {
    const { remote, mine } = await tabs()
    const author = { kind: "agent" as const, id: "aira", run: "run-1" }
    const freed = lineFrom({ x: 60, y: 40 })
    for (const edit of [
      {
        once: "r1",
        author,
        phase: "start" as const,
        writes: [
          { node: line, prop: "parent" as const, value: at(side) },
          { node: line, prop: "geometry" as const, value: freed },
        ],
      },
      { once: "r2", author, phase: "stop" as const, writes: [] },
    ])
      expect((await remote.edit({ deck: "left", edit })).ok).toBe(true)
    await mine.catchUp()
    expect(
      mine.push([
        { node: outer, prop: "parent", value: null },
        { node: tied, prop: "parent", value: null },
      ]).ok,
    ).toBe(true)
    await mine.undoRun("run-1")
    const stays = () => [parentOf(mine.view(), line), doom.propOf(mine.view().nodes.get(line), "geometry")]
    expect(stays()).toEqual([side, freed])
  })

  const takenAway = [
    ["hidden", [{ node: tied, prop: "hidden", value: true }]],
    ["moved to the next slide", [{ node: tied, prop: "parent", value: at(later) }]],
  ] as const satisfies readonly (readonly [string, readonly doom.Write[]])[]

  for (const [how, writes] of takenAway) {
    it(`keeps the end of a line an agent run freed when the person deletes the frame the line left and the shape it was attached to is ${how}, then presses Undo on the run`, async () => {
      const { remote, mine } = await tabs()
      const author = { kind: "agent" as const, id: "aira", run: "run-1" }
      const freed = lineFrom({ x: 60, y: 40 })
      for (const edit of [
        {
          once: "r1",
          author,
          phase: "start" as const,
          writes: [
            { node: line, prop: "parent" as const, value: at(side) },
            { node: line, prop: "geometry" as const, value: freed },
          ],
        },
        { once: "r2", author, phase: "stop" as const, writes: [] },
      ])
        expect((await remote.edit({ deck: "left", edit })).ok).toBe(true)
      await mine.catchUp()
      expect(mine.push([{ node: outer, prop: "parent", value: null }, ...writes]).ok).toBe(true)
      await mine.undoRun("run-1")
      expect([parentOf(mine.view(), line), doom.propOf(mine.view().nodes.get(line), "geometry")]).toEqual([side, freed])
    })

    it(`keeps the end of a line the person freed when another person deletes the frame the line left and the shape it was attached to is ${how}, then Ctrl+Z`, async () => {
      const { mine, fromTheirs } = await tabs()
      const freed = lineFrom({ x: 60, y: 40 })
      expect(
        mine.push([
          { node: line, prop: "parent", value: at(side) },
          { node: line, prop: "geometry", value: freed },
        ]).ok,
      ).toBe(true)
      await fromTheirs([{ node: outer, prop: "parent", value: null }, ...writes])
      expect(mine.undo()).toEqual({ ok: false, reason: "nothing" })
      expect([parentOf(mine.view(), line), doom.propOf(mine.view().nodes.get(line), "geometry")]).toEqual([side, freed])
    })
  }
  const shelved = [
    ["hidden", [{ node: holder, prop: "hidden", value: true }]],
    ["moved to the next slide", [{ node: holder, prop: "parent", value: at(later) }]],
  ] as const satisfies readonly (readonly [string, readonly doom.Write[]])[]
  const linkMoved = [
    { node: link, prop: "parent", value: at(side) },
    { node: link, prop: "geometry", value: lineFrom({ x: 60, y: 40 }) },
    { node: anchor, prop: "parent", value: at(slide) },
  ] as const satisfies readonly doom.Write[]
  const linkStays = (view: doom.Doom) => [parentOf(view, link), doom.propOf(view.nodes.get(link), "geometry")]

  for (const [how, writes] of shelved) {
    it(`keeps the end of a line an agent run freed when Undo on the run would put its shape back into a frame that is ${how}`, async () => {
      const { remote, mine } = await tabs()
      const author = { kind: "agent" as const, id: "aira", run: "run-1" }
      for (const edit of [
        { once: "r1", author, phase: "start" as const, writes: linkMoved },
        { once: "r2", author, phase: "stop" as const, writes: [] },
      ])
        expect((await remote.edit({ deck: "left", edit })).ok).toBe(true)
      await mine.catchUp()
      expect(mine.push([{ node: outer, prop: "parent", value: null }, ...writes]).ok).toBe(true)
      await mine.undoRun("run-1")
      expect(linkStays(mine.view())).toEqual([side, lineFrom({ x: 60, y: 40 })])
    })

    it(`keeps the end of a line the person freed when Ctrl+Z would put its shape back into a frame another person made ${how}`, async () => {
      const { mine, fromTheirs } = await tabs()
      expect(mine.push(linkMoved).ok).toBe(true)
      await fromTheirs([{ node: outer, prop: "parent", value: null }, ...writes])
      mine.undo()
      expect(linkStays(mine.view())).toEqual([side, lineFrom({ x: 60, y: 40 })])
    })
  }
})
