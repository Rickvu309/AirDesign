import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, expect, it } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { deleteDatabase } from "./device.js"
import { openDoomDeck } from "./doom-deck.js"
import { type DoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

import {
  agent,
  agentUpdate,
  barFor,
  data,
  frame,
  instance,
  measure,
  person,
  placed,
  slide,
  two,
} from "./testing/doom-component-fixtures.js"

beforeEach(installIndexedDb)
afterEach(deleteDatabase)

it("rebuilds queued regeneration after reopening and losing its base, preserving the other tab's fill", async () => {
  const { bar, deck, remote, offline, shared, sent } = await placed()
  offline(true)
  expect(deck.regenerate(frame, { data: data(5) }).ok).toBe(true)
  await deck.sync()
  const fills = [{ kind: "solid", color: { var: "accent2" } }]
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: {
        author: person,
        once: "recolor",
        writes: [{ node: bar, prop: "fills", value: fills, base: deck.server().rev }],
      },
    }),
  ).toMatchObject({ ok: true })
  offline(false)
  const reopened = await openDoomDeck(remote, deck.deck)
  if (!reopened.ok) throw new Error(JSON.stringify(reopened))
  expect(await reopened.deck.sync()).toEqual({ ok: true })
  expect(reopened.deck.pending()).toEqual([])
  expect(reopened.deck.notices()).toEqual([])
  expect(reopened.deck.server().nodes.get(frame)).toMatchObject({ instance: { data: data(5) } })
  expect(reopened.deck.server().nodes.get(bar)).toMatchObject({ fills })
  expect(sent.map(({ readBase }) => readBase)).toEqual([1, 2, 3])
})

it("sets aside the regeneration quietly when the other tab deleted the instance", async () => {
  const { deck, shared, offline } = await placed()
  offline(true)
  expect(deck.regenerate(frame, { data: data(5) }).ok).toBe(true)
  await deck.sync()
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: {
        author: person,
        once: "delete",
        writes: [{ node: frame, prop: "parent", value: null }],
      },
    }),
  ).toMatchObject({ ok: true })
  offline(false)
  expect(await deck.sync()).toEqual({ ok: true })
  expect(deck.pending()).toEqual([])
  expect(deck.notices()).toEqual([])
  expect(deck.view().nodes.get(frame)).toMatchObject({ parent: null })
})

const deckNode = doom.nodeId("s:1")
const fills = [{ kind: "solid", color: { var: "accent4" } }]
function other(remote: DoomRemote, deck: string, writes: readonly doom.Write[]) {
  return remote.edit({ deck, edit: { once: "other", author: { kind: "person", id: "other" }, writes } })
}

it("replays a recolor of a bar created by a stale update and keeps its undo order", async () => {
  const { deck, shared, offline } = await placed()
  offline(true)
  expect(deck.regenerate(frame, { data: two }).ok).toBe(true)
  const bar = barFor(deck.view(), "b")
  expect(deck.push([{ node: bar, prop: "fills", value: fills }]).ok).toBe(true)
  await deck.sync()
  expect(await other(shared, deck.deck, [{ node: deckNode, prop: "name", value: "Theirs" }])).toMatchObject({
    ok: true,
  })
  offline(false)
  expect(await deck.sync()).toEqual({ ok: true })
  expect(deck.notices()).toEqual([])
  expect(barFor(deck.server(), "b")).toBe(bar)
  expect(deck.server().nodes.get(bar)).toMatchObject({ fills })
  expect(deck.undo().ok).toBe(true)
  expect(deck.view().nodes.get(bar)).not.toMatchObject({ fills })
  expect(deck.undo().ok).toBe(true)
  expect(doom.propOf(deck.view().nodes.get(frame), "instance")?.data).toEqual(data(1))
})

it("keeps redo across a quiet rebuild", async () => {
  const { deck, shared, offline } = await placed()
  offline(true)
  expect(deck.regenerate(frame, { data: data(5) }).ok).toBe(true)
  expect(deck.push([{ node: deckNode, prop: "name", value: "Mine" }]).ok).toBe(true)
  expect(deck.undo().ok).toBe(true)
  await deck.sync()
  expect(await other(shared, deck.deck, [{ node: slide, prop: "name", value: "Theirs" }])).toMatchObject({ ok: true })
  offline(false)
  expect(await deck.sync()).toEqual({ ok: true })
  expect(deck.redo().ok).toBe(true)
  expect(await deck.sync()).toEqual({ ok: true })
  expect(doom.deckName(deck.server())).toBe("Mine")
  expect(deck.notices()).toEqual([])
})

