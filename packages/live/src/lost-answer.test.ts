import {
  currentBox,
  currentValue,
  elementId,
  orderKeyAfter,
  orderKeyBetween,
  presentSlides,
  slideId,
  version,
  type IndexElement,
  type Register,
  type SlideId,
} from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, writeRows } from "./browser-fixtures.js"
import { rowsFromRegister } from "./deck-view.js"
import { newPage } from "./device.js"
import { rowKey, type ConfirmedRow, type PendingRow } from "./store.js"
import type { DeckId, WireEdit, WireSlide } from "@airdesign/catalog"
import { connect, deleteDatabase, memoryRemote, type Remote } from "./index.js"

const deck = "lost"
const file = [slideId("256"), slideId("257")] as const

beforeEach(installIndexedDb)
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function keyAfter(ids: readonly SlideId[], after: SlideId) {
  const key = orderKeyAfter(presentSlides({ file: ids, order: [] }), after)
  if (key === null) throw new Error("key")
  return key
}

const added = {
  slide: "add" as const,
  id: slideId("258"),
  after: file[0],
  key: keyAfter(file, file[0]),
  layout: file[0],
}

function losing(server: Remote): { remote: Remote; lose: () => void } {
  let losingNext = false
  return {
    lose: () => {
      losingNext = true
    },
    remote: {
      ...server,
      commit: async (body) => {
        const result = await server.commit(body)
        if (losingNext) {
          losingNext = false
          throw new TypeError("answer lost")
        }
        return result
      },
    },
  }
}

async function reloaded(server: Remote) {
  newPage()
  const cache = connect({ ...server })
  expect(await cache.open(deck)).toEqual({ ok: true })
  const opened = await cache.openDeck(deck)
  if (!opened.ok) throw new Error(opened.refusal)
  return { cache, opened }
}

it("lands a new slide whose answer was lost once, and keeps one row of it through two reloads", async () => {
  const server = memoryRemote()
  const page = losing(server)
  const first = connect(page.remote)
  expect(await first.openDeck(deck)).toMatchObject({ ok: true })
  expect(await first.enqueueSlide(deck, file, added)).toMatchObject({ ok: true })
  page.lose()
  await expect(first.flush(deck)).rejects.toThrow("answer lost")
  for (let reload = 0; reload < 2; reload += 1) {
    const { cache, opened } = await reloaded(page.remote)
    expect(presentSlides(opened.register).map((spot) => spot.id)).toEqual(["256", "258", "257"])
    expect(await cache.flush(deck)).toMatchObject(reload === 0 ? { ok: true, revision: 1 } : { refusal: "batch" })
    const rows = await cache.rows(deck)
    expect(rows.filter((row) => row.slideEdit?.slide === "add")).toHaveLength(1)
    expect(await cache.pending(deck)).toEqual([])
  }
  const stored = await server.open({ deck })
  if (!stored.ok) throw new Error(stored.refusal)
  expect(stored.revision).toBe(1)
  expect(presentSlides(stored.register).map((spot) => spot.id)).toEqual(["256", "258", "257"])
})

it("keeps one row of typed text whose answer was lost after a reload", async () => {
  const server = memoryRemote()
  const page = losing(server)
  const first = connect(page.remote)
  const node = elementId("256.9")
  const element = { node, kind: "shape" as const, value: "", box: { x: 0, y: 0, cx: 10, cy: 5 }, grouped: false }
  expect(await first.openDeck(deck)).toMatchObject({ ok: true })
  expect((await first.enqueueSlide(deck, file, { slide: "element-add", id: file[0], element })).ok).toBe(true)
  expect((await first.enqueue(deck, "Typed", node, "")).ok).toBe(true)
  page.lose()
  await expect(first.flush(deck)).rejects.toThrow("answer lost")
  const { cache } = await reloaded(page.remote)
  expect(await cache.flush(deck)).toMatchObject({ ok: true })
  const rows = await cache.rows(deck)
  expect(rows.filter((row) => row.value === "Typed")).toHaveLength(1)
  expect(rows.filter((row) => row.slideEdit?.slide === "element-add")).toHaveLength(1)
  expect(await server.open({ deck })).toMatchObject({ ok: true, revision: 1 })
})

type Cache = ReturnType<typeof connect>

const box = { x: 0, y: 0, cx: 10, cy: 5 }
const shape = elementId("256.9")
const picture = elementId("256.11")
const notes = elementId("256.notes")
const ahead = orderKeyBetween(null, keyAfter(file, file[0]))

function element(node: IndexElement["node"], kind: "shape" | "picture"): IndexElement {
  if (kind === "picture") return { node, kind, value: null, box, grouped: false }
  return { node, kind, value: "", box, grouped: false }
}

