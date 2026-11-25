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
const again: doom.Author = { kind: "agent", id: "agent", run: "again" }
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

async function onSlideTwo(beforeDelete?: (shared: DoomRemote, fold: doom.Doom) => Promise<void>) {
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
  if (beforeDelete !== undefined) {
    await deck.sync()
    await beforeDelete(shared, deck.server())
    await deck.catchUp()
  }
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

async function elsewhere(
  shared: DoomRemote,
  fold: doom.Doom,
  writes: readonly doom.Write[],
  { once = crypto.randomUUID() as string, author = other, undoing = false } = {},
) {
  const landed = await shared.edit({
    deck: "templates",
    edit: {
      once,
      author,
      ...(undoing ? { runUndo: { run: "template", undone: true } } : { phase: "start" as const }),
      readBase: fold.rev,
      writes,
    },
  })
  expect(landed).toMatchObject({ ok: true })
}

async function updateElsewhere(
  shared: DoomRemote,
  fold: doom.Doom,
  value: unknown = spec(200),
  revision = 2,
  once?: string,
  author = other,
) {
  const base = (prop: "spec" | "revision") => fold.revs.get(component)!.get(prop)!
  const writes = doom.prepareComponentEdit(
    fold,
    [
      { node: component, prop: "spec", value, base: base("spec") },
      { node: component, prop: "revision", value: revision, base: base("revision") },
    ],
    measure,
  )
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  await elsewhere(shared, fold, writes, { author, ...(once === undefined ? {} : { once }) })
  return writes
}

const requiringRows = {
  ...spec(200),
  collections: { rows: { note: "string" } },
  sample: { w: 300, h: 100, data: { rows: [{ id: "a", note: "sample" }] } },
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

it("brings a slide back detached with its layers when another tab's template update can no longer build it", async () => {
  const { deck, shared, tile } = await onSlideTwo()
  const kept = deck.server().nodes.get(tile)
  await updateElsewhere(shared, deck.server(), requiringRows)
  await deck.catchUp()
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  const back = deck.server()
  expect(doom.onDeck(back.nodes, frame)).toBe(true)
  expect(doom.propOf(back.nodes.get(frame), "instance")).toBeUndefined()
  expect(back.nodes.get(tile)).toEqual(kept)
  expect(deck.view()).toEqual(back)
  expect(deck.notices()).toEqual([])
})

it("brings a queued slide undo back detached when the template changed so it can no longer build the instance", async () => {
  const { deck, shared, tile, offline } = await onSlideTwo()
  const kept = deck.server().nodes.get(tile)
  offline(true)
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  await updateElsewhere(shared, deck.server(), requiringRows)
  offline(false)
  await deck.sync()
  const back = deck.server()
  expect(doom.onDeck(back.nodes, frame)).toBe(true)
  expect(doom.propOf(back.nodes.get(frame), "instance")).toBeUndefined()
  expect(back.nodes.get(tile)).toEqual(kept)
  expect(deck.view()).toEqual(back)
  expect(deck.notices()).toEqual([])
})

it("rebuilds a slide undo at the current spec after the template update its layers came from was undone and replaced", async () => {
  let widened: { readonly before: doom.Doom; readonly writes: readonly doom.Write[] } | undefined
  const { deck, shared, tile } = await onSlideTwo(async (remote, fold) => {
    widened = { before: fold, writes: await updateElsewhere(remote, fold, spec(200), 2, "widen") }
  })
  expect(doom.propOf(deck.server().nodes.get(frame), "instance")?.component).toEqual({ node: component, revision: 2 })
  const gone = deck.server()
  const landed = { ...widened!, once: "widen", author: other, rev: gone.onces.get("widen")! }
  const turned = doom.invertRun(gone, [doom.undoSourceOf(widened!.before, landed)], new Set(), undefined, measure)
  await elsewhere(shared, gone, turned.writes, { undoing: true })
  await deck.catchUp()
  expect(doom.propOf(deck.server().nodes.get(component), "revision")).toBe(3)
  const undone = deck.server()
  const base = (prop: "spec" | "revision") => undone.revs.get(component)!.get(prop)!
  const reused = doom.prepareComponentEdit(
    undone,
    [
      { node: component, prop: "spec", value: spec(300), base: base("spec") },
      { node: component, prop: "revision", value: 2, base: base("revision") },
    ],
    measure,
  )
  if (doom.isRefusal(reused)) throw new Error(JSON.stringify(reused))
  const refused = await shared.edit({
    deck: "templates",
    edit: { once: "reuse", author: again, phase: "start", readBase: undone.rev, writes: reused },
  })
  expect(refused).toMatchObject({ ok: false, refused: "shape" })
  await updateElsewhere(shared, deck.server(), spec(300), 4, undefined, again)
  await deck.catchUp()
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  const back = deck.server()
  expect(doom.onDeck(back.nodes, frame)).toBe(true)
  expect(doom.propOf(back.nodes.get(frame), "instance")?.component).toEqual({ node: component, revision: 4 })
  expect(doom.propOf(back.nodes.get(tile), "box")?.w).toBe(300)
  expect(deck.view()).toEqual(back)
  expect(deck.notices()).toEqual([])
})
