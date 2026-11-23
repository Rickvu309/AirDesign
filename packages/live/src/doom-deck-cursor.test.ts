import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, card] = [id("s:1"), id("s:2"), id("s:3"), id("s:4")] as const
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })

const start: doom.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    { node: card, prop: "type", value: "frame" },
    { node: card, prop: "parent", value: at(slide) },
    { node: card, prop: "name", value: "Card" },
  ],
}

const nameOf = (view: doom.Doom) => (view.nodes.get(card) as { name?: string }).name

async function deviceAhead() {
  const kept = memoryStorage()
  const before = await createDoomDeck(memoryDoomRemote(start), "ahead", { client: "old", storage: kept })
  if (!before.ok) throw new Error("create")
  for (const name of ["One", "Two"]) before.deck.push([{ node: card, prop: "name", value: name }])
  expect(await before.deck.sync()).toEqual({ ok: true })
  return kept
}

describe("a device copy ahead of the server", () => {
  it("takes the server's copy when a catch-up is refused with cursor, and follows from there", async () => {
    const kept = await deviceAhead()
    const server = memoryDoomRemote(start)
    const other = await createDoomDeck(server, "ahead", { client: "other" })
    if (!other.ok) throw new Error("server")
    const mine = await openDoomDeck(server, "ahead", {
      client: "mine",
      storage: kept,
      pause: () => new Promise((resolve) => setTimeout(resolve, 1)),
    })
    if (!mine.ok) throw new Error("open")
    expect(mine.deck.server().rev).toBe(3)
    expect(await mine.deck.catchUp()).toEqual({ ok: true })
    expect(mine.deck.server().rev).toBe(1)
    expect(nameOf(mine.deck.view())).toBe("Card")
    const stop = new AbortController()
    const following = mine.deck.follow(stop.signal)
    other.deck.push([{ node: card, prop: "name", value: "From the server" }])
    expect(await other.deck.sync()).toEqual({ ok: true })
    await expect.poll(() => nameOf(mine.deck.view())).toBe("From the server")
    expect(kept.saved()?.fold?.rev).toBe(2)
    stop.abort()
    await following
  })

  it("follows from the server's copy when the first catch-up of a follow is refused with cursor", async () => {
    const kept = await deviceAhead()
    const server = memoryDoomRemote(start)
    if (!(await createDoomDeck(server, "ahead", { client: "other" })).ok) throw new Error("server")
    const mine = await openDoomDeck(server, "ahead", {
      client: "mine",
      storage: kept,
      pause: () => new Promise((resolve) => setTimeout(resolve, 1)),
    })
    if (!mine.ok) throw new Error("open")
    const stop = new AbortController()
    const following = mine.deck.follow(stop.signal)
    await expect.poll(() => mine.deck.server().rev).toBe(1)
    expect(nameOf(mine.deck.view())).toBe("Card")
    stop.abort()
    await following
  })
})
