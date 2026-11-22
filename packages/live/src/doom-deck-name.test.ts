import { doom, orderKeyBetween } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { createDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

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

async function open(name: string) {
  let next = 0
  const opened = await createDoomDeck(memoryDoomRemote(start(name)), "deck-name", {
    once: () => `n-${(next += 1)}`,
    client: "a",
    storage: memoryStorage(),
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
  it("follows slide 1's title in the same edit and the same undo step", async () => {
    const opened = await open(doom.blankDeckName)
    expect(opened.push([retitle(opened.view(), "Q3 board update")]).ok).toBe(true)
    expect(nameOf(opened.view())).toBe("Q3 board update")
    expect(opened.pending()).toHaveLength(1)
    expect(opened.undo().ok).toBe(true)
    expect(nameOf(opened.view())).toBe(doom.blankDeckName)
  })

  it("keeps a name the person typed", async () => {
    const opened = await open("Board pack")
    expect(opened.push([retitle(opened.view(), "Q3 board update")]).ok).toBe(true)
    expect(nameOf(opened.view())).toBe("Board pack")
  })
})
