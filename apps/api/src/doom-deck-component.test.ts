import { randomBytes } from "node:crypto"
import { doomRoutes, readDeckId, type DeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { beforeAll, expect, it } from "vitest"

import { startIds } from "./doom/doom-start.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"

let base = ""
let owner = { email: "", cookie: "" }
let decks: ReturnType<typeof openPool>
const person: doom.Author = { kind: "person", id: "tab" }
const edit = (writes: readonly doom.Write[]) => ({ once: crypto.randomUUID(), author: person, writes })

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "deck-component-session")
  decks = openPool(info.deck, "deck-component-deck")
  const listen = new DeckListen(info.listen)
  const mails: Mail[] = []
  const served = await serve({
    session,
    deck: decks,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  const email = "owner@example.com"
  owner = { email, cookie: await signInByCode(base, mails, email) }
  return async () => {
    await served.close()
    await listen.close()
    await Promise.all([session.end(), decks.end()])
  }
})

const post = (route: keyof typeof doomRoutes, body: unknown, cookie = owner.cookie) =>
  ask(base, "POST", doomRoutes[route].path, body, cookie)

async function made(): Promise<DeckId> {
  const id = readDeckId(`guard${randomBytes(6).toString("hex")}`)
  if (!id.ok) throw new Error("invalid deck id")
  expect((await post("create", { deck: id.deck })).json).toMatchObject({ ok: true })
  return id.deck
}

async function foldOf(deck: DeckId): Promise<doom.Doom> {
  const opened = doomRoutes.open.result((await post("open", { deck })).json)
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.fold
}

async function logOf(deck: DeckId) {
  const log = doomRoutes.since.result((await post("since", { deck, rev: 1 })).json)
  if (!log.ok) throw new Error(JSON.stringify(log))
  return log
}

const send = (deck: DeckId, writes: readonly doom.Write[]) => post("edit", { deck, edit: edit(writes) })

it("validates and replays a deck component through the ordinary edit routes", async () => {
  const deck = await made()
  const component = doom.nodeId("authored:1")
  const frame = doom.nodeId("authored:2")
  const at = doom.orderKeyBetween(null, null)
  const spec = (w: number) => ({
    version: 1,
    name: "Tile",
    collections: {},
    parts: [{ emit: { kind: "rect", key: ["list", "tile"], x: 0, y: 0, w, h: 100, fill: { var: "accent1" } } }],
    sample: { w: 300, h: 100, data: {} },
  })
  const initial = await foldOf(deck)
  const create: doom.Write[] = [
    { node: component, prop: "type", value: "component" },
    { node: component, prop: "parent", value: { id: startIds.deck, at } },
    { node: component, prop: "name", value: "Tile" },
    { node: component, prop: "spec", value: spec(100) },
    { node: component, prop: "revision", value: 1 },
  ]
  expect(
    (
      await send(
        deck,
        create.map((write) =>
          write.prop === "spec" ? { ...write, value: { ...spec(100), sample: { w: 0, h: 100, data: {} } } } : write,
        ),
      )
    ).json,
  ).toMatchObject({ ok: false, refused: "shape", node: component, prop: "spec" })
  expect((await send(deck, create)).json).toMatchObject({ ok: true })
  const authored = await foldOf(deck)
  const measure = doom.measureWith({})
  const placed = doom.placeComponent(
    authored,
    { node: component, revision: 1 },
    {
      frame,
      parent: { id: startIds.slide, at },
      box: { x: 0, y: 0, w: 300, h: 100, rotation: 0, flipH: false, flipV: false },
      data: {},
      measure,
    },
  )
  if (doom.isRefusal(placed)) throw new Error(JSON.stringify(placed))
  const guarded = (writes: readonly doom.Write[], readBase: doom.Rev) =>
    post("edit", { deck, edit: { ...edit(writes), readBase } })
  expect((await guarded(placed, authored.rev)).json).toMatchObject({ ok: true })
  const linked = await foldOf(deck)
  const update: doom.Write[] = [
    { node: component, prop: "spec", value: spec(200), base: authored.rev },
    { node: component, prop: "revision", value: 2, base: authored.rev },
  ]
  expect((await guarded(update, linked.rev)).json).toMatchObject({
    ok: false,
    refused: "shape",
    node: frame,
    prop: "instance",
  })
  const prepared = doom.prepareComponentEdit(linked, update, measure)
  if (doom.isRefusal(prepared)) throw new Error(JSON.stringify(prepared))
  expect((await guarded(prepared, linked.rev)).json).toMatchObject({ ok: true })
  const updated = await foldOf(deck)
  expect(updated.nodes.get(frame)).toMatchObject({ instance: { component: { node: component, revision: 2 } } })
  expect((await send(deck, [{ node: component, prop: "parent", value: null }])).json).toMatchObject({ ok: true })
  const detached = await foldOf(deck)
  expect(detached.nodes.get(frame)).not.toHaveProperty("instance")
  let replay = initial
  for (const landed of (await logOf(deck)).edits) {
    const read = doom.readLanded(landed, replay)
    if (doom.isRefusal(read)) throw new Error(JSON.stringify(read))
    const next = doom.applyEdit(replay, read)
    if (doom.isRefusal(next)) throw new Error(JSON.stringify(next))
    replay = next
  }
  expect(replay.nodes).toEqual(detached.nodes)
})

