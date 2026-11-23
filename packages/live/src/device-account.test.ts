import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { firstAccount, installIndexedDb, installParts, secondAccount, signInAs } from "./browser-fixtures.js"
import { finished, storeName, transaction } from "./device.js"
import { deleteDatabase, dropAccount, dropDeck, keepMedia, readChats, readMedia, writeChat } from "./index.js"
import { deviceStorage } from "./doom-storage.js"

const picture = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 4, 5, 6])
const edit = { once: "kept", author: { kind: "person" as const, id: "tab" }, writes: [] }

beforeEach(() => {
  installIndexedDb()
  installParts()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

async function allKeys(): Promise<string[]> {
  const reading = await transaction("readonly")
  const request = reading.objectStore(storeName).getAllKeys()
  return finished(reading, () => request.result.map(String))
}

async function queued(deck: string): Promise<number | undefined> {
  return (await deviceStorage(deck).read())?.queue.length
}

it("never shows one account's queued edits or chats to another account on the same browser", async () => {
  await deviceStorage("deck").write({ queue: [{ edit, after: [] }] })
  await writeChat("talked", { id: "chat" })
  signInAs(secondAccount)
  expect(await queued("deck")).toBeUndefined()
  expect(await readChats("talked")).toEqual([])
  await dropDeck("deck")
  await dropDeck("talked")
  signInAs(firstAccount)
  expect(await queued("deck")).toBe(1)
  expect(await readChats("talked")).toEqual([{ id: "chat" }])
})

it("shows nothing and keeps nothing while no one is signed in", async () => {
  await deviceStorage("deck").write({ queue: [{ edit, after: [] }] })
  signInAs(undefined)
  expect(await queued("deck")).toBeUndefined()
  await expect(deviceStorage("deck").write({ queue: [] })).rejects.toThrow("session")
  signInAs(firstAccount)
  expect(await queued("deck")).toBe(1)
})

it("removes a deck's device copy for this account only", async () => {
  await deviceStorage("deck").write({ queue: [{ edit, after: [] }] })
  signInAs(secondAccount)
  await deviceStorage("deck").write({ queue: [{ edit, after: [] }] })
  await dropDeck("deck")
  expect(await queued("deck")).toBeUndefined()
  signInAs(firstAccount)
  expect(await queued("deck")).toBe(1)
})

it("removes an account's device copies, and the database once nothing is left", async () => {
  await deviceStorage("deck").write({ queue: [{ edit, after: [] }] })
  signInAs(secondAccount)
  await deviceStorage("deck").write({ queue: [{ edit, after: [] }] })
  await dropAccount(secondAccount)
  expect((await allKeys()).every((key) => key.startsWith(firstAccount))).toBe(true)
  signInAs(firstAccount)
  expect(await queued("deck")).toBe(1)
  await dropAccount(firstAccount)
  expect(await allKeys()).toEqual([])
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
