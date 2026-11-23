import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { deleteDatabase } from "./device.js"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const deckNode = id("s:1")
const row = id("s:2")
const slide = id("s:3")
const title = id("s:4")
const card = id("s:5")
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

type Tab = DoomRemote & { offline: boolean; readonly sent: string[] }

function tab(remote: DoomRemote): Tab {
  const cut = () => {
    if (spy.offline) throw new TypeError("offline")
  }
  const spy: Tab = {
    offline: false,
    sent: [],
    create: (body) => remote.create(body),
    open: (body) => remote.open(body),
    since: async (body, signal) => {
      cut()
      return remote.since(body, signal)
    },
    edit: async (body) => {
      cut()
      spy.sent.push(body.edit.once)
      return remote.edit(body)
    },
  }
  return spy
}

let names = 0
const named = () => `tabs${(names += 1)}`

function counter(prefix: string) {
  let next = 0
  return () => `${prefix}-${(next += 1)}`
}

async function opened(remote: DoomRemote, deck: string, client: string, storage?: ReturnType<typeof memoryStorage>) {
  const answer = await openDoomDeck(remote, deck, {
    once: counter(client),
    client,
    ...(storage === undefined ? {} : { storage }),
  })
  if (!answer.ok) throw new Error(JSON.stringify(answer))
  return answer.deck
}

const textOf = (view: doom.Doom) => (view.nodes.get(title) as { text?: doom.Text }).text?.chars
const nameOf = (view: doom.Doom) => (view.nodes.get(card) as { name?: string }).name

describe("two tabs on one device", () => {
  beforeEach(installIndexedDb)
  afterEach(async () => {
    await deleteDatabase()
  })

  it("keep their unsent edits apart, so the next open paints and sends both tabs' edits, each once", async () => {
    const shared = memoryDoomRemote(start)
    const deck = named()
    if (!(await createDoomDeck(shared, deck, { client: "start" })).ok) throw new Error("create")
    const tabA = tab(shared)
    const tabB = tab(shared)
    const first = await opened(tabA, deck, "a")
    const second = await opened(tabB, deck, "b")
    tabA.offline = true
    tabB.offline = true
    const typed = [
      first.push([{ node: title, prop: "text", value: words("a one") }]),
      second.push([{ node: card, prop: "name", value: "from b" }]),
      first.push([{ node: title, prop: "text", value: words("a two") }]),
    ]
    for (const each of typed) if ("saved" in each) await each.saved
    const next = tab(shared)
    const reopened = await opened(next, deck, "c")
    const pending = reopened.pending().map((edit) => edit.once)
    expect(pending.toSorted()).toEqual(["a-1", "a-2", "b-1"])
    expect(pending.indexOf("a-1")).toBeLessThan(pending.indexOf("a-2"))
    expect(textOf(reopened.view())).toBe("a two")
    expect(nameOf(reopened.view())).toBe("from b")
    expect(await reopened.sync()).toEqual({ ok: true })
    expect(next.sent.toSorted()).toEqual(["a-1", "a-2", "b-1"])
    expect(textOf(reopened.server())).toBe("a two")
    expect(nameOf(reopened.server())).toBe("from b")
    tabA.offline = false
    tabB.offline = false
    expect(await first.sync()).toEqual({ ok: true })
    expect(await second.sync()).toEqual({ ok: true })
    expect(reopened.server().rev).toBe(4)
    await vi.waitFor(async () => {
      expect((await opened(next, deck, "d")).pending()).toEqual([])
    })
  })
})

describe("a kept edit built on another edit", () => {
  it("is sent once the edit it was built on has landed, and dropped when nobody sent that edit", async () => {
    const shared = memoryDoomRemote(start)
    const deck = named()
    const writer = tab(shared)
    const kept = memoryStorage()
    const made = await createDoomDeck(writer, deck, { once: counter("x"), client: "x", storage: kept })
    if (!made.ok) throw new Error("create")
    writer.offline = true
    expect(made.deck.push([{ node: title, prop: "text", value: words("x one") }]).ok).toBe(true)
    expect(made.deck.push([{ node: title, prop: "text", value: words("x two") }]).ok).toBe(true)
    await made.deck.sync()
    const fold = kept.saved()?.fold
    const built = kept.saved()?.queue[1]
    if (fold === undefined || built === undefined) throw new Error("saved")
    expect(built.after).toEqual(["x-1"])
    const alone = async (client: string) => {
      const storage = memoryStorage()
      await storage.write({ fold, queue: [built] })
      return opened(tab(shared), deck, client, storage)
    }
    const orphan = await alone("y")
    expect(await orphan.sync()).toEqual({ ok: true })
    expect(orphan.pending()).toEqual([])
    expect(orphan.notices()).toEqual([{ once: "x-2", refused: "stale", because: "x-1" }])
    expect(textOf(orphan.server())).toBe("one")
    writer.offline = false
    expect(await made.deck.sync()).toEqual({ ok: true })
    const late = await alone("z")
    expect(await late.sync()).toEqual({ ok: true })
    expect(late.pending()).toEqual([])
    expect(late.notices()).toEqual([])
    expect(textOf(late.server())).toBe("x two")
  })
})
