import { randomBytes } from "node:crypto"
import { doomRoutes, readDeckId, type DeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { beforeAll, describe, expect, it } from "vitest"

import { editDoom } from "./doom/doom-deck.js"
import { startIds } from "./doom/doom-start.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { heldQueries } from "./testing/held-queries.js"

let base = ""
let owner = { email: "", cookie: "" }
let stranger = ""
let decks: ReturnType<typeof openPool>
const person: doom.Author = { kind: "person", id: "tab" }
const rename = (value: string): doom.Write[] => [{ node: startIds.deck, prop: "name", value }]
const edit = (writes: readonly doom.Write[]) => ({ once: crypto.randomUUID(), author: person, writes })

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "read-base-session")
  decks = openPool(info.deck, "read-base-deck")
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
  stranger = await signInByCode(base, mails, "stranger@example.com")
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

describe("an edit with a read base", () => {
  it("checks the base of an empty edit without writing a row", async () => {
    const deck = await made()
    const command = { ...edit([]), readBase: 1 }
    expect((await post("edit", { deck, edit: command })).json).toEqual({ ok: true, deck, rev: 1 })
    expect((await logOf(deck)).edits).toEqual([])
    expect((await send(deck, rename("Later"))).json).toEqual({ ok: true, deck, rev: 2 })
    expect((await post("edit", { deck, edit: command })).json).toEqual({
      ok: false,
      refusal: "edit",
      refused: "stale",
    })
  })

  it("lands at the exact head and returns the same answer after the reply is lost", async () => {
    const deck = await made()
    const command = { ...edit(rename("Prepared")), readBase: 1 }
    const first = await post("edit", { deck, edit: command })
    expect(first.json).toEqual({ ok: true, deck, rev: 2 })
    expect((await send(deck, rename("Later"))).json).toEqual({ ok: true, deck, rev: 3 })
    expect((await post("edit", { deck, edit: command }, stranger)).json).toEqual({
      ok: false,
      refusal: "owner",
    })
    expect((await post("edit", { deck, edit: command })).json).toEqual(first.json)
    expect(doom.deckName(await foldOf(deck))).toBe("Later")
    expect((await logOf(deck)).edits).toMatchObject([{ once: command.once, readBase: 1, rev: 2 }, { rev: 3 }])
  })

  it("refuses the whole edit if a different writer beats the compare-and-swap", async () => {
    const deck = await made()
    const before = await foldOf(deck)
    const held = heldQueries(decks)
    const write = held.hold("with updated as")
    const prepared = editDoom(
      held.db,
      { deck, edit: { ...edit(rename("Prepared")), readBase: before.rev } },
      owner.email,
    )
    const awaitingWrite = await Promise.race([write.reached.then(() => true), prepared.then(() => false)])
    expect(awaitingWrite).toBe(true)
    try {
      expect((await send(deck, [{ node: startIds.slide, prop: "name", value: "Other" }])).json).toEqual({
        ok: true,
        deck,
        rev: 2,
      })
    } finally {
      write.release()
    }
    expect(await prepared).toEqual({ ok: false, refusal: "edit", refused: "stale" })
    const after = await foldOf(deck)
    expect(after.rev).toBe(2)
    expect(doom.deckName(after)).toBe(doom.deckName(before))
    expect(after.nodes.get(startIds.slide)).toMatchObject({ name: "Other" })
    expect((await logOf(deck)).edits).toHaveLength(1)
  })

  it("lands consecutive prepared bases in order and refuses a future or invalid base", async () => {
    const deck = await made()
    const first = { ...edit(rename("First")), readBase: 1 }
    const second = { ...edit(rename("Second")), readBase: 2 }
    expect((await post("edit", { deck, edit: second })).json).toEqual({ ok: false, refusal: "edit", refused: "stale" })
    expect((await post("edit", { deck, edit: { ...second, readBase: null } })).json).toEqual({
      ok: false,
      refusal: "edit",
      refused: "shape",
    })
    const landed = await post("edit", { deck, edit: first })
    expect(landed.json).toEqual({ ok: true, deck, rev: 2 })
    expect((await post("edit", { deck, edit: second })).json).toEqual({ ok: true, deck, rev: 3 })
    expect(doom.deckName(await foldOf(deck))).toBe("Second")
  })
})