it("undoes an update queued before an unrelated tab edit", async () => {
  const { deck, shared, offline } = await placed()
  expect(deck.regenerate(frame, { data: data(5) }).ok).toBe(true)
  await deck.sync()
  offline(true)
  expect(deck.undo().ok).toBe(true)
  await deck.sync()
  expect(await other(shared, deck.deck, [{ node: slide, prop: "name", value: "Theirs" }])).toMatchObject({ ok: true })
  offline(false)
  expect(await deck.sync()).toEqual({ ok: true })
  expect(doom.propOf(deck.server().nodes.get(frame), "instance")?.data).toEqual(data(1))
  expect(deck.server().nodes.get(slide)).toMatchObject({ name: "Theirs" })
  expect(deck.notices()).toEqual([])
})

it.each([true, false])("plain delete wins quietly with update first = %s", async (updateFirst) => {
  const { deck, bar, shared, offline } = await placed()
  const opened = await openDoomDeck(shared, deck.deck, { storage: memoryStorage() })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  const second = opened.deck
  offline(!updateFirst)
  expect(deck.regenerate(frame, { data: data(9) }).ok).toBe(true)
  await deck.sync()
  expect(second.push([{ node: bar, prop: "parent", value: null }]).ok).toBe(true)
  expect(await second.sync()).toEqual({ ok: true })
  offline(false)
  expect(await deck.sync()).toEqual({ ok: true })
  await deck.catchUp()
  await second.catchUp()
  expect(deck.notices()).toEqual([])
  expect(second.notices()).toEqual([])
  expect(doom.propOf(deck.server().nodes.get(frame), "instance")).toMatchObject({
    data: data(9),
    suppressed: [{ key: ["bar", "a"], reason: "delete" }],
  })
  expect(doom.parentOf(deck.server().nodes.get(bar))).toBeNull()
  expect(second.undo().ok).toBe(true)
  expect(await second.sync()).toEqual({ ok: true })
  expect(doom.propOf(second.server().nodes.get(frame), "instance")).toMatchObject({ data: data(9), suppressed: [] })
  expect(barFor(second.server(), "a")).toBe(bar)
})

it.each([true, false])("detach wins quietly with update first = %s", async (updateFirst) => {
  const { deck, shared, offline } = await placed()
  const opened = await openDoomDeck(shared, deck.deck, { storage: memoryStorage() })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  const second = opened.deck
  offline(!updateFirst)
  expect(deck.regenerate(frame, { data: data(9) }).ok).toBe(true)
  await deck.sync()
  const read = second.view()
  const detach = doom.detachComponent(read, frame)
  if (doom.isRefusal(detach)) throw new Error(JSON.stringify(detach))
  expect(second.push(detach, { read }).ok).toBe(true)
  expect(await second.sync()).toEqual({ ok: true })
  offline(false)
  expect(await deck.sync()).toEqual({ ok: true })
  await deck.catchUp()
  expect(deck.notices()).toEqual([])
  expect(second.notices()).toEqual([])
  expect(doom.propOf(deck.server().nodes.get(frame), "instance")).toBeUndefined()
})

it.each(["person", "agent"])("undoes a %s update across another tab's suppression and keeps it on redo", async (by) => {
  const { deck, shared, bar } = await placed()
  if (by === "agent") await agentUpdate(deck.deck, shared, deck.server(), "update")
  else expect(deck.regenerate(frame, { data: two }).ok).toBe(true)
  await deck.sync()
  expect(await other(shared, deck.deck, [{ node: bar, prop: "parent", value: null }])).toMatchObject({ ok: true })
  await deck.catchUp()
  expect(by === "agent" ? await deck.undoRun("update") : deck.undo()).toMatchObject({ ok: true })
  await deck.sync()
  const suppressed = [{ key: ["bar", "a"], reason: "delete" }]
  expect(instance(deck.server())).toMatchObject({ data: data(1), suppressed })
  expect(deck.redo().ok).toBe(true)
  await deck.sync()
  expect(instance(deck.server())).toMatchObject({ data: two, suppressed })
  expect(deck.notices()).toEqual([])
})