it("detaches a nested instance whose component was deleted while its slide was gone, as the device does", async () => {
  const deck = await made()
  const component = doom.nodeId("nested:1")
  const second = doom.nodeId("nested:2")
  const group = doom.nodeId("nested:3")
  const frame = doom.nodeId("nested:4")
  const at = doom.orderKeyBetween(null, null)
  const box = { x: 0, y: 0, w: 300, h: 100, rotation: 0, flipH: false, flipV: false }
  const spec = {
    version: 1,
    name: "Tile",
    collections: {},
    parts: [{ emit: { kind: "rect", key: ["list", "tile"], x: 0, y: 0, w: 100, h: 100, fill: { var: "accent1" } } }],
    sample: { w: 300, h: 100, data: {} },
  }
  const setup: doom.Write[] = [
    { node: component, prop: "type", value: "component" },
    { node: component, prop: "parent", value: { id: startIds.deck, at } },
    { node: component, prop: "name", value: "Tile" },
    { node: component, prop: "spec", value: spec },
    { node: component, prop: "revision", value: 1 },
    { node: second, prop: "type", value: "slide" },
    { node: second, prop: "parent", value: { id: startIds.row, at: doom.orderKeyBetween(at, null) } },
    { node: group, prop: "type", value: "frame" },
    { node: group, prop: "parent", value: { id: second, at } },
    { node: group, prop: "box", value: box },
  ]
  expect((await send(deck, setup)).json).toMatchObject({ ok: true })
  const authored = await foldOf(deck)
  const placed = doom.placeComponent(
    authored,
    { node: component, revision: 1 },
    { frame, parent: { id: group, at }, box, data: {}, measure: doom.measureWith({}) },
  )
  if (doom.isRefusal(placed)) throw new Error(JSON.stringify(placed))
  expect((await post("edit", { deck, edit: { ...edit(placed), readBase: authored.rev } })).json).toMatchObject({
    ok: true,
  })
  const linked = await foldOf(deck)
  const parent = doom.propOf(linked.nodes.get(second), "parent")
  expect((await send(deck, [{ node: second, prop: "parent", value: null }])).json).toMatchObject({ ok: true })
  expect((await send(deck, [{ node: component, prop: "parent", value: null }])).json).toMatchObject({ ok: true })
  const gone = await foldOf(deck)
  const deleteRev = gone.revs.get(second)?.get("parent")
  if (deleteRev === undefined || parent == null) throw new Error("the slide has no parent to restore")
  const slideBack: doom.Write = { node: second, prop: "parent", value: parent, base: deleteRev }
  const device = doom.applyEdit(gone, { ...edit([slideBack]), rev: doom.rev(gone.rev + 1) })
  if (doom.isRefusal(device)) throw new Error(JSON.stringify(device))
  expect(device.nodes.get(frame)).not.toHaveProperty("instance")
  expect((await send(deck, [slideBack])).json).toMatchObject({ ok: true })
  const back = await foldOf(deck)
  expect(doom.onDeck(back.nodes, frame)).toBe(true)
  expect(back.nodes).toEqual(device.nodes)
})

