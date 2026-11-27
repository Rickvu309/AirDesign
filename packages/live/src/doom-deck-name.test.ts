import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"
import { starts } from "@airdesign/doom/testing"

const id = doom.nodeId
const [deck, row, slide, title] = [id("s:1"), id("s:2"), id("s:3"), id("s:4")] as const
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const words = (chars: string): doom.Text => ({
  chars,
  spans: [],
  paras: [{}],
  style: "title",
  resize: "height",
  alignV: "top",
})

const start = (name: string): doom.Edit => ({
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deck, prop: "type", value: "deck" },
    { node: deck, prop: "name", value: name },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deck) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    { node: title, prop: "type", value: "shape" },
    { node: title, prop: "parent", value: at(slide) },
    { node: title, prop: "role", value: "title" },
    { node: title, prop: "text", value: words("Untitled") },
  ],
})

async function open(
  name: string,
  remote: DoomRemote = memoryDoomRemote(start(name)),
  client = "a",
  storage = memoryStorage(),
) {
  let next = 0
  const opened = await createDoomDeck(remote, "deck-name", {
    once: () => `${client}-${(next += 1)}`,
    client,
    storage,
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

const nameOf = (view: doom.Doom) => (view.nodes.get(deck) as { name?: string }).name

const retitle = (_view: doom.Doom, chars: string): doom.Write => ({
  node: title,
  prop: "text",
  value: words(chars),
})

describe("a new deck's name", () => {
  it("follows slide 1's title in the same undo step", async () => {
    const opened = await open(starts.deckName)
    expect(opened.push([retitle(opened.view(), "Q3 board update")]).ok).toBe(true)
    expect(nameOf(opened.view())).toBe("Q3 board update")
    expect(opened.undo().ok).toBe(true)
    expect(nameOf(opened.view())).toBe(starts.deckName)
  })

  it("keeps a name the person typed", async () => {
    const opened = await open("Board pack")
    expect(opened.push([retitle(opened.view(), "Q3 board update")]).ok).toBe(true)
    expect(nameOf(opened.view())).toBe("Board pack")
  })
})

describe("a title typed in a tab that is behind", () => {
  it("keeps the name another tab gave the deck, and keeps the typed title", async () => {
    const shared = memoryDoomRemote(start(starts.deckName))
    let release = () => undefined as void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const slow: DoomRemote = {
      ...shared,
      edit: async (body) => {
        await held
        return shared.edit(body)
      },
    }
    const behind = await open(starts.deckName, slow, "a")
    const ahead = await open(starts.deckName, shared, "b")
    expect(behind.push([retitle(behind.view(), "Stale title")]).ok).toBe(true)
    expect(ahead.push([{ node: deck, prop: "name", value: "Mine" }]).ok).toBe(true)
    expect((await ahead.sync()).ok).toBe(true)
    release()
    await behind.sync()
    const server = await shared.open({ deck: "deck-name" })
    if (!server.ok) throw new Error(JSON.stringify(server))
    expect(nameOf(server.fold)).toBe("Mine")
    expect((server.fold.nodes.get(title) as { text?: doom.Text }).text?.chars).toBe("Stale title")
    expect(behind.notices()).toEqual([])
  })
})

describe("a title typed before a reload, in a tab that is behind", () => {
  it("still lets the server refuse only the derived name, with no notice after the reload", async () => {
    const shared = memoryDoomRemote(start(starts.deckName))
    const offline: DoomRemote = { ...shared, edit: () => Promise.reject(new Error("offline")) }
    const kept = memoryStorage()
    const behind = await open(starts.deckName, offline, "a", kept)
    expect(behind.push([retitle(behind.view(), "Stale title")]).ok).toBe(true)
    await behind.sync()
    expect(behind.pending()).toHaveLength(2)
    const ahead = await open(starts.deckName, shared, "b")
    expect(ahead.push([{ node: deck, prop: "name", value: "Mine" }]).ok).toBe(true)
    expect((await ahead.sync()).ok).toBe(true)
    const reopened = await open(starts.deckName, shared, "a", kept)
    await reopened.sync()
    const server = await shared.open({ deck: "deck-name" })
    if (!server.ok) throw new Error(JSON.stringify(server))
    expect(nameOf(server.fold)).toBe("Mine")
    expect((server.fold.nodes.get(title) as { text?: doom.Text }).text?.chars).toBe("Stale title")
    expect(reopened.notices()).toEqual([])
    expect(reopened.pending()).toEqual([])
  })
})
