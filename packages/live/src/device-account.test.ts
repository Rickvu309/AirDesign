import type { DeckId } from "@airdesign/catalog"
import { currentValue } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  countingRemote,
  firstAccount,
  installIndexedDb,
  installParts,
  memoryShelf,
  node,
  other,
  secondAccount,
  signInAs,
} from "./browser-fixtures.js"
import { finished, storeName, transaction } from "./device.js"
import { queueRename } from "./deck-rename.js"
import { idleDays } from "./device-sweep.js"
import {
  adoptDeck,
  connect,
  deleteDatabase,
  dropAccount,
  dropDeck,
  getParts,
  keepMedia,
  memoryRemote,
  putParts,
  queueOriginal,
  readChats,
  readMedia,
  sendQueuedNames,
  writeChat,
} from "./index.js"
import { keepUnsaved } from "./unsaved.js"
import { rowKey } from "./store.js"

const day = 86_400_000
const picture = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 4, 5, 6])

beforeEach(() => {
  installIndexedDb()
  installParts()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

async function shown(cache: ReturnType<typeof connect>, deck: string): Promise<string | undefined> {
  const opened = await cache.openDeck(deck)
  if (!opened.ok) return opened.refusal
  const body = opened.register.elements[node]
  return body === undefined ? undefined : currentValue(body)
}

async function legacyPut(key: string, value: unknown): Promise<void> {
  const writing = await transaction("readwrite")
  writing.objectStore(storeName).put(value, key)
  await finished(writing, () => undefined)
}

async function allKeys(): Promise<string[]> {
  const reading = await transaction("readonly")
  const request = reading.objectStore(storeName).getAllKeys()
  return finished(reading, () => request.result.map(String))
}

const parts = { parts: new Map([["ppt/presentation.xml", new Uint8Array([1])]]), file: new Uint8Array([2]) }

it("never shows one account's deck, typed text or journal to another account on the same browser", async () => {
  const journal = new Map<string, string>()
  const remote = memoryRemote()
  const first = connect(remote, { shelf: memoryShelf(journal) })
  expect(await first.enqueue("deck", "Mine, not sent", node, "file")).toMatchObject({ ok: true })
  await putParts("deck", parts)
  await writeChat("deck", { id: "chat" })
  keepUnsaved(memoryShelf(journal), firstAccount, "deck", "held", {
    kind: "text",
    node: other,
    floor: "file",
    value: "Typed before the page closed",
  })

  signInAs(secondAccount)
  const second = connect(remote, { shelf: memoryShelf(journal) })
  expect(await shown(second, "deck")).toBeUndefined()
  expect(await second.pending("deck")).toEqual([])
  expect(await getParts("deck")).toEqual({ ok: false, refusal: "absent" })
  expect(await readChats("deck")).toEqual([])
  const opened = await second.openDeck("deck")
  expect(opened.ok && opened.register.elements[other]).toBeFalsy()
  await second.sweep()
  await dropDeck("deck", memoryShelf(journal))

  signInAs(firstAccount)
  const back = connect(remote, { shelf: memoryShelf(journal) })
  expect((await back.pending("deck")).map((row) => row.value)).toEqual([
    "Mine, not sent",
    "Typed before the page closed",
  ])
  expect(await getParts("deck")).toMatchObject({ ok: true })
  expect(await readChats("deck")).toEqual([{ id: "chat" }])
  expect(await back.flush("deck")).toMatchObject({ ok: true })
  expect(await back.pending("deck")).toEqual([])
})

it("shows nothing and keeps nothing while no one is signed in", async () => {
  const cache = connect(memoryRemote())
  expect(await cache.enqueue("deck", "Mine", node, "file")).toMatchObject({ ok: true })
  signInAs(undefined)
  const out = connect(memoryRemote(), { shelf: memoryShelf() })
  expect(await out.enqueue("deck", "Stranger", node, "file")).toEqual({ ok: false, refusal: "session" })
  expect(await out.openDeck("deck")).toEqual({ ok: false, refusal: "session" })
  expect(await out.pending("deck")).toEqual([])
  expect(await getParts("deck")).toEqual({ ok: false, refusal: "absent" })
  signInAs(firstAccount)
  expect((await connect(memoryRemote()).pending("deck")).map((row) => row.value)).toEqual(["Mine"])
})

it("gives rows stored before accounts to the account the server says owns the deck, and keeps them hidden otherwise", async () => {
  const journal = new Map<string, string>()
  await legacyPut(rowKey("deck", "pending", 0), {
    kind: "pending",
    deck: "deck" as DeckId,
    order: 0,
    base: 0,
    value: "Typed before accounts",
    node,
    floor: "file",
  })
  await legacyPut("deck\u0002trust", "epoch")
  journal.set(
    "airdesign:unsaved:deck",
    JSON.stringify([{ kind: "text", id: "old", node: other, floor: "file", value: "Journaled before accounts" }]),
  )
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal) })
  expect(await cache.pending("deck")).toEqual([])
  expect(await adoptDeck("deck", async () => false, memoryShelf(journal))).toBe(false)
  expect(await cache.pending("deck")).toEqual([])
  expect(await adoptDeck("deck", async () => true, memoryShelf(journal))).toBe(true)
  signInAs(firstAccount)
  const adopted = connect(memoryRemote(), { shelf: memoryShelf(journal) })
  expect((await adopted.pending("deck")).map((row) => row.value)).toEqual([
    "Typed before accounts",
    "Journaled before accounts",
  ])
  expect((await allKeys()).filter((key) => key.startsWith("deck"))).toEqual([])
  expect(await adoptDeck("deck", async () => true, memoryShelf(journal))).toBe(false)
  signInAs(secondAccount)
  expect(await connect(memoryRemote(), { shelf: memoryShelf(journal) }).pending("deck")).toEqual([])
})