it("stores a linked join, suppression and detach, then replays a guarded inverse across real rows", async () => {
  const deck = await made()
  const before = await foldOf(deck)
  const frame = doom.nodeId("component:1")
  let serial = 1
  const mint = () => doom.nodeId(`component:${++serial}`)
  const measure = doom.measureWith({})
  const data = {
    rows: [
      { id: "a", label: "Alpha", value: 10 },
      { id: "b", label: "Beta", value: 40 },
    ],
  }
  const at = doom.orderKeyBetween(null, null)
  const guarded = async (fold: doom.Doom, writes: readonly doom.Write[] | doom.Refusal) => {
    if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
    const action = { ...edit(writes), readBase: fold.rev }
    expect((await post("edit", { deck, edit: action })).json).toEqual({ ok: true, deck, rev: fold.rev + 1 })
    return { ...action, rev: doom.rev(fold.rev + 1) }
  }
  await guarded(
    before,
    doom.placeComponent(before, {
      frame,
      parent: { id: startIds.slide, at },
      box: { x: 20, y: 30, w: 1200, h: 600, flipH: false, flipV: false, rotation: 0 },
      data,
      measure,
    }),
  )
  const placed = await foldOf(deck)
  const linked = doom.propOf(placed.nodes.get(frame), "instance")
  if (linked === undefined) throw new Error("missing stored instance")
  const bar = linked.parts.find(({ key }) => key[0] === "bar" && key[1] === "a")
  const another = linked.parts.find(({ key }) => key[0] === "bar" && key[1] === "b")
  if (bar === undefined || another === undefined) throw new Error("missing bars")
  const manual = mint()
  const attempt = await send(deck, [
    { node: manual, prop: "type", value: "shape" },
    { node: manual, prop: "parent", value: { id: linked.generated, at } },
  ])
  expect(attempt.json).toMatchObject({ ok: false, refused: "shape", node: manual })
  const fills = [{ kind: "solid", color: { var: "accent2" } }]
  expect(
    (
      await send(deck, [
        { node: bar.node, prop: "fills", value: fills },
        { node: manual, prop: "type", value: "shape" },
        { node: manual, prop: "parent", value: { id: frame, at } },
      ])
    ).json,
  ).toMatchObject({ ok: true })
  expect((await send(deck, [{ node: another.node, prop: "parent", value: null }])).json).toMatchObject({ ok: true })
  const suppressed = await foldOf(deck)
  const generation = doom.regenerateComponent(
    suppressed,
    frame,
    {
      data: {
        rows: [
          { id: "b", label: "Beta", value: -20 },
          { id: "a", label: "Alpha", value: 2 },
        ],
      },
    },
    measure,
  )
  if (doom.isRefusal(generation)) throw new Error(JSON.stringify(generation))
  await guarded(suppressed, generation.writes)
  const joined = await foldOf(deck)
  expect(joined.nodes.get(bar.node)).toMatchObject({ fills })
  expect(joined.nodes.get(another.node)).toMatchObject({ parent: null })
  expect(joined.nodes.get(manual)).toMatchObject({ parent: { id: frame, at } })
  const detach = await guarded(joined, doom.detachComponent(joined, frame))
  const detached = await foldOf(deck)
  expect(doom.propOf(detached.nodes.get(frame), "instance")).toBeUndefined()
  expect(detached.children).toEqual(joined.children)
  await guarded(detached, doom.invert(joined, detached, detach))
  const restored = await foldOf(deck)
  expect(doom.propOf(restored.nodes.get(frame), "instance")).toEqual(doom.propOf(joined.nodes.get(frame), "instance"))
  expect(restored.children).toEqual(joined.children)
  const log = await logOf(deck)
  const full = doomRoutes.since.result((await post("since", { deck, rev: 0 })).json)
  if (!full.ok) throw new Error(JSON.stringify(full))
  expect(log.edits).toHaveLength(6)
  expect(doom.replayLog(full.edits)).toEqual(restored)
})

it("undoes a generation from replaced rows and keeps a later fill", async () => {
  const deck = await made()
  const before = await foldOf(deck)
  const frame = doom.nodeId("runproof:1")
  const measure = doom.measureWith({})
  const rows = [{ id: "a", label: "Alpha", value: 10 }]
  const place = doom.placeComponent(before, {
    frame,
    parent: { id: startIds.slide, at: doom.orderKeyBetween(null, null) },
    box: { x: 20, y: 30, w: 1200, h: 600, flipH: false, flipV: false, rotation: 0 },
    data: { rows },
    measure,
  })
  if (doom.isRefusal(place)) throw new Error(JSON.stringify(place))
  expect((await post("edit", { deck, edit: { ...edit(place), readBase: before.rev } })).json).toMatchObject({
    ok: true,
  })
  const run = "refresh"
  const author: doom.Author = { kind: "agent", id: "worker", run }
  const work = (writes: readonly doom.Write[]) => ({ ...edit(writes), author })
  const sendWork = async (action: doom.Edit) => {
    expect((await post("edit", { deck, edit: action })).json).toMatchObject({ ok: true })
  }
  await sendWork({ ...work([]), phase: "start" })
  const started = await foldOf(deck)
  const generation = doom.regenerateComponent(started, frame, { tokens: { accent: { var: "accent3" } } }, measure)
  if (doom.isRefusal(generation)) throw new Error(JSON.stringify(generation))
  await sendWork({ ...work(generation.writes), readBase: started.rev })
  await sendWork(work(rename("Agent renamed the deck")))
  const joined = await foldOf(deck)
  const bar = doom.propOf(joined.nodes.get(frame), "instance")?.parts.find(({ key }) => key[0] === "bar")
  if (bar === undefined) throw new Error("missing generated bar")
  const fills = [{ kind: "solid", color: { var: "accent2" } }]
  expect((await send(deck, [{ node: bar.node, prop: "fills", value: fills }])).json).toMatchObject({ ok: true })
  const latest = await foldOf(deck)
  const logged = doomRoutes.run.result((await post("run", { deck, run })).json)
  if (!logged.ok) throw new Error(JSON.stringify(logged))
  const edits = logged.edits.map((raw, i) => {
    const stored = doom.readRunEdit(raw, logged.replaced[i], latest)
    if (doom.isRefusal(stored)) throw new Error(JSON.stringify(stored))
    return stored
  })
  const undone = doom.invertRun(latest, edits)
  expect(undone.left).toEqual([])
  expect(undone.writes.map(({ prop }) => prop)).toEqual(expect.arrayContaining(["instance", "name"]))
  expect(
    (
      await post("edit", {
        deck,
        edit: { ...edit(undone.writes), readBase: latest.rev, runUndo: { run, undone: true } },
      })
    ).json,
  ).toMatchObject({ ok: true })
  const restored = await foldOf(deck)
  expect(doom.deckName(restored)).toBe(doom.deckName(before))
  expect(doom.propOf(restored.nodes.get(frame), "instance")).toEqual(doom.propOf(started.nodes.get(frame), "instance"))
  expect(restored.nodes.get(bar.node)).toMatchObject({ fills })
})