const shapes: readonly {
  readonly name: string
  readonly before?: (cache: Cache) => Promise<unknown>
  readonly edit: (cache: Cache) => Promise<{ readonly ok: boolean }>
  readonly later?: WireEdit | WireSlide
}[] = [
  {
    name: "text in a new text box",
    edit: (cache) => cache.enqueue(deck, "Typed", shape, ""),
    later: { node: shape, value: "Later" },
  },
  {
    name: "speaker notes",
    edit: (cache) => cache.enqueue(deck, "Say this", notes, ""),
    later: { node: notes, value: "Say that" },
  },
  {
    name: "a moved text box",
    before: (cache) =>
      cache.enqueueSlide(deck, file, { slide: "element-add", id: file[0], element: element(shape, "shape") }),
    edit: (cache) => cache.enqueueBox(deck, { ...box, x: 40 }, shape, ""),
    later: { node: shape, property: "box", value: { ...box, x: 80 } },
  },
  {
    name: "an added picture",
    edit: (cache) =>
      cache.enqueueSlide(deck, file, {
        slide: "element-add",
        id: file[0],
        element: element(picture, "picture"),
        media: { sha256: "a".repeat(64), type: "image/png" },
      }),
  },
  {
    name: "a moved slide",
    edit: (cache) => cache.enqueueSlide(deck, file, { slide: "move", id: file[1], key: ahead }),
    later: { slide: "move", id: file[0], key: orderKeyBetween(null, ahead), file },
  },
]

function shown(register: Register) {
  return {
    slides: presentSlides(register).map((spot) => spot.id),
    order: register.order,
    elements: Object.fromEntries(
      register.nodes.flatMap((node) => {
        const body = register.elements[node]
        if (body === undefined || body.landed.length === 0) return []
        const moved = body.landed.some((row) => row.visible && row.property === "box")
        return [[node, { value: currentValue(body), box: moved ? currentBox(body) : null, version: version(body) }]]
      }),
    ),
  }
}

for (const each of shapes) {
  it(`shows ${each.name} whose answer was lost exactly as the server holds it after a reload`, async () => {
    const server = memoryRemote()
    const page = losing(server)
    const first = connect(page.remote)
    expect(await first.openDeck(deck)).toMatchObject({ ok: true })
    if (each.before !== undefined) {
      await each.before(first)
      expect(await first.flush(deck)).toMatchObject({ ok: true })
    }
    expect((await each.edit(first)).ok).toBe(true)
    page.lose()
    await expect(first.flush(deck)).rejects.toThrow("answer lost")
    if (each.later !== undefined) expect(await server.commit({ deck, batch: [each.later] })).toMatchObject({ ok: true })
    const landedAt = (each.before === undefined ? 1 : 2) + (each.later === undefined ? 0 : 1)
    const { cache } = await reloaded(page.remote)
    const lostAt = each.before === undefined ? 1 : 2
    expect(await cache.flush(deck)).toMatchObject({ ok: true, revision: lostAt })
    const stored = await server.open({ deck })
    if (!stored.ok) throw new Error(stored.refusal)
    expect(stored.revision).toBe(landedAt)
    const device = await cache.openDeck(deck)
    if (!device.ok) throw new Error(device.refusal)
    expect(device.pending).toEqual([])
    const rows = (list: readonly ConfirmedRow[]) => list.map((row) => [row.node, row.value, row.slideEdit])
    expect(rows(device.confirmed)).toEqual(rows(rowsFromRegister(stored.deck, stored.register)))
    expect(shown(device.register)).toEqual(shown(stored.register))
  })
}

async function stuck(server: Remote, confirmed: readonly ConfirmedRow[], pending: readonly PendingRow[]) {
  await writeRows(
    [
      ...confirmed.map((row, at) => ({ key: rowKey(deck, "confirmed", at), row: { ...row, revision: at } })),
      ...pending.map((row) => ({ key: rowKey(deck, "pending", row.order), row })),
    ],
    [],
  )
  newPage()
  return connect({ ...server })
}

async function landedAdd(server: Remote) {
  const opened = await server.open({ deck })
  if (!opened.ok) throw new Error(opened.refusal)
  expect(await server.commit({ deck, batch: [{ ...added, file }], once: "lost" })).toMatchObject({ ok: true })
  const landed = await server.open({ deck })
  if (!landed.ok) throw new Error(landed.refusal)
  return landed
}

const sealedAdd: PendingRow = {
  kind: "pending",
  deck: deck as DeckId,
  order: 0,
  base: 0,
  value: "",
  once: "lost",
  slideFile: file,
  slideEdit: added,
}

