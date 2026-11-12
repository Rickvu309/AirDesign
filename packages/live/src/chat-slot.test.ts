import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { deleteDatabase, dropChats, readChats, writeChat } from "./index.js"
import { readRows, readSlot, rowKey, writeSlot } from "./store.js"
import { writeRows } from "./browser-fixtures.js"

async function readSlotsLeft(): Promise<string[]> {
  const found: string[] = []
  for (const key of ["deckone\u0001", "deckone\u0002page", "deckone\u0003original"]) {
    if ((await readSlot(key)) !== null) found.push(key)
  }
  return found
}

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

describe("a deck's chats on this device", () => {
  it("keeps each chat by id beside the deck's rows, and reads only that deck's chats", async () => {
    await writeChat("deckone", { id: "a", text: "first" })
    await writeChat("deckone", { id: "b", text: "second" })
    await writeChat("deckone", { id: "a", text: "first, longer" })
    await writeChat("decktwo", { id: "c", text: "other deck" })
    expect(await readChats("deckone")).toEqual([
      { id: "a", text: "first, longer" },
      { id: "b", text: "second" },
    ])
    expect(await readChats("decktwo")).toEqual([{ id: "c", text: "other deck" }])
  })

  it("drops the named chats, or every chat of the deck, and leaves its rows and other decks alone", async () => {
    await writeRows(
      [
        {
          key: rowKey("deckone", "confirmed", 0),
          row: { kind: "confirmed", deck: "deckone" as never, revision: 0, value: "kept" },
        },
      ],
      [],
    )
    for (const id of ["a", "b", "c"]) await writeChat("deckone", { id })
    await writeChat("decktwo", { id: "d" })
    await dropChats("deckone", ["a"])
    expect(await readChats("deckone")).toEqual([{ id: "b" }, { id: "c" }])
    await dropChats("deckone")
    expect(await readChats("deckone")).toEqual([])
    expect(await readChats("decktwo")).toEqual([{ id: "d" }])
    expect(await readRows("deckone")).toHaveLength(1)
  })

  it("never reads or drops the deck's other slots, such as its index and its queued original", async () => {
    await writeSlot("deckone\u0002page", { id: "index" })
    await writeSlot("deckone\u0003original", { id: "original" })
    await writeSlot("deckone\u0001", { id: "parts" })
    await writeChat("deckone", { id: "a" })
    expect(await readChats("deckone")).toEqual([{ id: "a" }])
    await dropChats("deckone")
    expect(await readChats("deckone")).toEqual([])
    await dropChats("deckone", ["index", "original", "parts"])
    expect(await readSlotsLeft()).toEqual(["deckone\u0001", "deckone\u0002page", "deckone\u0003original"])
  })

  it("is gone when the account's data on this device is deleted", async () => {
    await writeChat("deckone", { id: "a" })
    await deleteDatabase()
    expect(await readChats("deckone")).toEqual([])
  })

  it("refuses a deck id the catalog would not read and a chat with no id", async () => {
    await expect(writeChat("bad deck", { id: "a" })).rejects.toThrow("deck")
    await expect(writeChat("deckone", { id: "" })).rejects.toThrow("chat")
  })
})
