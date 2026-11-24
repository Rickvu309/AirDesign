import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, frame, card] = [id("g:1"), id("g:2"), id("g:3"), id("g:4"), id("g:5")]
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const box = (x: number, y: number, w: number, h: number, flipH = false) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH,
  flipV: false,
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
    { node: frame, prop: "type", value: "frame" },
    { node: frame, prop: "parent", value: at(slide) },
    { node: frame, prop: "box", value: box(100, 100, 600, 400) },
    { node: card, prop: "type", value: "shape" },
    { node: card, prop: "parent", value: at(frame) },
    { node: card, prop: "box", value: box(10, 10, 100, 50) },
  ],
}

async function open() {
  const remote = memoryDoomRemote(start)
  let next = 0
  const opened = await createDoomDeck(remote, "stray", {
    once: () => `a-${(next += 1)}`,
    client: "a",
    storage: memoryStorage(),
    pause: () => Promise.resolve(),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  const run = async (name: string, writes: readonly doom.Write[]) => {
    await opened.deck.sync()
    const author = { kind: "agent" as const, id: "aira", run: name }
    const landed = await remote.edit({ deck: "stray", edit: { once: `${name}-1`, author, writes, phase: "start" } })
    expect(landed.ok).toBe(true)
    await remote.edit({ deck: "stray", edit: { once: `${name}-2`, author, writes: [], phase: "stop" } })
    await opened.deck.catchUp()
  }
  return { deck: opened.deck, run }
}

async function joinedAs(remote: ReturnType<typeof memoryDoomRemote>, client: string) {
  let next = 0
  const opened = await createDoomDeck(remote, "stray", {
    once: () => `${client}-${(next += 1)}`,
    client,
    storage: memoryStorage(),
    pause: () => Promise.resolve(),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

const cardIn = (view: doom.Doom) => ({
  parent: (view.nodes.get(card) as { parent: { id: doom.NodeId } }).parent.id,
  box: (view.nodes.get(card) as { box: ReturnType<typeof box> }).box,
})

const toSlide = () => ({ node: card, prop: "parent" as const, value: at(slide) })

describe("an undo that writes a layer's box but not its frame", () => {
  it("leaves where the layer sits once another writer moved it out of the frame, and puts the size back", async () => {
    const { deck, run } = await open()
    expect(deck.push([{ node: card, prop: "box", value: box(40, 30, 200, 80) }]).ok).toBe(true)
    await run("run-1", [toSlide()])
    expect(deck.undo().ok).toBe(true)
    expect(cardIn(deck.view())).toEqual({ parent: slide, box: box(40, 30, 100, 50) })
    expect(deck.redo().ok).toBe(true)
    expect(cardIn(deck.view())).toEqual({ parent: slide, box: box(40, 30, 200, 80) })
  })

  it("puts back a flip but leaves the place", async () => {
    const { deck, run } = await open()
    expect(deck.push([{ node: card, prop: "box", value: box(40, 30, 200, 80, true) }]).ok).toBe(true)
    await run("run-1", [toSlide()])
    expect(deck.undo().ok).toBe(true)
    expect(cardIn(deck.view())).toEqual({ parent: slide, box: box(40, 30, 100, 50) })
  })

  it("leaves where the layer sits when Undo on a run's resize meets a person's move out of the frame", async () => {
    const { deck, run } = await open()
    await run("run-1", [{ node: card, prop: "box", value: box(40, 30, 200, 80) }])
    expect(deck.push([toSlide()]).ok).toBe(true)
    expect((await deck.undoRun("run-1")).ok).toBe(true)
    expect(cardIn(deck.view())).toEqual({ parent: slide, box: box(40, 30, 100, 50) })
  })

  it("leaves where the layer sits for a Ctrl+Z after Undo on a run that moved it out of a frame since deleted", async () => {
    const { deck, run } = await open()
    expect(deck.push([{ node: card, prop: "box", value: box(40, 30, 120, 60) }]).ok).toBe(true)
    await run("run-1", [toSlide(), { node: card, prop: "box", value: box(140, 130, 200, 80) }])
    expect(deck.push([{ node: frame, prop: "parent", value: null }]).ok).toBe(true)
    expect((await deck.undoRun("run-1")).ok).toBe(true)
    expect(cardIn(deck.view())).toEqual({ parent: slide, box: box(140, 130, 120, 60) })
    expect(deck.undo().ok).toBe(true)
    expect(deck.undo().ok).toBe(true)
    expect(cardIn(deck.view())).toEqual({ parent: slide, box: box(140, 130, 100, 50) })
  })

  it("takes a step back in full when the person's own undo put the layer back in its frame", async () => {
    const { deck } = await open()
    expect(deck.push([{ node: card, prop: "box", value: box(40, 30, 200, 80) }]).ok).toBe(true)
    expect(
      deck.push([
        { node: card, prop: "parent", value: at(slide) },
        { node: card, prop: "box", value: box(140, 130, 200, 80) },
      ]).ok,
    ).toBe(true)
    expect(deck.undo().ok).toBe(true)
    expect(deck.undo().ok).toBe(true)
    expect(cardIn(deck.view())).toEqual({ parent: frame, box: box(10, 10, 100, 50) })
  })

  it("leaves where the layer sits when another writer reordered it within the frame the step moved it to", async () => {
    const { deck, run } = await open()
    const k = orderKeyBetween(null, null)
    expect(
      deck.push([
        { node: card, prop: "parent", value: { id: slide, at: orderKeyBetween(k, null) } },
        { node: card, prop: "box", value: box(110, 110, 100, 50) },
        { node: frame, prop: "parent", value: null },
      ]).ok,
    ).toBe(true)
    await run("run-1", [{ node: card, prop: "parent", value: { id: slide, at: orderKeyBetween(null, k) } }])
    expect(deck.undo().ok).toBe(true)
    expect(cardIn(deck.view())).toEqual({ parent: slide, box: box(110, 110, 100, 50) })
    expect((deck.view().nodes.get(frame) as { parent: unknown }).parent).not.toBeNull()
  })

  it("leaves where the layer sits for Undo on a run that moved it out of a frame when another writer reordered it", async () => {
    const { deck, run } = await open()
    const k = orderKeyBetween(null, null)
    await run("run-1", [
      { node: card, prop: "parent", value: { id: slide, at: orderKeyBetween(k, null) } },
      { node: card, prop: "box", value: box(110, 110, 200, 80) },
    ])
    expect(deck.push([{ node: card, prop: "parent", value: { id: slide, at: orderKeyBetween(null, k) } }]).ok).toBe(
      true,
    )
    expect((await deck.undoRun("run-1")).ok).toBe(true)
    expect(cardIn(deck.view())).toEqual({ parent: slide, box: box(110, 110, 100, 50) })
  })

  it("leaves where the layer sits when two people group it, move it and undo in turn", async () => {
    const remote = memoryDoomRemote(start)
    const [a, b] = [await joinedAs(remote, "a"), await joinedAs(remote, "b")]
    const both = async () => {
      for (const deck of [a, b, a, b]) {
        await deck.sync()
        await deck.catchUp()
      }
    }
    const group = doom.nodeId("g:9")
    expect(
      b.push([
        { node: group, prop: "type", value: "frame" },
        { node: group, prop: "parent", value: at(slide) },
        { node: group, prop: "box", value: box(300, 200, 400, 300) },
        { node: card, prop: "parent", value: at(group) },
        { node: card, prop: "box", value: box(10, 10, 100, 50) },
      ]).ok,
    ).toBe(true)
    await both()
    expect(a.push([{ node: card, prop: "box", value: box(20, 10, 100, 50) }]).ok).toBe(true)
    await both()
    expect(b.undo().ok).toBe(true)
    await both()
    const seen = cardIn(a.view())
    a.undo()
    await both()
    expect(cardIn(a.view())).toEqual(seen)
  })

  it("catches the group's undo up when the tab pressing it has not yet seen the other tab's nudge of the layer", async () => {
    const remote = memoryDoomRemote(start)
    const [a, b] = [await joinedAs(remote, "a"), await joinedAs(remote, "b")]
    const group = doom.nodeId("g:9")
    expect(
      b.push([
        { node: group, prop: "type", value: "frame" },
        { node: group, prop: "parent", value: at(slide) },
        { node: group, prop: "box", value: box(300, 200, 400, 300) },
        { node: card, prop: "parent", value: at(group) },
        { node: card, prop: "box", value: box(0, 0, 100, 50) },
      ]).ok,
    ).toBe(true)
    await b.sync()
    await a.catchUp()
    expect(a.push([{ node: card, prop: "box", value: box(20, 10, 100, 50) }]).ok).toBe(true)
    await a.sync()
    expect(b.undo().ok).toBe(true)
    await b.sync()
    const nudged = { parent: frame, box: box(20, 10, 100, 50) }
    expect(b.notices()).toEqual([])
    expect(cardIn(b.view())).toEqual(nudged)
    expect(b.view().nodes.get(group)).toMatchObject({ parent: null })
    await a.catchUp()
    expect(cardIn(a.view())).toEqual(nudged)
    expect(b.redo().ok).toBe(true)
    await b.sync()
    const regrouped = { parent: group, box: box(20, 10, 100, 50) }
    expect(b.notices()).toEqual([])
    expect(cardIn(b.view())).toEqual(regrouped)
    await a.catchUp()
    expect(cardIn(a.view())).toEqual(regrouped)
  })

  it("lands the group's undo once the tab pressing it has caught up with the other tab's nudge", async () => {
    const remote = memoryDoomRemote(start)
    const [a, b] = [await joinedAs(remote, "a"), await joinedAs(remote, "b")]
    const group = doom.nodeId("g:9")
    expect(
      b.push([
        { node: group, prop: "type", value: "frame" },
        { node: group, prop: "parent", value: at(slide) },
        { node: group, prop: "box", value: box(300, 200, 400, 300) },
        { node: card, prop: "parent", value: at(group) },
        { node: card, prop: "box", value: box(0, 0, 100, 50) },
      ]).ok,
    ).toBe(true)
    await b.sync()
    await a.catchUp()
    expect(a.push([{ node: card, prop: "box", value: box(20, 10, 100, 50) }]).ok).toBe(true)
    await a.sync()
    await b.catchUp()
    expect(b.undo().ok).toBe(true)
    await b.sync()
    expect(b.notices()).toEqual([])
    expect(cardIn(b.view()).parent).toBe(frame)
  })
})
