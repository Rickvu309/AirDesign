import { format } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, memoryShelf, node, other, tracedRemote } from "./browser-fixtures.js"
import { connect, deleteDatabase } from "./index.js"
import { accountKey, databaseName, scoped, storeName } from "./device.js"
import { rowKey, rowRange, type StoredRow } from "./store.js"

const newer = { ok: false, refusal: "newer" }

const newerRow = {
  kind: "pending",
  deck: "deck",
  order: 1,
  base: 0,
  node: "258.slide",
  format: format + 1,
  patch: { fill: { value: { set: { solid: { scheme: "accent1" } } } } },
}

function opened(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(databaseName, version)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error("open"))
  })
}

async function storeRow(version: number, row: Record<string, unknown>): Promise<void> {
  const database = await opened(version)
  const writing = database.transaction(storeName, "readwrite")
  writing.objectStore(storeName).put(row, scoped(accountKey() ?? "", rowKey("deck", "pending", 1)))
  await new Promise<void>((resolve) => {
    writing.oncomplete = () => resolve()
  })
}

async function storedNodes(version: number): Promise<string[]> {
  const database = await opened(version)
  const all = database
    .transaction(storeName, "readonly")
    .objectStore(storeName)
    .getAll(rowRange(scoped(accountKey() ?? "", "deck")))
  return new Promise((resolve) => {
    all.onsuccess = () => resolve((all.result as StoredRow[]).map((row) => String(row.node)))
  })
}

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase().catch(() => undefined)
})

it("answers newer from enqueue, flush and openDeck once a newer build stored the deck, and keeps its row", async () => {
  const { remote, calls } = tracedRemote()
  const tab = connect(remote)
  await tab.openDeck("deck")
  await tab.enqueue("deck", "typed before", node, "")
  await storeRow(format + 1, newerRow)

  expect(await tab.enqueue("deck", "typed after", node, "")).toEqual(newer)
  expect(await tab.flush("deck")).toEqual(newer)
  expect(await connect(tracedRemote().remote).openDeck("deck")).toEqual(newer)
  expect(calls).not.toContain("commit deck")
  expect(await storedNodes(format + 1)).toEqual(["258.7", "258.slide"])
})

it("answers newer when a stored row says a newer format, and deletes nothing", async () => {
  const { remote, calls } = tracedRemote()
  const tab = connect(remote)
  await tab.openDeck("deck")
  await tab.enqueue("deck", "typed before", node, "")
  await storeRow(format, newerRow)

  expect(await connect(remote).openDeck("deck")).toEqual(newer)
  expect(await tab.enqueue("deck", "typed after", node, "")).toEqual(newer)
  expect(await tab.flush("deck")).toEqual(newer)
  expect(calls).not.toContain("commit deck")
  expect(await storedNodes(format)).toEqual(["258.7", "258.slide"])
})

it("answers newer when a stored row of trait fields is from a newer build, and deletes nothing", async () => {
  const { remote, calls } = tracedRemote()
  const tab = connect(remote)
  await tab.openDeck("deck")
  await tab.enqueue("deck", "typed before", node, "")
  const { format: _, ...unstamped } = newerRow
  await storeRow(format, { ...unstamped, node: "258.8", v: format + 1 })

  expect(await connect(remote).openDeck("deck")).toEqual(newer)
  expect(await tab.flush("deck")).toEqual(newer)
  expect(calls).not.toContain("commit deck")
  expect(await storedNodes(format)).toEqual(["258.7", "258.8"])
})

it("stops writing once the register answer says a newer format", async () => {
  const { remote, calls } = tracedRemote({ ok: false, refusal: "newer" })
  const tab = connect(remote)
  expect(await tab.openDeck("deck")).toEqual(newer)
  expect(await tab.enqueue("deck", "typed after", node, "")).toEqual(newer)
  expect(await tab.flush("deck")).toEqual(newer)
  expect(calls).toEqual(["open deck"])
  expect(await storedNodes(format)).toEqual([])
})

for (const kind of ["pending", "confirmed"]) {
  it(`keeps an unfamiliar ${kind} slide command on disk and refuses it as newer`, async () => {
    const { remote, calls } = tracedRemote()
    const raw = {
      kind,
      deck: "deck",
      order: 1,
      revision: 1,
      base: 0,
      value: "",
      slideFile: ["256"],
      slideEdit: { slide: "future-grid", grid: 2 },
      once: "sealed",
    }
    await storeRow(format, raw)
    expect(await connect(remote).openDeck("deck")).toEqual(newer)
    expect(calls).not.toContain("commit deck")
    const database = await opened(format)
    const request = database
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .get(scoped(accountKey() ?? "", rowKey("deck", "pending", 1)))
    const stored = await new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result)
    })
    expect(stored).toEqual(raw)
  })
}

it("keeps a pending row it cannot read on the device, answers newer and sends nothing", async () => {
  const { remote, calls } = tracedRemote()
  const tab = connect(remote)
  await tab.openDeck("deck")
  await tab.enqueue("deck", "typed before", node, "")
  const { format: _, ...unstamped } = newerRow
  await storeRow(format, { ...unstamped, node: "258.8", v: format, patch: { box: { spin: { set: 1 } } } })

  expect(await connect(remote).openDeck("deck")).toEqual(newer)
  expect(await tab.flush("deck")).toEqual(newer)
  expect(calls).not.toContain("commit deck")
  expect(await storedNodes(format)).toEqual(["258.7", "258.8"])
})

it("keeps what is typed after a newer build took the deck in the journal, for that build to send", async () => {
  const journal = new Map<string, string>()
  const tab = connect(tracedRemote().remote, { shelf: memoryShelf(journal) })
  await tab.openDeck("deck")
  await tab.enqueue("deck", "typed before", node, "")
  await storeRow(format + 1, newerRow)

  expect(await tab.enqueue("deck", "first after", node, "")).toEqual(newer)
  expect(await tab.enqueue("deck", "second after", other, "")).toEqual(newer)
  const kept = [...journal.values()].flatMap((raw) => JSON.parse(raw) as { readonly value?: string }[])
  expect(kept.map((entry) => entry.value)).toEqual(["first after", "second after"])
})

it("writes an edit once when it is the first thing the page does with the deck's journal", async () => {
  const journal = new Map<string, string>()
  const tab = connect(tracedRemote().remote, { shelf: memoryShelf(journal) })
  const row = { v: format, patch: { box: { x: { set: 5 } } } }
  expect(await tab.enqueueRow("deck", row, node, "")).toMatchObject({ ok: true })
  expect(await tab.pending("deck")).toHaveLength(1)
  expect([...journal.values()]).toEqual([])
})