async function nestedTile(width: (w: number) => unknown) {
  const deck = await made()
  const component = doom.nodeId("kept:1")
  const second = doom.nodeId("kept:2")
  const group = doom.nodeId("kept:3")
  const frame = doom.nodeId("kept:4")
  const at = doom.orderKeyBetween(null, null)
  const box = { x: 0, y: 0, w: 300, h: 100, rotation: 0, flipH: false, flipV: false }
  const measure = doom.measureWith({})
  const setup: doom.Write[] = [
    { node: component, prop: "type", value: "component" },
    { node: component, prop: "parent", value: { id: startIds.deck, at } },
    { node: component, prop: "name", value: "Tile" },
    { node: component, prop: "spec", value: width(100) },
    { node: component, prop: "revision", value: 1 },
    { node: second, prop: "type", value: "slide" },
    { node: second, prop: "parent", value: { id: startIds.row, at: doom.orderKeyBetween(at, null) } },
    { node: group, prop: "type", value: "frame" },
    { node: group, prop: "parent", value: { id: second, at } },
    { node: group, prop: "box", value: box },
  ]
  expect((await send(deck, setup)).json).toMatchObject({ ok: true })
  const authored = await foldOf(deck)
  const placed = doom.placeComponent(
    authored,
    { node: component, revision: 1 },
    { frame: frame, parent: { id: group, at }, box, data: {}, measure },
  )
  if (doom.isRefusal(placed)) throw new Error(JSON.stringify(placed))
  const landed = async (once: string, writes: readonly doom.Write[]) => {
    const before = await foldOf(deck)
    const answer = (await post("edit", { deck, edit: { once, author: person, readBase: before.rev, writes } })).json
    const after = await foldOf(deck)
    return { answer, before, after, edit: { once, author: person, writes, rev: after.rev } satisfies doom.Landed }
  }
  expect((await landed("place", placed)).answer).toMatchObject({ ok: true })
  const update = async (once: string, value: unknown, revision: number) => {
    const fold = await foldOf(deck)
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
    return landed(once, writes)
  }
  const undo = async (once: string, step: Awaited<ReturnType<typeof landed>>) => {
    const now = await foldOf(deck)
    const writes = doom.invert(step.before, now, step.edit, new Set(), measure)
    expect(writes.length).toBeGreaterThan(0)
    const device = doom.applyEdit(now, { once, author: person, writes, readBase: now.rev, rev: doom.rev(now.rev + 1) })
    if (doom.isRefusal(device)) throw new Error(JSON.stringify(device))
    expect((await landed(once, writes)).answer).toMatchObject({ ok: true })
    const server = await foldOf(deck)
    expect(server.nodes).toEqual(device.nodes)
    return server
  }
  const part = doom.propOf((await foldOf(deck)).nodes.get(frame), "instance")!.parts[0]!.node
  const removeSlide = () => landed("remove", [{ node: second, prop: "parent", value: null }])
  return {
    deck,
    component: component,
    second: second,
    frame: frame,
    part,
    landed,
    update,
    undo,
    removeSlide,
    foldOf: () => foldOf(deck),
  }
}

const tileSpec = (w: number) => ({
  version: 1,
  name: "Tile",
  collections: {},
  parts: [{ emit: { kind: "rect", key: ["list", "tile"], x: 0, y: 0, w, h: 100, fill: { var: "accent1" } } }],
  sample: { w: 300, h: 100, data: {} },
})

it("brings a nested instance back detached when its component now requires data, and the server matches the device", async () => {
  const { second, frame, part, update, undo, removeSlide, foldOf } = await nestedTile(tileSpec)
  const linked = await foldOf()
  const removal = await removeSlide()
  const requiring = {
    ...tileSpec(200),
    collections: { rows: { note: "string" } },
    sample: { w: 300, h: 100, data: { rows: [{ id: "a", note: "sample" }] } },
  }
  expect((await update("require", requiring, 2)).answer).toMatchObject({ ok: true })
  const back = await undo("restore", removal)
  expect(doom.onDeck(back.nodes, second)).toBe(true)
  expect(back.nodes.get(frame)).not.toHaveProperty("instance")
  expect(back.nodes.get(part)).toEqual(linked.nodes.get(part))
})

it("refuses a reused component revision and rebuilds a returning instance at the current spec", async () => {
  const { component, frame, part, update, undo, removeSlide } = await nestedTile(tileSpec)
  const widened = await update("widen", tileSpec(200), 2)
  const removal = await removeSlide()
  const rolledBack = await undo("roll-back", widened)
  expect(doom.propOf(rolledBack.nodes.get(component), "revision")).toBe(3)
  expect((await update("reuse", tileSpec(300), 2)).answer).toMatchObject({
    ok: false,
    refused: "shape",
    node: component,
    prop: "revision",
  })
  expect((await update("wider", tileSpec(300), 4)).answer).toMatchObject({ ok: true })
  const back = await undo("restore", removal)
  expect(doom.propOf(back.nodes.get(frame), "instance")?.component).toEqual({ node: component, revision: 4 })
  expect(doom.propOf(back.nodes.get(part), "box")?.w).toBe(300)
})

