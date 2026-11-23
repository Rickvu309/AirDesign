import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it, vi } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "./doom-remote.js"
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

function heldEdits(remote: DoomRemote) {
  let answer = () => undefined as void
  const answered = new Promise<void>((resolve) => {
    answer = resolve
  })
  const held: DoomRemote = {
    ...remote,
    edit: async (body) => {
      await answered
      return remote.edit(body)
    },
  }
  return { held, answer }
}

async function opened(remote: DoomRemote, how: typeof createDoomDeck, client: string) {
  const made = await how(remote, "follow", { client, storage: memoryStorage() })
  if (!made.ok) throw new Error(JSON.stringify(made))
  return made.deck
}

describe("following a deck", () => {
  it("takes the other tab's edits while its own edit is still on its way", async () => {
    const shared = memoryDoomRemote(start)
    const { held, answer } = heldEdits(shared)
    const mine = await opened(held, createDoomDeck, "mine")
    const other = await opened(shared, openDoomDeck, "other")
    mine.push([{ node: deckNode, prop: "name", value: "Mine" }])
    const stop = new AbortController()
    const following = mine.follow(stop.signal)
    other.push([{ node: card, prop: "name", value: "While saving" }])
    expect(await other.sync()).toEqual({ ok: true })
    await vi.waitFor(() => expect(nameOf(mine.view())).toBe("While saving"))
    expect(mine.pending()).toHaveLength(1)
    answer()
    await vi.waitFor(() => expect(mine.pending()).toEqual([]))
    stop.abort()
    await following
  })
})