it("undoes a suppression run followed by an update run in succession", async () => {
  const { deck, shared, bar } = await placed()
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: {
        author: agent("delete"),
        once: "delete",
        phase: "start",
        writes: [{ node: bar, prop: "parent", value: null }],
      },
    }),
  ).toMatchObject({ ok: true })
  await deck.catchUp()
  await agentUpdate(deck.deck, shared, deck.server(), "update")
  expect(await deck.undoRun("delete")).toMatchObject({ ok: true })
  await deck.sync()
  expect(await deck.undoRun("update")).toMatchObject({ ok: true })
  await deck.sync()
  expect(instance(deck.server())).toMatchObject({ data: data(1), suppressed: [] })
  expect(barFor(deck.server(), "a")).toBe(bar)
  expect([...deck.server().runs.values()].map(({ undone }) => undone)).toEqual([true, true])
})

it("rebuilds an in-flight run undo and keeps its redo", async () => {
  const { deck, shared, intercept } = await placed()
  await agentUpdate(deck.deck, shared, deck.server(), "update")
  let held = false
  intercept(async () => {
    if (held) return
    held = true
    expect(await other(shared, deck.deck, [{ node: slide, prop: "name", value: "Theirs" }])).toMatchObject({ ok: true })
  })
  expect(await deck.undoRun("update")).toMatchObject({ ok: true })
  await deck.sync()
  expect(instance(deck.server())?.data).toEqual(data(1))
  expect(deck.server().runs.get("update")?.undone).toBe(true)
  expect(deck.notices()).toEqual([])
  expect(deck.redo().ok).toBe(true)
  await deck.sync()
  expect(instance(deck.server())?.data).toEqual(two)
  expect(deck.server().runs.get("update")?.undone).toBe(false)
})

it("undoes the update's other inputs when a later writer owns data", async () => {
  const { deck, shared } = await placed()
  expect(deck.regenerate(frame, { data: two, tokens: { accent: { var: "accent3" } } }).ok).toBe(true)
  await deck.sync()
  const fold = deck.server()
  const later = doom.regenerateComponent(fold, frame, { data: data(8) }, measure)
  if (doom.isRefusal(later)) throw new Error(JSON.stringify(later))
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: { once: "data", author: person, readBase: fold.rev, writes: later.writes },
    }),
  ).toMatchObject({ ok: true })
  await deck.catchUp()
  expect(deck.undo().ok).toBe(true)
  await deck.sync()
  expect(instance(deck.server())).toMatchObject({ data: data(8), tokens: {} })
  expect(deck.redo().ok).toBe(true)
  await deck.sync()
  expect(instance(deck.server())).toMatchObject({ data: data(8), tokens: { accent: { var: "accent3" } } })
})

it("reopens a queued run undo and rebuilds it from the run log", async () => {
  const { deck, shared, remote, offline, bar } = await placed()
  await agentUpdate(deck.deck, shared, deck.server(), "update")
  offline(true)
  const turn = await deck.undoRun("update")
  if (!turn.ok) throw new Error(JSON.stringify(turn))
  await turn.saved
  expect(await deck.sync()).toMatchObject({ ok: false, reason: "offline" })
  expect(await other(shared, deck.deck, [{ node: bar, prop: "parent", value: null }])).toMatchObject({ ok: true })
  offline(false)
  const reopened = await openDoomDeck(remote, deck.deck)
  if (!reopened.ok) throw new Error(JSON.stringify(reopened))
  expect(await reopened.deck.sync()).toEqual({ ok: true })
  expect(instance(reopened.deck.server())).toMatchObject({ data: data(1), suppressed: [{ key: ["bar", "a"] }] })
  expect(reopened.deck.server().runs.get("update")?.undone).toBe(true)
  expect(reopened.deck.notices()).toEqual([])
})

