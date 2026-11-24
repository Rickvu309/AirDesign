import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const card = doom.nodeId("s:1")
const start: doom.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: card, prop: "type", value: "deck" },
    { node: card, prop: "name", value: "Original" },
  ],
}

async function pair() {
  const shared = memoryDoomRemote(start)
  const sent: doom.Edit[] = []
  const remote: DoomRemote & { blockEdits: boolean; sent: doom.Edit[] } = {
    ...shared,
    blockEdits: false,
    sent,
    async edit(body) {
      if (remote.blockEdits) throw new TypeError("offline")
      sent.push(body.edit)
      return shared.edit(body)
    },
  }
  const first = await createDoomDeck(remote, "read-base", { storage: memoryStorage() })
  const second = await openDoomDeck(shared, "read-base", { storage: memoryStorage() })
  if (!first.ok || !second.ok) throw new Error("deck not open")
  return { first: first.deck, second: second.deck, remote }
}

const accepted = (result: { readonly ok: boolean }) => expect(result.ok).toBe(true)

describe("a local edit with a read base", () => {
  it("refuses an old optimistic view even when the replacement has the same revision", async () => {
    const { first, second, remote } = await pair()
    remote.blockEdits = true
    accepted(first.push([{ node: card, prop: "name", value: "Local" }], { read: first.view() }))
    const read = first.view()
    await first.sync()
    accepted(second.push([{ node: card, prop: "nameFollows", value: false }]))
    await second.sync()
    await first.catchUp()
    expect(first.view().rev).toBe(read.rev)
    expect(first.push([{ node: card, prop: "name", value: "Prepared" }], { read })).toEqual({
      ok: false,
      refused: { refused: "stale" },
    })
    expect(doom.deckName(first.view())).toBe("Original")
  })

  it("checks an edit after no-op filtering and prepares undo and redo on the current fold", async () => {
    const { first, remote } = await pair()
    const rename = (value: string): doom.Write[] => [{ node: card, prop: "name", value }]
    accepted(first.push(rename("Mine"), { read: first.view() }))
    await first.sync()
    accepted(first.push(rename("Mine"), { read: first.view() }))
    await first.sync()
    accepted(first.undo())
    await first.sync()
    expect(doom.deckName(first.view())).toBe("Original")
    accepted(first.redo())
    await first.sync()
    expect(doom.deckName(first.view())).toBe("Mine")
    expect(remote.sent.map(({ readBase }) => readBase)).toEqual([1, 2, 3])
  })
})

it("removes an empty guarded edit cached by an older client after the server returns the same head", async () => {
  const shared = memoryDoomRemote(start)
  const deck = "read-base"
  const opened = await shared.create({ deck })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  const storage = memoryStorage()
  const edit: doom.Edit = { ...start, once: "old-empty", writes: [], readBase: opened.fold.rev }
  await storage.write({ fold: opened.fold, queue: [{ edit, after: [], afterRead: [] }] })
  let attempts = 0
  const remote: DoomRemote = {
    ...shared,
    edit(body) {
      attempts += 1
      if (attempts > 1) throw new Error("empty edit was resent")
      return shared.edit(body)
    },
  }
  const restored = await openDoomDeck(remote, deck, { storage })
  if (!restored.ok) throw new Error(JSON.stringify(restored))
  expect(await restored.deck.sync()).toEqual({ ok: true })
  expect(restored.deck.pending()).toEqual([])
  expect(restored.deck.view().rev).toBe(opened.rev)
  expect(restored.deck.notices()).toEqual([])
})
