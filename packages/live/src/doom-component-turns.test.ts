import * as doom from "@airdesign/doom"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { openDoomDeck } from "./doom-deck.js"
import { deleteDatabase } from "./device.js"
import {
  agent,
  agentUpdate,
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

it("undoes and redoes a chart placement through the deck", async () => {
  const { deck, bar } = await placed()
  const chart = instance(deck.server())
  expect(deck.undo()).toMatchObject({ ok: true })
  expect(await deck.sync()).toEqual({ ok: true })
  expect(doom.onDeck(deck.server().nodes, frame)).toBe(false)
  expect(doom.onDeck(deck.server().nodes, bar)).toBe(false)
  expect(deck.redo()).toMatchObject({ ok: true })
  expect(await deck.sync()).toEqual({ ok: true })
  expect(doom.onDeck(deck.server().nodes, bar)).toBe(true)
  expect(instance(deck.server())).toEqual(chart)
})

it.each(["online", "offline", "offline after reload"])(
  "undoes chart placement after another writer restyles a bar (%s)",
  async (mode) => {
    const { deck, shared, remote, bar, offline } = await placed()
    const fills = [{ kind: "solid", color: { var: "accent2" } }]
    if (mode !== "online") {
      offline(true)
      const undone = deck.undo()
      if (!undone.ok) throw new Error(JSON.stringify(undone))
      await undone.saved
      expect(doom.onDeck(deck.view().nodes, frame)).toBe(false)
      expect(await deck.sync()).toMatchObject({ ok: false, reason: "offline" })
    }
    expect(
      await shared.edit({
        deck: deck.deck,
        edit: { once: "other-color", author: person, writes: [{ node: bar, prop: "fills", value: fills }] },
      }),
    ).toMatchObject({ ok: true })
    if (mode === "online") {
      await deck.catchUp()
      expect(deck.undo()).toMatchObject({ ok: true })
    }
    let reopened = deck
    if (mode === "offline after reload") {
      const opened = await openDoomDeck(remote, deck.deck)
      if (!opened.ok) throw new Error(JSON.stringify(opened))
      reopened = opened.deck
    }
    offline(false)
    expect(await reopened.sync()).toEqual({ ok: true })
    expect(doom.onDeck(reopened.server().nodes, frame)).toBe(false)
    expect(doom.onDeck(reopened.server().nodes, bar)).toBe(false)
    expect(reopened.notices()).toEqual([])
    expect(reopened.status()).toEqual({ kind: "saved" })
    if (mode !== "offline after reload") {
      expect(reopened.redo()).toMatchObject({ ok: true })
      expect(await reopened.sync()).toEqual({ ok: true })
      expect(doom.onDeck(reopened.server().nodes, bar)).toBe(true)
      expect(doom.propOf(reopened.server().nodes.get(bar), "fills")).toEqual(fills)
    }
  },
)

it.each(["online", "offline"])("removes a placement after another writer adds chart rows (%s)", async (mode) => {
  const { deck, shared, offline } = await placed()
  if (mode === "offline") {
    offline(true)
    expect(deck.undo()).toMatchObject({ ok: true })
    expect(await deck.sync()).toMatchObject({ ok: false, reason: "offline" })
  }
  const next = doom.regenerateComponent(deck.server(), frame, { data: two }, measure)
  if (doom.isRefusal(next)) throw new Error(JSON.stringify(next))
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: { once: "other-data", author: person, readBase: deck.server().rev, writes: next.writes },
    }),
  ).toMatchObject({ ok: true })
  const added = next.writes.find(({ prop }) => prop === "type")?.node
  if (added === undefined) throw new Error("Missing new part")
  if (mode === "online") {
    await deck.catchUp()
    expect(instance(deck.view())?.data).toEqual(two)
    expect(deck.undo()).toMatchObject({ ok: true })
  }
  offline(false)
  expect(await deck.sync()).toEqual({ ok: true })
  expect(doom.onDeck(deck.server().nodes, frame)).toBe(false)
  expect(doom.onDeck(deck.server().nodes, added)).toBe(false)
  expect(deck.redo()).toMatchObject({ ok: true })
  expect(await deck.sync()).toEqual({ ok: true })
  expect(instance(deck.server())?.data).toEqual(two)
  expect(doom.onDeck(deck.server().nodes, added)).toBe(true)
})