it("removes a deck's device copy for this account only", async () => {
  const journal = new Map<string, string>()
  await connect(memoryRemote(), { shelf: memoryShelf(journal) }).enqueue("deck", "First", node, "file")
  await putParts("deck", parts)
  signInAs(secondAccount)
  await connect(memoryRemote(), { shelf: memoryShelf(journal) }).enqueue("deck", "Second", node, "file")
  await putParts("deck", parts)
  keepUnsaved(memoryShelf(journal), secondAccount, "deck", "x", { kind: "text", node, floor: "f", value: "v" })
  await dropDeck("deck", memoryShelf(journal))
  expect(await connect(memoryRemote()).pending("deck")).toEqual([])
  expect(await getParts("deck")).toEqual({ ok: false, refusal: "absent" })
  expect([...journal.keys()]).toEqual([])
  signInAs(firstAccount)
  expect((await connect(memoryRemote()).pending("deck")).map((row) => row.value)).toEqual(["First"])
  expect(await getParts("deck")).toMatchObject({ ok: true })
})

it("removes an account's device copies and journal, and the database once nothing is left", async () => {
  const journal = new Map<string, string>()
  await connect(memoryRemote()).enqueue("deck", "First", node, "file")
  signInAs(secondAccount)
  await connect(memoryRemote()).enqueue("deck", "Second", node, "file")
  keepUnsaved(memoryShelf(journal), secondAccount, "deck", "x", { kind: "text", node, floor: "f", value: "v" })
  await dropAccount(secondAccount, memoryShelf(journal))
  expect([...journal.keys()]).toEqual([])
  expect((await allKeys()).every((key) => key.startsWith(firstAccount))).toBe(true)
  signInAs(firstAccount)
  expect((await connect(memoryRemote()).pending("deck")).map((row) => row.value)).toEqual(["First"])
  await dropAccount(firstAccount, memoryShelf(journal))
  expect(await allKeys()).toEqual([])
})

