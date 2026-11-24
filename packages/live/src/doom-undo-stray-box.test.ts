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
})