it("undoes and redoes a suppression through a row exit and re-entry", async () => {
  const { deck, bar } = await placed()
  expect(deck.push([{ node: bar, prop: "parent", value: null }]).ok).toBe(true)
  expect(deck.regenerate(frame, { data: { rows: [] } }).ok).toBe(true)
  expect(deck.regenerate(frame, { data: data(1) }).ok).toBe(true)
  await deck.sync()
  const states = [
    { data: { rows: [] }, suppressed: [] },
    { data: data(1), suppressed: [{ key: ["bar", "a"] }] },
    { data: data(1), suppressed: [] },
    { data: data(1), suppressed: [{ key: ["bar", "a"] }] },
    { data: { rows: [] }, suppressed: [] },
    { data: data(1), suppressed: [] },
  ]
  for (const [index, expected] of states.entries()) {
    expect((index < 3 ? deck.undo() : deck.redo()).ok).toBe(true)
    await deck.sync()
    expect(instance(deck.server())).toMatchObject(expected)
  }
  expect(deck.notices()).toEqual([])
})

it.each(["undo data", "redo data", "undo deletion"])("rebuilds %s after reloading an offline device", async (kind) => {
  const { deck, shared, remote, offline, bar } = await placed()
  expect(deck.regenerate(frame, { data: two }).ok).toBe(true)
  await deck.sync()
  const beta = barFor(deck.view(), "b")
  if (kind === "undo deletion") {
    expect(deck.push([{ node: beta, prop: "parent", value: null }]).ok).toBe(true)
    await deck.sync()
  }
  if (kind === "redo data") {
    expect(deck.undo().ok).toBe(true)
    await deck.sync()
  }
  offline(true)
  const turned = kind === "redo data" ? deck.redo() : deck.undo()
  if (!turned.ok) throw new Error(JSON.stringify(turned))
  await turned.saved
  const reopened = await openDoomDeck(remote, deck.deck)
  if (!reopened.ok) throw new Error(JSON.stringify(reopened))
  expect(reopened.deck.pending()).toHaveLength(1)
  expect(await other(shared, deck.deck, [{ node: bar, prop: "parent", value: null }])).toMatchObject({ ok: true })
  offline(false)
  expect(await reopened.deck.sync()).toEqual({ ok: true })
  const saved = reopened.deck.server()
  expect(instance(saved)).toMatchObject({
    data: kind === "undo data" ? data(1) : two,
    suppressed: [{ key: ["bar", "a"], reason: "delete" }],
  })
  expect(doom.onDeck(saved.nodes, beta)).toBe(kind !== "undo data")
  expect(reopened.deck.notices()).toEqual([])
})

it("redoes an agent's data update and recolour together", async () => {
  const { deck, bar, shared } = await placed()
  const run = "update"
  await agentUpdate(deck.deck, shared, deck.server(), run)
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: { author: agent(run), once: "recolour", writes: [{ node: bar, prop: "fills", value: fills }] },
    }),
  ).toMatchObject({ ok: true })
  expect(await deck.undoRun(run)).toMatchObject({ ok: true })
  await deck.sync()
  expect(deck.server().nodes.get(bar)).not.toMatchObject({ fills })
  expect(deck.redo().ok).toBe(true)
  await deck.sync()
  expect(instance(deck.server())?.data).toEqual(two)
  expect(deck.server().nodes.get(bar)).toMatchObject({ fills })
})

it.each(["person", "agent"])("undoes a %s row removal with the row's overrides", async (actor) => {
  const { deck, bar, shared } = await placed()
  const link = "https://example.com"
  const writes = [
    { node: bar, prop: "fills", value: fills },
    { node: bar, prop: "name", value: "Custom bar" },
    { node: bar, prop: "link", value: link },
  ] satisfies readonly doom.Write[]
  expect(deck.push(writes).ok).toBe(true)
  await deck.sync()
  const data = { rows: [] }
  if (actor === "person") {
    expect(deck.regenerate(frame, { data }).ok).toBe(true)
  } else {
    const fold = deck.server()
    const update = doom.regenerateComponent(fold, frame, { data }, measure)
    if (doom.isRefusal(update)) throw new Error(JSON.stringify(update))
    expect(
      await shared.edit({
        deck: deck.deck,
        edit: { author: agent("remove"), once: "remove", writes: update.writes, readBase: fold.rev, phase: "start" },
      }),
    ).toMatchObject({ ok: true })
  }
  await deck.sync()
  expect(actor === "person" ? deck.undo() : await deck.undoRun("remove")).toMatchObject({ ok: true })
  await deck.sync()
  expect(barFor(deck.server(), "a")).toBe(bar)
  expect(deck.server().nodes.get(bar)).toMatchObject({ fills, name: "Custom bar", link })
})