it("reports a refused chart undo without changing the saved status", async () => {
  const { deck, shared, bar } = await placed()
  expect(deck.push([{ node: bar, prop: "parent", value: null }]).ok).toBe(true)
  await deck.sync()
  const before = deck.server()
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: {
        once: "remove-box",
        author: person,
        readBase: before.rev,
        writes: [
          { node: frame, prop: "instance", value: instance(before) },
          { node: frame, prop: "box", value: null },
        ],
      },
    }),
  ).toMatchObject({ ok: true })
  await deck.catchUp()
  expect(deck.undo()).toMatchObject({ ok: false, reason: "refused" })
  expect(deck.status()).toEqual({ kind: "turn-refused", turn: "undo", save: { kind: "saved" } })
  expect(doom.onDeck(deck.view().nodes, bar)).toBe(false)
})

it("applies a queued chart turn once regardless of the length of the offline queue", async () => {
  const { deck, offline } = await placed()
  expect(deck.regenerate(frame, { data: data(5) }).ok).toBe(true)
  await deck.sync()
  offline(true)
  const applied = vi.spyOn(doom, "applyEdit")
  try {
    for (let turn = 0; turn < 24; turn += 1) {
      applied.mockClear()
      expect(turn % 2 === 0 ? deck.undo() : deck.redo()).toMatchObject({ ok: true })
      expect(instance(deck.view())?.data).toEqual(data(turn % 2 === 0 ? 1 : 5))
      expect(applied).toHaveBeenCalledTimes(1)
    }
  } finally {
    applied.mockRestore()
  }
})

it("takes back an agent's update and its new chart, then redoes both", async () => {
  const { deck, shared } = await placed()
  const run = "place-and-update"
  await agentUpdate(deck.deck, shared, deck.server(), run)
  await deck.catchUp()
  const newFrame = doom.nodeId("frame:2")
  const place = doom.placeComponent(deck.server(), doom.columnDefinition, {
    frame: newFrame,
    parent: { id: slide, at: doom.orderKeyBetween(null, null) },
    box: { x: 500, y: 400, w: 1200, h: 600, rotation: 0, flipH: false, flipV: false },
    measure,
    data: data(8),
  })
  if (doom.isRefusal(place)) throw new Error(JSON.stringify(place))
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: { once: "place-with-agent", author: agent(run), writes: place, readBase: deck.server().rev },
    }),
  ).toMatchObject({ ok: true })
  await deck.catchUp()
  const changed = doom.regenerateComponent(deck.server(), newFrame, { data: two }, measure)
  if (doom.isRefusal(changed)) throw new Error(JSON.stringify(changed))
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: { once: "update-new", author: agent(run), writes: changed.writes, readBase: deck.server().rev },
    }),
  ).toMatchObject({ ok: true })
  await deck.catchUp()

  expect(await deck.undoRun(run)).toMatchObject({ ok: true })
  expect(await deck.sync()).toEqual({ ok: true })
  expect(instance(deck.server())?.data).toEqual(data(1))
  expect(doom.onDeck(deck.server().nodes, newFrame)).toBe(false)
  expect(deck.redo()).toMatchObject({ ok: true })
  expect(await deck.sync()).toEqual({ ok: true })
  expect(instance(deck.server())?.data).toEqual(two)
  expect(doom.propOf(deck.server().nodes.get(newFrame), "instance")?.data).toEqual(two)
})

it.each(["online", "offline after reload"])(
  "undoes the chart restored by redoing a run after another tab deletes a bar (%s)",
  async (mode) => {
    const { deck, shared, remote, offline } = await placed()
    const run = "place-for-redo"
    const root = doom.nodeId("frame:2")
    const before = deck.server()
    const writes = doom.placeComponent(before, doom.columnDefinition, {
      frame: root,
      parent: { id: slide, at: doom.orderKeyBetween(null, null) },
      box: { x: 500, y: 400, w: 1200, h: 600, rotation: 0, flipH: false, flipV: false },
      measure,
      data: two,
    })
    if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
    expect(
      await shared.edit({
        deck: deck.deck,
        edit: { once: run, phase: "start", author: agent(run), writes, readBase: before.rev },
      }),
    ).toMatchObject({ ok: true })
    await deck.catchUp()
    expect(await deck.undoRun(run)).toMatchObject({ ok: true })
    await deck.sync()
    expect(doom.onDeck(deck.server().nodes, root)).toBe(false)
    expect(deck.redo()).toMatchObject({ ok: true })
    await deck.sync()
    expect(doom.onDeck(deck.server().nodes, root)).toBe(true)
    const chart = doom.propOf(deck.server().nodes.get(root), "instance")
    const bar = chart?.parts.find(({ key }) => key[0] === "bar")?.node
    if (bar === undefined) throw new Error("Missing bar")
    if (mode !== "online") {
      offline(true)
      const undo = deck.undo()
      if (!undo.ok) throw new Error(JSON.stringify(undo))
      await undo.saved
      expect(doom.onDeck(deck.view().nodes, root)).toBe(false)
    }
    expect(
      await shared.edit({
        deck: deck.deck,
        edit: { once: "other-delete", author: person, writes: [{ node: bar, prop: "parent", value: null }] },
      }),
    ).toMatchObject({ ok: true })
    if (mode === "online") {
      await deck.catchUp()
      expect(deck.undo()).toMatchObject({ ok: true })
      await deck.sync()
      expect(doom.onDeck(deck.server().nodes, root)).toBe(false)
    } else {
      const reopened = await openDoomDeck(remote, deck.deck)
      if (!reopened.ok) throw new Error(JSON.stringify(reopened))
      offline(false)
      await reopened.deck.sync()
      if (doom.onDeck(reopened.deck.server().nodes, root))
        expect(reopened.deck.notices()).toContainEqual(expect.objectContaining({ refused: "stale" }))
    }
  },
)