it("undoes and redoes a template update after another writer placed an instance, and the server matches the device", async () => {
  const { deck, component, frame, landed, update, undo, foldOf } = await nestedTile(tileSpec)
  const widened = await update("widen", tileSpec(200), 2)
  const later = doom.nodeId("kept:5")
  const box = { x: 0, y: 200, w: 300, h: 100, rotation: 0, flipH: false, flipV: false }
  const placed = doom.placeComponent(
    await foldOf(),
    { node: component, revision: 2 },
    {
      frame: later,
      parent: { id: doom.nodeId("kept:3"), at: doom.orderKeyBetween(null, null) },
      box,
      data: {},
      measure: doom.measureWith({}),
    },
  )
  if (doom.isRefusal(placed)) throw new Error(JSON.stringify(placed))
  expect((await landed("later", placed)).answer).toMatchObject({ ok: true })
  const tiles = (fold: doom.Doom, revision: number, width: number) => {
    expect(doom.propOf(fold.nodes.get(component), "revision")).toBe(revision)
    for (const root of [frame, later]) {
      const instance = doom.propOf(fold.nodes.get(root), "instance")!
      expect(instance.component).toEqual({ node: component, revision })
      expect(doom.propOf(fold.nodes.get(instance.parts[0]!.node), "box")?.w).toBe(width)
    }
  }
  const beforeUndo = await foldOf()
  const reverted = await undo("revert", widened)
  tiles(reverted, 3, 100)
  const reverting = doom.readLanded((await logOf(deck)).edits.at(-1), beforeUndo)
  if (doom.isRefusal(reverting)) throw new Error(JSON.stringify(reverting))
  const redone = await undo("redo", { answer: {}, before: beforeUndo, after: reverted, edit: reverting })
  tiles(redone, 4, 200)
})

it("refuses a template revision that skips ahead through the edit route", async () => {
  const { component, landed, foldOf } = await nestedTile(tileSpec)
  const fold = await foldOf()
  const base = (prop: "spec" | "revision") => fold.revs.get(component)!.get(prop)!
  for (const revision of [Number.MAX_SAFE_INTEGER, 3])
    expect(
      (
        await landed(`skip-${revision}`, [
          { node: component, prop: "spec", value: tileSpec(200), base: base("spec") },
          { node: component, prop: "revision", value: revision, base: base("revision") },
        ])
      ).answer,
    ).toMatchObject({ ok: false, refused: "shape", node: component, prop: "revision" })
})

it("skips a template update another writer deleted the template of, undoes the rest, and the server matches the device", async () => {
  const { component, second, frame, landed, foldOf } = await nestedTile(tileSpec)
  const fold = await foldOf()
  const base = (prop: "spec" | "revision") => fold.revs.get(component)!.get(prop)!
  const measure = doom.measureWith({})
  const prepared = doom.prepareComponentEdit(
    fold,
    [
      { node: component, prop: "spec", value: tileSpec(200), base: base("spec") },
      { node: component, prop: "revision", value: 2, base: base("revision") },
    ],
    measure,
  )
  if (doom.isRefusal(prepared)) throw new Error(JSON.stringify(prepared))
  const widened = await landed("widen", [...prepared, { node: second, prop: "name", value: "Tiles" }])
  const deleting = await landed("delete", [{ node: component, prop: "parent", value: null }])
  const gone = await foldOf()
  expect(doom.skippedTemplates(widened.before, gone, widened.edit.writes)).toEqual([component])
  const writes = doom.invertStep(widened.before, gone, widened.edit, new Set(), measure)
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const device = doom.applyEdit(gone, {
    once: "undo",
    author: person,
    writes,
    readBase: gone.rev,
    rev: doom.rev(gone.rev + 1),
  })
  if (doom.isRefusal(device)) throw new Error(JSON.stringify(device))
  expect((await landed("undo", writes)).answer).toMatchObject({ ok: true })
  const undone = await foldOf()
  expect(undone.nodes).toEqual(device.nodes)
  expect(doom.propOf(undone.nodes.get(second), "name")).toBeUndefined()
  expect(doom.propOf(undone.nodes.get(component), "revision")).toBe(2)

  const restore = doom.invertStep(deleting.before, undone, deleting.edit, new Set(), measure)
  if (doom.isRefusal(restore)) throw new Error(JSON.stringify(restore))
  expect((await landed("restore", restore)).answer).toMatchObject({ ok: true })
  const restored = await foldOf()
  expect(doom.propOf(restored.nodes.get(frame), "instance")?.component).toEqual({ node: component, revision: 2 })
  expect(doom.propOf(restored.nodes.get(component), "spec")).toEqual(tileSpec(200))
})