it(`removes a deck not opened for ${String(idleDays)} days only when everything of it was sent`, async () => {
  const journal = new Map<string, string>()
  const { remote } = countingRemote()
  let now = 1_000 * day
  const cache = connect(remote, { shelf: memoryShelf(journal), now: () => now })
  for (const deck of ["sent", "unsent", "recent", "original"]) {
    await putParts(deck, parts, () => now)
    await cache.enqueue(deck, `Text of ${deck}`, node, "file")
  }
  await cache.flush("sent")
  await cache.flush("original")
  await queueOriginal("original")
  now += (idleDays - 1) * day
  signInAs(firstAccount)
  const later = connect(remote, { shelf: memoryShelf(journal), now: () => now })
  await later.openDeck("recent")
  await later.flush("recent")
  keepUnsaved(memoryShelf(journal), firstAccount, "never-opened", "j", {
    kind: "text",
    node,
    floor: "file",
    value: "Journaled, deck never opened again",
  })
  now += 2 * day
  expect([...(await later.sweep())].sort()).toEqual(["sent"])
  expect(await getParts("sent")).toEqual({ ok: false, refusal: "absent" })
  expect(await later.pending("sent")).toEqual([])
  expect((await later.pending("unsent")).map((row) => row.value)).toEqual(["Text of unsent"])
  expect(await getParts("original")).toMatchObject({ ok: true })
  expect(await getParts("recent")).toMatchObject({ ok: true })
  expect([...journal.keys()]).toEqual([])
  expect((await later.pending("never-opened")).map((row) => row.value)).toEqual(["Journaled, deck never opened again"])
})

it(`keeps a deck not opened for ${String(idleDays)} days while its new name is not sent`, async () => {
  const { remote } = countingRemote()
  let now = 1_000 * day
  const cache = connect(remote, { now: () => now })
  for (const deck of ["sent", "renamed"]) {
    await putParts(deck, parts, () => now)
    await cache.enqueue(deck, `Text of ${deck}`, node, "file")
    await cache.flush(deck)
  }
  await queueRename("renamed", "New name")
  now += (idleDays + 1) * day
  expect([...(await cache.sweep())]).toEqual(["sent"])
  expect(await getParts("renamed")).toMatchObject({ ok: true })
})

it(`keeps a deck not opened for ${String(idleDays)} days while a picture's bytes are not sent`, async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  const { remote } = countingRemote()
  let now = 1_000 * day
  const cache = connect(remote, { now: () => now })
  for (const deck of ["sent", "picture"]) {
    await putParts(deck, parts, () => now)
    await cache.enqueue(deck, `Text of ${deck}`, node, "file")
    await cache.flush(deck)
  }
  await keepMedia("picture", picture)
  now += (idleDays + 1) * day
  expect([...(await cache.sweep())]).toEqual(["sent"])
  expect(await getParts("picture")).toMatchObject({ ok: true })
})

it("lets the account that added a picture read its bytes from the device, and never another account on the same browser", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  const sha256 = await keepMedia("deck", picture)
  expect((await readMedia("deck", [sha256])).get(sha256)).toEqual(picture)
  signInAs(secondAccount)
  expect([...(await readMedia("deck", [sha256])).keys()]).toEqual([])
  await keepMedia("other-deck", picture)
  expect([...(await readMedia("deck", [sha256])).keys()]).toEqual([])
  signInAs(firstAccount)
  expect((await readMedia("deck", [sha256])).get(sha256)).toEqual(picture)
})

it("never lists a picture waiting to upload among the deck's chats", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  await keepMedia("deck", picture)
  expect(await readChats("deck")).toEqual([])
})

it("shows a queued deck name only to the account that typed it, and to no one signed out", async () => {
  vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
  signInAs(firstAccount)
  await queueRename("deck-named", "Mine")
  signInAs(secondAccount)
  expect([...(await sendQueuedNames(["deck-named"]))]).toEqual([])
  signInAs(undefined)
  expect([...(await sendQueuedNames(["deck-named"]))]).toEqual([])
  signInAs(firstAccount)
  expect([...(await sendQueuedNames(["deck-named"]))]).toEqual([["deck-named", "Mine"]])
})