it.each([false, true])(
  "keeps an offline placement undone when another device adds a manual child (reload: %s)",
  async (reload) => {
    const { deck, shared, remote, offline } = await placed()
    offline(true)
    const undo = deck.undo()
    if (!undo.ok) throw new Error(JSON.stringify(undo))
    await undo.saved
    expect(doom.onDeck(deck.view().nodes, frame)).toBe(false)
    const child = doom.nodeId("manual:1")
    expect(
      await shared.edit({
        deck: deck.deck,
        edit: {
          once: "other-add",
          author: person,
          writes: [
            { node: child, prop: "type", value: "shape" },
            { node: child, prop: "parent", value: { id: frame, at: doom.orderKeyBetween(null, null) } },
          ],
        },
      }),
    ).toMatchObject({ ok: true })
    const reopened = reload ? await openDoomDeck(remote, deck.deck) : ({ ok: true, deck } as const)
    if (!reopened.ok) throw new Error(JSON.stringify(reopened))
    offline(false)
    await reopened.deck.sync()
    const saved = reopened.deck.server()
    expect(doom.onDeck(saved.nodes, frame)).toBe(false)
    expect(doom.onDeck(saved.nodes, child)).toBe(false)
    expect(doom.parentOf(saved.nodes.get(child))?.id).toBe(frame)
    expect(reopened.deck.notices()).toEqual([])
  },
)

it.each(["move", "delete"])("reconciles an offline placement undo after a remote %s", async (change) => {
  const { deck, shared, offline } = await placed()
  const at = doom.orderKeyBetween(doom.orderKeyBetween(null, null), null)
  offline(true)
  expect(deck.undo()).toMatchObject({ ok: true })
  expect(await deck.sync()).toMatchObject({ ok: false, reason: "offline" })
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: {
        once: "other-parent",
        author: person,
        writes: [{ node: frame, prop: "parent", value: change === "move" ? { id: slide, at } : null }],
      },
    }),
  ).toMatchObject({ ok: true })
  offline(false)
  expect(await deck.sync()).toEqual({ ok: true })
  expect(doom.onDeck(deck.server().nodes, frame)).toBe(change === "move")
  expect(deck.notices()).toEqual(change === "move" ? [expect.objectContaining({ refused: "stale", node: frame })] : [])
})

it("undoes an ordinary shape placed beside a chart after another device recolors the shape", async () => {
  const shape = doom.nodeId("shape:1")
  const at = doom.orderKeyBetween(doom.orderKeyBetween(null, null), null)
  const { deck, shared, offline } = await placed([
    { node: shape, prop: "type", value: "shape" },
    { node: shape, prop: "parent", value: { id: slide, at } },
  ])
  offline(true)
  expect(deck.undo()).toMatchObject({ ok: true })
  expect(await deck.sync()).toMatchObject({ ok: false, reason: "offline" })
  expect(
    await shared.edit({
      deck: deck.deck,
      edit: {
        once: "other-color",
        author: person,
        writes: [{ node: shape, prop: "fills", value: [{ kind: "solid", color: { var: "accent2" } }] }],
      },
    }),
  ).toMatchObject({ ok: true })
  offline(false)
  expect(await deck.sync()).toEqual({ ok: true })
  expect(doom.onDeck(deck.server().nodes, frame)).toBe(false)
  expect(doom.onDeck(deck.server().nodes, shape)).toBe(false)
})
