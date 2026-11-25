import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, expect, it } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { deleteDatabase } from "./device.js"
import { createDoomDeck } from "./doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "./doom-remote.js"

beforeEach(installIndexedDb)
afterEach(deleteDatabase)

const at = doom.orderKeyBetween(null, null)
const person: doom.Author = { kind: "person", id: "person" }
const other: doom.Author = { kind: "agent", id: "agent", run: "template" }
const measure = doom.measureWith({})
const deckNode = doom.nodeId("s:1")
const slide = doom.nodeId("s:4")
const component = doom.nodeId("c:1")
const frame = doom.nodeId("frame:1")

const spec = (width: number) => ({
  version: 1,
  name: "Tile",
  collections: {},
  parts: [{ emit: { kind: "rect", key: ["list", "tile"], x: 0, y: 0, w: width, h: 100, fill: { var: "accent1" } } }],
  sample: { w: 300, h: 100, data: {} },
})

async function onSlideTwo() {
  const shared = memoryDoomRemote({
    once: "start",
    author: person,
    writes: [
      { node: deckNode, prop: "type", value: "deck" },
      { node: deckNode, prop: "theme", value: doom.defaultTheme },
      { node: doom.nodeId("s:2"), prop: "type", value: "slideRow" },
      { node: doom.nodeId("s:2"), prop: "parent", value: { id: deckNode, at } },
      { node: doom.nodeId("s:3"), prop: "type", value: "slide" },
      { node: doom.nodeId("s:3"), prop: "parent", value: { id: doom.nodeId("s:2"), at } },
      { node: slide, prop: "type", value: "slide" },
      { node: slide, prop: "parent", value: { id: doom.nodeId("s:2"), at: doom.orderKeyBetween(at, null) } },
      { node: component, prop: "type", value: "component" },
      { node: component, prop: "parent", value: { id: deckNode, at } },
      { node: component, prop: "name", value: "Tile" },
      { node: component, prop: "spec", value: spec(100) },
      { node: component, prop: "revision", value: 1 },
    ],
  })
  let offline = false
  const remote: DoomRemote = {
    ...shared,
    edit: async (body) => {
      if (offline) throw new TypeError("offline")
      return shared.edit(body)
    },
  }
  const opened = await createDoomDeck(remote, "templates", { client: "first" })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  const { deck } = opened
  const box = { x: 10, y: 10, w: 300, h: 100, rotation: 0, flipH: false, flipV: false }
  const writes = doom.placeComponent(
    deck.view(),
    { node: component, revision: 1 },
    { frame, parent: { id: slide, at }, box, data: {}, measure },
  )
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  expect(deck.push(writes, { read: deck.view() }).ok).toBe(true)
  expect(deck.push([{ node: slide, prop: "parent", value: null }]).ok).toBe(true)
  await deck.sync()
  const tile = doom.propOf(deck.server().nodes.get(frame), "instance")!.parts[0]!.node
  return {
    deck,
    shared,
    tile,
    offline: (value: boolean) => {
      offline = value
    },
  }
}

async function elsewhere(shared: DoomRemote, fold: doom.Doom, writes: readonly doom.Write[]) {
  const landed = await shared.edit({
    deck: "templates",
    edit: { once: crypto.randomUUID(), author: other, phase: "start", readBase: fold.rev, writes },
  })
  expect(landed).toMatchObject({ ok: true })
}

async function updateElsewhere(shared: DoomRemote, fold: doom.Doom) {
  const base = (prop: "spec" | "revision") => fold.revs.get(component)!.get(prop)!
  const writes = doom.prepareComponentEdit(
    fold,
    [
      { node: component, prop: "spec", value: spec(200), base: base("spec") },
      { node: component, prop: "revision", value: 2, base: base("revision") },
    ],
    measure,
  )
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  await elsewhere(shared, fold, writes)
}

it("brings a slide back with its instance rebuilt when another tab updated the template first", async () => {
  const { deck, shared, tile } = await onSlideTwo()
  await updateElsewhere(shared, deck.server())
  await deck.catchUp()
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  const back = deck.server()
  expect(doom.onDeck(back.nodes, frame)).toBe(true)
  expect(doom.propOf(back.nodes.get(frame), "instance")?.component).toEqual({ node: component, revision: 2 })
  expect(doom.propOf(back.nodes.get(tile), "box")?.w).toBe(200)
  expect(deck.redo()).toMatchObject({ ok: true })
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  const again = deck.server()
  expect(doom.onDeck(again.nodes, frame)).toBe(true)
  expect(doom.propOf(again.nodes.get(frame), "instance")?.component).toEqual({ node: component, revision: 2 })
  expect(doom.propOf(again.nodes.get(tile), "box")?.w).toBe(200)
  expect(deck.notices()).toEqual([])
})

it("rebuilds a slide undo queued offline when the template was updated before it was sent", async () => {
  const { deck, shared, tile, offline } = await onSlideTwo()
  offline(true)
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  await updateElsewhere(shared, deck.server())
  offline(false)
  await deck.sync()
  const back = deck.server()
  expect(doom.onDeck(back.nodes, frame)).toBe(true)
  expect(doom.propOf(back.nodes.get(frame), "instance")?.component).toEqual({ node: component, revision: 2 })
  expect(doom.propOf(back.nodes.get(tile), "box")?.w).toBe(200)
  expect(deck.view()).toEqual(back)
  expect(deck.notices()).toEqual([])
})

it("brings a slide back detached when the template was deleted before the queued undo was sent", async () => {
  const { deck, shared, tile, offline } = await onSlideTwo()
  offline(true)
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  await elsewhere(shared, deck.server(), [{ node: component, prop: "parent", value: null }])
  offline(false)
  await deck.sync()
  const back = deck.server()
  expect(doom.onDeck(back.nodes, frame)).toBe(true)
  expect(doom.propOf(back.nodes.get(frame), "instance")).toBeUndefined()
  expect(doom.onDeck(back.nodes, tile)).toBe(true)
  expect(deck.view()).toEqual(back)
  expect(deck.notices()).toEqual([])
})
