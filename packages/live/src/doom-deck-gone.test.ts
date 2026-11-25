import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { deleteDatabase } from "./device.js"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "./doom-remote.js"
import { deviceStorage, doomFoldKey, memoryStorage } from "./doom-storage.js"
import { changeSlots } from "./store.js"

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
  ],
}

type Gone = DoomRemote & { gone: boolean; asked: number }

function goneLater(remote: DoomRemote): Gone {
  const refused = { ok: false, refusal: "deck" } as const
  const server: Gone = {
    gone: false,
    asked: 0,
    create: (body) => remote.create(body),
    open: async (body) => (server.gone ? refused : remote.open(body)),
    edit: async (body) => (server.gone ? refused : remote.edit(body)),
    since: async (body, signal) => {
      server.asked += 1
      return server.gone ? refused : remote.since(body, signal)
    },
  }
  return server
}

describe("a deck the server no longer has", () => {
  beforeEach(installIndexedDb)
  afterEach(async () => {
    await deleteDatabase()
  })

  it("opens from the device copy, then stops following and drops the copy once the server says it is gone", async () => {
    const server = goneLater(memoryDoomRemote(start))
    const made = await createDoomDeck(server, "trashed", { client: "a" })
    if (!made.ok) throw new Error("create")
    server.gone = true
    const opened = await openDoomDeck(server, "trashed", {
      client: "a",
      pause: () => new Promise((resolve) => setTimeout(resolve, 1)),
    })
    if (!opened.ok) throw new Error("the device copy should open")
    const pushed = opened.deck.push([{ node: card, prop: "name", value: "Typed after the trash" }])
    if ("saved" in pushed) await pushed.saved
    expect(await opened.deck.follow(new AbortController().signal)).toBe("gone")
    expect(server.asked).toBe(1)
    expect(await deviceStorage("trashed").read()).toBeUndefined()
    expect(await openDoomDeck(server, "trashed", { client: "a" })).toEqual({ ok: false, refusal: "deck" })
  })

  it("ignores a stale fold with a retired chart and reports the dropped deck missing", async () => {
    const server = goneLater(memoryDoomRemote(start))
    const storage = deviceStorage("old-chart")
    const made = await createDoomDeck(server, "old-chart", { client: "a", storage })
    expect(made.ok).toBe(true)
    const kept = await storage.read()
    if (kept?.fold === undefined) throw new Error("missing stored fold")
    const fold = doom.foldToJson(kept.fold)
    if (typeof fold !== "object" || fold === null) throw new Error("invalid serialized fold")
    const stale = {
      ...fold,
      nodes: {
        ...Object.fromEntries(kept.fold.nodes),
        [card]: { ...kept.fold.nodes.get(card), chart: { kind: "column", categories: ["A"], series: [] } },
      },
    }
    await changeSlots([{ key: doomFoldKey("old-chart"), value: stale }], [])

    expect(await storage.read()).toBeUndefined()
    server.gone = true
    expect(await openDoomDeck(server, "old-chart", { client: "b" })).toEqual({ ok: false, refusal: "deck" })
  })

  it("drops the unsent edits it kept when the server refuses to open the deck", async () => {
    const server = goneLater(memoryDoomRemote(start))
    if (!(await createDoomDeck(server, "deleted", { client: "a", storage: memoryStorage() })).ok)
      throw new Error("create")
    const edit: doom.Edit = {
      once: "kept",
      author: { kind: "person", id: "a" },
      writes: [{ node: card, prop: "name", value: "Never sent" }],
    }
    await deviceStorage("deleted").write({ queue: [{ edit, after: [null] }] })
    server.gone = true
    expect(await openDoomDeck(server, "deleted", { client: "b" })).toEqual({ ok: false, refusal: "deck" })
    expect(await deviceStorage("deleted").read()).toBeUndefined()
  })
})

describe("edits a device kept from before charts were retired", () => {
  beforeEach(installIndexedDb)
  afterEach(async () => {
    await deleteDatabase()
  })

  it("refuses a queued chart edit without failing and saves the edits queued with it", async () => {
    const server = memoryDoomRemote(start)
    if (!(await createDoomDeck(server, "queued-chart", { client: "a", storage: memoryStorage() })).ok)
      throw new Error("create")
    const chart = {
      once: "kept-chart",
      author: { kind: "person", id: "a" },
      writes: [{ node: card, prop: "chart", value: { kind: "column", categories: ["A"], series: [] } }],
    } as unknown as doom.Edit
    const name: doom.Edit = {
      once: "kept-name",
      author: { kind: "person", id: "a" },
      writes: [{ node: card, prop: "name", value: "Kept" }],
    }
    await deviceStorage("queued-chart").write({
      queue: [
        { edit: chart, after: [null] },
        { edit: name, after: [null] },
      ],
    })

    const opened = await openDoomDeck(server, "queued-chart", { client: "b" })
    if (!opened.ok) throw new Error(JSON.stringify(opened))
    expect(await opened.deck.sync()).toEqual({ ok: true })
    expect(opened.deck.pending()).toEqual([])
    expect(opened.deck.notices()).toEqual([{ once: "kept-chart", refused: "shape", node: card }])
    expect((await deviceStorage("queued-chart").read())?.queue).toEqual([])
    const saved = await server.open({ deck: "queued-chart" })
    if (!saved.ok) throw new Error(JSON.stringify(saved))
    expect(saved.fold.nodes.get(card)).toEqual(opened.deck.view().nodes.get(card))
    expect(saved.fold.nodes.get(card)).toMatchObject({ name: "Kept" })
    expect(saved.fold.nodes.get(card)).not.toHaveProperty("chart")
  })
})