it("opens a deck stuck with a landed slide and its sealed copy still pending, and heals it on the next open", async () => {
  const server = memoryRemote()
  const landed = await landedAdd(server)
  const cache = await stuck(server, rowsFromRegister(landed.deck, landed.register), [sealedAdd])
  const offline = await connect(memoryRemote()).openDeck(deck)
  if (!offline.ok) throw new Error(offline.refusal)
  expect(presentSlides(offline.register).map((spot) => spot.id)).toEqual(["256", "258", "257"])
  expect(await cache.open(deck)).toEqual({ ok: true })
  const opened = await cache.openDeck(deck)
  if (!opened.ok) throw new Error(opened.refusal)
  expect(presentSlides(opened.register).map((spot) => spot.id)).toEqual(["256", "258", "257"])
  expect(await cache.flush(deck)).toEqual({ ok: true, deck, revision: 1, key: `${deck}:1` })
  expect(await cache.pending(deck)).toEqual([])
  const rows = await cache.rows(deck)
  expect(rows.filter((row) => row.slideEdit?.slide === "add")).toHaveLength(1)
  expect(await server.open({ deck })).toMatchObject({ ok: true, revision: 1 })
})

it("opens a deck whose device copy holds a landed slide twice, and heals it from the server's copy", async () => {
  const server = memoryRemote()
  const landed = await landedAdd(server)
  const twice = rowsFromRegister(landed.deck, landed.register)
  const cache = await stuck(server, [...twice, ...twice.filter((row) => row.slideEdit !== undefined)], [])
  const offline = await connect(memoryRemote()).openDeck(deck)
  if (!offline.ok) throw new Error(offline.refusal)
  expect(presentSlides(offline.register).map((spot) => spot.id)).toEqual(["256", "258", "257"])
  expect(await cache.open(deck)).toEqual({ ok: true })
  expect(await cache.openDeck(deck)).toMatchObject({ ok: true })
  expect(await cache.enqueue(deck, "After", shape, "")).toMatchObject({ ok: true })
  expect(await cache.flush(deck)).toMatchObject({ ok: true, revision: 2 })
  const rows = await cache.rows(deck)
  expect(rows.filter((row) => row.slideEdit?.slide === "add")).toHaveLength(1)
})

it("sets aside a new slide another writer's slide took the place of, tells it once, and still sends the edits after it", async () => {
  const server = memoryRemote()
  const page = connect({ ...server, commit: () => Promise.reject(new TypeError("offline")) })
  expect(await page.openDeck(deck)).toMatchObject({ ok: true })
  expect(await page.enqueueSlide(deck, file, added)).toMatchObject({ ok: true })
  expect(await page.enqueue(deck, "Kept", shape, "")).toMatchObject({ ok: true })
  const theirs = { ...added, key: orderKeyBetween(null, keyAfter(file, file[0])) }
  expect(await server.commit({ deck, batch: [{ ...theirs, file }] })).toMatchObject({ ok: true })
  newPage()
  const online = connect({ ...server })
  expect(await online.flush(deck)).toMatchObject({ ok: true, revision: 2, aside: 1 })
  expect(await online.pending(deck)).toEqual([])
  const stored = await server.open({ deck })
  if (!stored.ok) throw new Error(stored.refusal)
  expect(stored.register.order).toEqual([theirs])
  expect(currentValue(stored.register.elements[shape]!)).toBe("Kept")
  const opened = await online.openDeck(deck)
  if (!opened.ok) throw new Error(opened.refusal)
  expect(opened.register.order).toEqual([theirs])
  expect(await online.enqueue(deck, "Later", shape, "")).toMatchObject({ ok: true })
  expect(await online.flush(deck)).toEqual({ ok: true, deck, revision: 3, key: `${deck}:3` })
})

it("sets aside text typed on a slide another writer removed, and tells it after a reload when the page closed first", async () => {
  const server = memoryRemote()
  const page = connect({ ...server, commit: () => Promise.reject(new TypeError("offline")) })
  const onRemoved = elementId("257.4")
  expect(await page.openDeck(deck)).toMatchObject({ ok: true })
  expect(await page.enqueue(deck, "Lost cause", onRemoved, "")).toMatchObject({ ok: true })
  expect(await page.enqueue(deck, "Kept", shape, "")).toMatchObject({ ok: true })
  expect(await server.commit({ deck, batch: [{ slide: "remove", id: file[1], file }] })).toMatchObject({ ok: true })
  newPage()
  let sends = 0
  const closing = connect({
    ...server,
    commit: (body) => {
      sends += 1
      return sends === 1 ? server.commit(body) : Promise.reject(new TypeError("closed"))
    },
  })
  await expect(closing.flush(deck)).rejects.toThrow("closed")
  expect((await closing.pending(deck)).map((row) => row.value)).toEqual(["Kept"])
  newPage()
  const reopened = connect({ ...server })
  expect(await reopened.flush(deck)).toEqual({ ok: true, deck, revision: 2, key: `${deck}:2`, aside: 1 })
  expect(await reopened.pending(deck)).toEqual([])
  expect(await reopened.flush(deck)).toEqual({ ok: false, refusal: "batch" })
  const stored = await server.open({ deck })
  if (!stored.ok) throw new Error(stored.refusal)
  expect(currentValue(stored.register.elements[shape]!)).toBe("Kept")
})
