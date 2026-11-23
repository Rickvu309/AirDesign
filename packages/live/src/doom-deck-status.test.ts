import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import type { DoomLanded } from "@airdesign/catalog"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, title, card] = [id("s:1"), id("s:2"), id("s:3"), id("s:4"), id("s:5")] as const
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
    { node: title, prop: "text", value: words("one") },
    { node: card, prop: "type", value: "frame" },
    { node: card, prop: "parent", value: at(slide) },
    { node: card, prop: "name", value: "Card" },
  ],
}

type Answer = "server" | "offline" | "held" | DoomLanded

function steered(remote: DoomRemote) {
  let answer: Answer = "server"
  let release: () => void = () => undefined
  let holding = 0
  const wrapped: DoomRemote = {
    ...remote,
    since: async (body, signal) => {
      if (body.wait === true) holding += 1
      return remote.since(body, signal)
    },
    edit: async (body) => {
      if (answer === "offline") throw new TypeError("offline")
      if (answer === "held") await new Promise<void>((resolve) => (release = resolve))
      return answer === "server" || answer === "held" ? remote.edit(body) : answer
    },
  }
  return {
    remote: wrapped,
    answer: (next: Answer) => {
      answer = next
    },
    release: () => release(),
    holding: () => holding,
  }
}

let names = 0

async function opened(remote: DoomRemote, client: string, how: "create" | "open") {
  const deck = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, `status${String(names)}`, {
    client,
    once: (() => {
      let next = 0
      return () => `${client}-${String((next += 1))}`
    })(),
    storage: memoryStorage(),
    pause: () => new Promise((resolve) => setTimeout(resolve, 1)),
  })
  if (!deck.ok) throw new Error(JSON.stringify(deck))
  return deck.deck
}

async function pair() {
  names += 1
  const shared = memoryDoomRemote(start)
  const steer = steered(shared)
  const mine = await opened(steer.remote, "a", "create")
  const theirs = await opened(shared, "b", "open")
  return { steer, mine, theirs }
}

describe("a deck's status", () => {
  it("is saved with nothing to send, saving while an edit is out, and saved once it lands", async () => {
    const { steer, mine } = await pair()
    expect(mine.status()).toEqual({ kind: "saved" })
    steer.answer("held")
    mine.push([{ node: card, prop: "name", value: "Sent" }])
    expect(mine.status()).toEqual({ kind: "saving" })
    expect(mine.status()).toBe(mine.status())
    steer.answer("server")
    const synced = mine.sync()
    steer.release()
    expect(await synced).toEqual({ ok: true })
    expect(mine.status()).toEqual({ kind: "saved" })
  })

  it("is offline while edits wait for the network, and saved when they land after it comes back", async () => {
    const { steer, mine } = await pair()
    steer.answer("offline")
    let told = 0
    mine.subscribe(() => (told += 1))
    mine.push([{ node: card, prop: "name", value: "Off" }])
    expect(await mine.sync()).toEqual({ ok: false, reason: "offline" })
    expect(mine.status()).toEqual({ kind: "offline" })
    const tellsBefore = told
    expect(told).toBeGreaterThan(0)
    steer.answer("server")
    expect(await mine.sync()).toEqual({ ok: true })
    expect(mine.status()).toEqual({ kind: "saved" })
    expect(told).toBeGreaterThan(tellsBefore)
  })

  it("is blocked while the server refuses to take edits at all, and keeps them to send", async () => {
    const { steer, mine } = await pair()
    steer.answer({ ok: false, refusal: "owner" })
    mine.push([{ node: card, prop: "name", value: "Kept" }])
    expect(await mine.sync()).toEqual({ ok: false, reason: "blocked", refusal: "owner" })
    expect(mine.status()).toEqual({ kind: "blocked" })
    expect(mine.pending()).toHaveLength(1)
  })

  it("says how many edits a refusal set aside, counting the edits queued behind it, until the notices are cleared", async () => {
    const { mine, theirs } = await pair()
    theirs.push([{ node: title, prop: "text", value: words("theirs") }])
    expect(await theirs.sync()).toEqual({ ok: true })
    mine.push([{ node: title, prop: "text", value: words("mine") }])
    mine.push([{ node: title, prop: "text", value: words("mine again") }])
    mine.push([{ node: card, prop: "name", value: "Unrelated" }])
    expect(await mine.sync()).toEqual({ ok: true })
    expect(mine.status()).toEqual({ kind: "set-aside", edits: 2, tooLarge: false })
    expect(mine.status()).toBe(mine.status())
    mine.clearNotices()
    expect(mine.status()).toEqual({ kind: "saved" })
  })

  it("says an edit refused for its size was set aside as too large", async () => {
    const { steer, mine } = await pair()
    steer.answer({ ok: false, refusal: "size" })
    mine.push([{ node: card, prop: "name", value: "Huge" }])
    steer.answer("server")
    await mine.sync()
    expect(mine.status()).toEqual({ kind: "set-aside", edits: 1, tooLarge: true })
  })

  it("sends an edit AirDesign could not take again while following, with no new edit to wake it", async () => {
    const { steer, mine } = await pair()
    const stop = new AbortController()
    const following = mine.follow(stop.signal)
    await expect.poll(() => steer.holding()).toBe(1)
    steer.answer("offline")
    mine.push([{ node: card, prop: "name", value: "Again" }])
    await expect.poll(() => mine.status()).toEqual({ kind: "offline" })
    steer.answer("server")
    await expect.poll(() => mine.status()).toEqual({ kind: "saved" })
    expect(mine.pending()).toEqual([])
    stop.abort()
    await following
  })
})
