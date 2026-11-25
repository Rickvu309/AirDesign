import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, expect, it } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { deleteDatabase } from "./device.js"
import { openDoomDeck } from "./doom-deck.js"
import { memoryStorage } from "./doom-storage.js"
import {
  again,
  component,
  elsewhere,
  frame,
  later,
  measure,
  onSlideTwo,
  other,
  placedElsewhere,
  placing,
  requiringRows,
  spec,
  templateUpdate,
  tiled,
  updateElsewhere,
  person,
} from "./testing/template-deck.js"

beforeEach(installIndexedDb)
afterEach(deleteDatabase)

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

function expectTiles(fold: doom.Doom, revision: number, width: number) {
  expect(doom.propOf(fold.nodes.get(component), "revision")).toBe(revision)
  for (const root of [frame, later]) {
    const instance = doom.propOf(fold.nodes.get(root), "instance")
    expect(instance?.component).toEqual({ node: component, revision })
    expect(doom.propOf(fold.nodes.get(instance!.parts[0]!.node), "box")?.w).toBe(width)
  }
}

it("undoes and redoes a template update after another tab placed an instance of it", async () => {
  const { deck, shared } = await tiled()
  expect(deck.push(templateUpdate(deck.view(), spec(200), 2), { read: deck.view() }).ok).toBe(true)
  await deck.sync()
  await placedElsewhere(shared, deck.server(), placing(deck.server(), 2))
  await deck.catchUp()
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  expectTiles(deck.server(), 3, 100)
  expect(doom.propOf(deck.server().nodes.get(component), "spec")).toEqual(spec(100))
  expect(deck.view()).toEqual(deck.server())
  expect(deck.redo()).toMatchObject({ ok: true })
  await deck.sync()
  expectTiles(deck.server(), 4, 200)
  expect(deck.view()).toEqual(deck.server())
  expect(deck.notices()).toEqual([])
})

it("prepares a template undo queued offline again when another tab placed an instance before it was sent", async () => {
  const { deck, shared, offline } = await tiled()
  expect(deck.push(templateUpdate(deck.view(), spec(200), 2), { read: deck.view() }).ok).toBe(true)
  await deck.sync()
  offline(true)
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  await placedElsewhere(shared, deck.server(), placing(deck.server(), 2))
  offline(false)
  await deck.sync()
  expectTiles(deck.server(), 3, 100)
  expect(deck.view()).toEqual(deck.server())
  expect(deck.notices()).toEqual([])
})

it("undoes an agent's template update by run after a person placed an instance of it", async () => {
  const { deck, shared } = await tiled()
  await updateElsewhere(shared, deck.server())
  await deck.catchUp()
  await placedElsewhere(shared, deck.server(), placing(deck.server(), 2))
  await deck.catchUp()
  expect(await deck.undoRun("template")).toMatchObject({ ok: true, kept: [], left: [], waiting: [] })
  await deck.sync()
  expectTiles(deck.server(), 3, 100)
  expect(deck.view()).toEqual(deck.server())
})

it("keeps two tabs identical when one undoes a template update the other placed an instance of", async () => {
  const { deck, shared } = await tiled()
  const second = await openDoomDeck(shared, "templates", { client: "second", storage: memoryStorage() })
  if (!second.ok) throw new Error(JSON.stringify(second))
  const tab = second.deck
  expect(deck.push(templateUpdate(deck.view(), spec(200), 2), { read: deck.view() }).ok).toBe(true)
  await deck.sync()
  await tab.catchUp()
  expect(tab.push(placing(tab.view(), 2), { read: tab.view() }).ok).toBe(true)
  await tab.sync()
  await deck.catchUp()
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  await tab.catchUp()
  expectTiles(deck.server(), 3, 100)
  expect(deck.view()).toEqual(deck.server())
  expect(tab.view()).toEqual(deck.server())
  expect(tab.undo()).toMatchObject({ ok: true })
  await tab.sync()
  await deck.catchUp()
  expect(doom.onDeck(deck.server().nodes, later)).toBe(false)
  expect(tab.view()).toEqual(deck.server())
  expect(deck.view()).toEqual(deck.server())
  expect([...deck.notices(), ...tab.notices()]).toEqual([])
})

it("undoes a template update and detaches only the instance placed since that the old spec cannot build", async () => {
  const { deck, shared, tile } = await onSlideTwo()
  expect(deck.push(templateUpdate(deck.view(), requiringRows, 2), { read: deck.view() }).ok).toBe(true)
  await deck.sync()
  const writes = placing(deck.server(), 2, { rows: [{ id: "a", note: "later" }] }, doom.nodeId("s:3"))
  await placedElsewhere(shared, deck.server(), writes)
  await deck.catchUp()
  const placed = deck.server().nodes.get(doom.propOf(deck.server().nodes.get(later), "instance")!.parts[0]!.node)
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  expect(doom.propOf(deck.server().nodes.get(component), "revision")).toBe(3)
  expect(deck.server().nodes.get(later)).not.toHaveProperty("instance")
  expect(deck.server().nodes.get(placed!.id)).toEqual(placed)
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  const back = deck.server()
  expect(doom.propOf(back.nodes.get(frame), "instance")?.component).toEqual({ node: component, revision: 3 })
  expect(doom.propOf(back.nodes.get(tile), "box")?.w).toBe(100)
  expect(deck.view()).toEqual(back)
  expect(deck.notices()).toEqual([])
})

it("refuses a template update that skips a revision", async () => {
  const { deck, shared } = await tiled()
  const fold = deck.server()
  const base = (prop: "spec" | "revision") => fold.revs.get(component)!.get(prop)!
  const skipping: doom.Write[] = [
    { node: component, prop: "spec", value: spec(200), base: base("spec") },
    { node: component, prop: "revision", value: Number.MAX_SAFE_INTEGER, base: base("revision") },
  ]
  expect(
    await shared.edit({
      deck: "templates",
      edit: { once: "skip", author: person, readBase: fold.rev, writes: skipping },
    }),
  ).toMatchObject({ ok: false, refused: "shape", node: component, prop: "revision" })
})
