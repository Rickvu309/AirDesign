import * as doom from "@airdesign/doom"
import { expect } from "vitest"
import { createDoomDeck } from "../doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "../doom-remote.js"

export const at = doom.orderKeyBetween(null, null)
export const person: doom.Author = { kind: "person", id: "person" }
export const other: doom.Author = { kind: "agent", id: "agent", run: "template" }
export const again: doom.Author = { kind: "agent", id: "agent", run: "again" }
export const measure = doom.measureWith({})
export const deckNode = doom.nodeId("s:1")
export const slide = doom.nodeId("s:4")
export const component = doom.nodeId("c:1")
export const frame = doom.nodeId("frame:1")

export const spec = (width: number) => ({
  version: 1,
  name: "Tile",
  collections: {},
  parts: [{ emit: { kind: "rect", key: ["list", "tile"], x: 0, y: 0, w: width, h: 100, fill: { var: "accent1" } } }],
  sample: { w: 300, h: 100, data: {} },
})

export async function tiled() {
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
  await deck.sync()
  return {
    deck,
    shared,
    tile: doom.propOf(deck.server().nodes.get(frame), "instance")!.parts[0]!.node,
    offline: (value: boolean) => {
      offline = value
    },
  }
}

export async function onSlideTwo(beforeDelete?: (shared: DoomRemote, fold: doom.Doom) => Promise<void>) {
  const { deck, shared, tile, offline } = await tiled()
  if (beforeDelete !== undefined) {
    await deck.sync()
    await beforeDelete(shared, deck.server())
    await deck.catchUp()
  }
  expect(deck.push([{ node: slide, prop: "parent", value: null }]).ok).toBe(true)
  await deck.sync()
  return { deck, shared, tile, offline }
}

export async function elsewhere(
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
  expect(landed, JSON.stringify(landed)).toMatchObject({ ok: true })
}

export async function updateElsewhere(
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

export const requiringRows = {
  ...spec(200),
  collections: { rows: { note: "string" } },
  sample: { w: 300, h: 100, data: { rows: [{ id: "a", note: "sample" }] } },
}

export const later = doom.nodeId("frame:2")

export async function placedElsewhere(shared: DoomRemote, fold: doom.Doom, writes: readonly doom.Write[]) {
  const landed = await shared.edit({
    deck: "templates",
    edit: { once: crypto.randomUUID(), author: person, readBase: fold.rev, writes },
  })
  expect(landed).toMatchObject({ ok: true })
}

export function templateUpdate(fold: doom.Doom, value: unknown, revision: number): readonly doom.Write[] {
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
  return writes
}

export function placing(fold: doom.Doom, revision: number, data: object = {}, parent = slide): readonly doom.Write[] {
  const box = { x: 10, y: 200, w: 300, h: 100, rotation: 0, flipH: false, flipV: false }
  const writes = doom.placeComponent(
    fold,
    { node: component, revision },
    { frame: later, parent: { id: parent, at }, box, data, measure },
  )
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  return writes
}
