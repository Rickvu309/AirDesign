import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, expect, it } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { deleteDatabase } from "./device.js"
import { openDoomDeck } from "./doom-deck.js"
import type { DoomDeck } from "./doom-deck-types.js"
import type { DoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"
import {
  component,
  elsewhere,
  frame,
  measure,
  other,
  person,
  slide,
  spec,
  templateUpdate,
  tiled,
  updateElsewhere,
} from "./testing/template-deck.js"

beforeEach(installIndexedDb)
afterEach(deleteDatabase)

const deleting = [{ node: component, prop: "parent", value: null }] satisfies doom.Write[]

async function sent(shared: DoomRemote, fold: doom.Doom, author: doom.Author, writes: readonly doom.Write[]) {
  const once = crypto.randomUUID()
  const landed = await shared.edit({ deck: "templates", edit: { once, author, readBase: fold.rev, writes } })
  expect(landed, JSON.stringify(landed)).toMatchObject({ ok: true })
  return once
}

async function deletedElsewhere(shared: DoomRemote, fold: doom.Doom) {
  return { before: fold, once: await sent(shared, fold, person, deleting) }
}

async function restoredElsewhere(shared: DoomRemote, deleted: { before: doom.Doom; once: string }, now: doom.Doom) {
  const landed = { once: deleted.once, author: person, writes: deleting, rev: now.onces.get(deleted.once)! }
  const inverse = doom.invertStep(deleted.before, now, landed, new Set(), measure)
  if (doom.isRefusal(inverse)) throw new Error(JSON.stringify(inverse))
  await sent(shared, now, person, inverse)
}

async function renamedThenUpdated(deck: DoomDeck, shared: DoomRemote) {
  await elsewhere(shared, deck.server(), [{ node: slide, prop: "name", value: "Tiles" }])
  await deck.catchUp()
  await sent(shared, deck.server(), other, templateUpdate(deck.server(), spec(200), 2))
  await deck.catchUp()
}

const revisionOf = (fold: doom.Doom) => doom.propOf(fold.nodes.get(component), "revision")
const skipNotice = { refused: "missing", node: component, prop: "spec", turn: "undo" }

async function secondTab(shared: DoomRemote) {
  const opened = await openDoomDeck(shared, "templates", { client: "second", storage: memoryStorage() })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

async function expectSame(deck: DoomDeck, tab: DoomDeck) {
  await deck.sync()
  await tab.catchUp()
  expect(deck.view()).toEqual(deck.server())
  expect(tab.view()).toEqual(deck.server())
}

it.each(["online", "offline"])(
  "skips a template update whose template a peer deleted, names it, and moves on to the step below (%s)",
  async (mode) => {
    const { deck, shared, offline } = await tiled()
    const tab = await secondTab(shared)
    expect(deck.push(templateUpdate(deck.view(), spec(200), 2), { read: deck.view() }).ok).toBe(true)
    await deck.sync()
    if (mode === "offline") {
      offline(true)
      expect(deck.undo()).toMatchObject({ ok: true })
      await deck.sync()
    }
    await deck.catchUp()
    const deleted = await deletedElsewhere(shared, deck.server())
    offline(false)
    await deck.sync()
    await deck.catchUp()
    if (mode === "online") expect(deck.undo()).toEqual({ ok: false, reason: "nothing", skipped: [component] })
    expect(deck.notices()).toEqual([expect.objectContaining(skipNotice)])
    expect(deck.status()).toMatchObject({ kind: "turn-skipped", turn: "undo" })
    expect(doom.onDeck(deck.server().nodes, component)).toBe(false)
    expect(revisionOf(deck.server())).toBe(2)
    await expectSame(deck, tab)

    await restoredElsewhere(shared, deleted, deck.server())
    await deck.catchUp()
    expect(revisionOf(deck.server())).toBe(2)
    expect(doom.propOf(deck.server().nodes.get(frame), "instance")?.component).toEqual({ node: component, revision: 2 })
    expect(deck.undo()).toMatchObject({ ok: true })
    await deck.sync()
    expect(doom.onDeck(deck.server().nodes, frame)).toBe(false)
    expect(revisionOf(deck.server())).toBe(2)
    expect(doom.propOf(deck.server().nodes.get(component), "spec")).toEqual(spec(200))
    await expectSame(deck, tab)
  },
)

it.each(["online", "offline"])(
  "undoes the rest of a step whose template a peer deleted, and names the template it skipped (%s)",
  async (mode) => {
    const { deck, shared, offline } = await tiled()
    const named = [...templateUpdate(deck.view(), spec(200), 2), { node: slide, prop: "name" as const, value: "Tiles" }]
    expect(deck.push(named, { read: deck.view() }).ok).toBe(true)
    await deck.sync()
    if (mode === "offline") {
      offline(true)
      expect(deck.undo()).toMatchObject({ ok: true })
      await deck.sync()
    }
    await deck.catchUp()
    await deletedElsewhere(shared, deck.server())
    offline(false)
    await deck.sync()
    await deck.catchUp()
    if (mode === "online") expect(deck.undo()).toMatchObject({ ok: true, skipped: [component] })
    await deck.sync()
    expect(doom.propOf(deck.server().nodes.get(slide), "name")).toBeUndefined()
    expect(revisionOf(deck.server())).toBe(2)
    expect(deck.notices()).toEqual([expect.objectContaining(skipNotice)])
    expect(deck.view()).toEqual(deck.server())
  },
)

it("undoes the rest of an agent run whose template a person deleted, names the template, and consumes the run", async () => {
  const { deck, shared } = await tiled()
  await renamedThenUpdated(deck, shared)
  const deleted = await deletedElsewhere(shared, deck.server())
  await deck.catchUp()
  expect(await deck.undoRun("template")).toMatchObject({
    ok: true,
    kept: [],
    left: [],
    waiting: [],
    skipped: [component],
  })
  await deck.sync()
  expect(deck.server().runs.get("template")?.undone).toBe(true)
  expect(doom.propOf(deck.server().nodes.get(slide), "name")).toBeUndefined()

  await restoredElsewhere(shared, deleted, deck.server())
  await deck.catchUp()
  expect(await deck.undoRun("template")).toEqual({ ok: false, reason: "nothing" })
  expect(revisionOf(deck.server())).toBe(2)
  expect(doom.propOf(deck.server().nodes.get(component), "spec")).toEqual(spec(200))
  expect(deck.view()).toEqual(deck.server())
})

it("names the template of a run whose only change was an update to a template deleted since, and lands nothing", async () => {
  const { deck, shared } = await tiled()
  await updateElsewhere(shared, deck.server())
  await deck.catchUp()
  await deletedElsewhere(shared, deck.server())
  await deck.catchUp()
  const before = deck.server()
  expect(await deck.undoRun("template")).toEqual({
    ok: false,
    reason: "left",
    kept: [],
    left: [],
    waiting: [],
    skipped: [component],
  })
  await deck.sync()
  expect(deck.server()).toEqual(before)
})

it("names a template skipped when a run undo queued before a person deleted it replays", async () => {
  const { deck, shared, offline } = await tiled()
  await renamedThenUpdated(deck, shared)
  offline(true)
  expect(await deck.undoRun("template")).toMatchObject({ ok: true })
  await deck.sync()
  await deletedElsewhere(shared, deck.server())
  offline(false)
  await deck.sync()
  expect(deck.notices()).toEqual([expect.objectContaining(skipNotice)])
  expect(deck.server().runs.get("template")?.undone).toBe(true)
  expect(doom.propOf(deck.server().nodes.get(slide), "name")).toBeUndefined()
  expect(revisionOf(deck.server())).toBe(2)
  expect(deck.view()).toEqual(deck.server())
})

it("refuses a template update that changes only its revision, so no undo step is left without an inverse", async () => {
  const { deck, shared } = await tiled()
  const fold = deck.view()
  const base = (prop: "spec" | "revision") => fold.revs.get(component)!.get(prop)!
  const same = [{ node: component, prop: "spec", value: spec(100), base: base("spec") }] satisfies doom.Write[]
  const bump = [{ node: component, prop: "revision", value: 2, base: base("revision") }] satisfies doom.Write[]
  expect(doom.prepareComponentEdit(fold, [...same, ...bump], measure)).toMatchObject({
    refused: "shape",
    node: component,
    prop: "spec",
  })
  expect(deck.push(bump, { read: fold })).toMatchObject({ ok: false, refused: { refused: "shape", prop: "revision" } })
  expect(
    await shared.edit({ deck: "templates", edit: { once: "bump", author: person, readBase: fold.rev, writes: bump } }),
  ).toMatchObject({ ok: false, refused: "shape", node: component, prop: "revision" })
  expect(deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  expect(doom.onDeck(deck.server().nodes, frame)).toBe(false)
  expect(revisionOf(deck.server())).toBe(1)
})
