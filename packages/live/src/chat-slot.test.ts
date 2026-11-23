import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { firstAccount, installIndexedDb, memoryShelf, secondAccount, signInAs } from "./browser-fixtures.js"
import {
  deleteDatabase,
  dropAccount,
  dropChats,
  dropDeck,
  readChats,
  shelveChats,
  takeShelvedChats,
  writeChat,
} from "./index.js"
import { dropShelvedChats } from "./chat-slot.js"
import { doomFoldKey, doomQueueKey } from "./doom-storage.js"
import { readSlot, writeSlot } from "./store.js"

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
  it("reads none of the deck's Doom slots as chats, and dropping the chats keeps them", async () => {
    await writeSlot(doomFoldKey("deckone"), { id: "fold", rev: 3 })
    await writeSlot(doomQueueKey("deckone"), [{ id: "queued" }])
    await writeChat("deckone", { id: "a", text: "first" })
    expect(await readChats("deckone")).toEqual([{ id: "a", text: "first" }])
    await dropChats("deckone")
    expect(await readSlot(doomFoldKey("deckone"))).toEqual({ id: "fold", rev: 3 })
    expect(await readSlot(doomQueueKey("deckone"))).toEqual([{ id: "queued" }])
  })

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

  it("drops the named chats, or every chat of the deck, and leaves other decks alone", async () => {
    await writeSlot("deckone\u0003star", "starred")
    for (const id of ["a", "b", "c"]) await writeChat("deckone", { id })
    await writeChat("decktwo", { id: "d" })
    await dropChats("deckone", ["a"])
    expect(await readChats("deckone")).toEqual([{ id: "b" }, { id: "c" }])
    await dropChats("deckone")
    expect(await readChats("deckone")).toEqual([])
    expect(await readChats("decktwo")).toEqual([{ id: "d" }])
    expect(await readSlot("deckone\u0003star")).toBe("starred")
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

describe("a deck's chats shelved on the page as it closes", () => {
  const own = (deck: string) => `airdesign:chats:${firstAccount}:${deck}`

  it("are taken once by the next page, newest copy of each id, beside the deck's other chats", () => {
    const shelf = memoryShelf()
    shelveChats("deckone", [{ id: "a", text: "first" }], shelf)
    shelveChats(
      "deckone",
      [
        { id: "a", text: "first, longer" },
        { id: "b", text: "second" },
      ],
      shelf,
    )
    shelveChats("decktwo", [{ id: "c", text: "other deck" }], shelf)
    expect(takeShelvedChats("deckone", shelf)).toEqual([
      { id: "a", text: "first, longer" },
      { id: "b", text: "second" },
    ])
    expect(takeShelvedChats("deckone", shelf)).toEqual([])
    expect(takeShelvedChats("decktwo", shelf)).toEqual([{ id: "c", text: "other deck" }])
  })

  it("leave nothing behind when there is nothing to shelve, and read nothing that is not a chat", () => {
    const held = new Map<string, string>()
    const shelf = memoryShelf(held)
    shelveChats("deckone", [], shelf)
    expect(held.size).toBe(0)
    held.set(own("deckone"), JSON.stringify([{ id: "" }, "words", { id: "a" }]))
    expect(takeShelvedChats("deckone", shelf)).toEqual([{ id: "a" }])
    held.set(own("deckone"), "{not json")
    expect(takeShelvedChats("deckone", shelf)).toEqual([])
  })

  it("are dropped for one deck, or for the whole account, and leave the unsaved edits and other accounts alone", () => {
    const held = new Map<string, string>([["airdesign:unsaved:deckone", "[]"]])
    const shelf = memoryShelf(held)
    shelveChats("deckone", [{ id: "a" }], shelf)
    shelveChats("decktwo", [{ id: "b" }], shelf)
    shelveChats("deckthree", [{ id: "c" }], shelf)
    signInAs(secondAccount)
    shelveChats("deckone", [{ id: "d" }], shelf)
    dropShelvedChats(firstAccount, "deckone", shelf)
    expect([...held.keys()].sort()).toEqual(
      [
        own("deckthree"),
        own("decktwo"),
        `airdesign:chats:${secondAccount}:deckone`,
        "airdesign:unsaved:deckone",
      ].sort(),
    )
    dropShelvedChats(firstAccount, undefined, shelf)
    expect([...held.keys()].sort()).toEqual([`airdesign:chats:${secondAccount}:deckone`, "airdesign:unsaved:deckone"])
  })

  it("are dropped with the deck's chats when the deck is deleted for good", async () => {
    const held = new Map<string, string>()
    vi.stubGlobal("window", {})
    vi.stubGlobal("localStorage", memoryShelf(held))
    shelveChats("deckone", [{ id: "a" }])
    shelveChats("decktwo", [{ id: "b" }])
    await dropChats("deckone", ["a"])
    expect(held.has(own("deckone"))).toBe(true)
    await dropChats("deckone")
    expect([...held.keys()]).toEqual([own("decktwo")])
  })

  it("lose nothing but the shelf when the page's storage is full", () => {
    const shelf = {
      ...memoryShelf(),
      setItem: () => {
        throw new Error("QuotaExceededError")
      },
    }
    expect(() => shelveChats("deckone", [{ id: "a" }], shelf)).not.toThrow()
    expect(takeShelvedChats("deckone", shelf)).toEqual([])
  })
})

describe("chats shelved on a browser two accounts share", () => {
  it("are read by the account that shelved them and by no one else, signed out or signed in as another", () => {
    const held = new Map<string, string>()
    const shelf = memoryShelf(held)
    shelveChats("deckone", [{ id: "first", text: "mine" }], shelf)
    signInAs(undefined)
    expect(takeShelvedChats("deckone", shelf)).toEqual([])
    shelveChats("deckone", [{ id: "nobody" }], shelf)
    expect(held.size).toBe(1)
    signInAs(secondAccount)
    expect(takeShelvedChats("deckone", shelf)).toEqual([])
    shelveChats("deckone", [{ id: "second", text: "theirs" }], shelf)
    signInAs(firstAccount)
    expect(takeShelvedChats("deckone", shelf)).toEqual([{ id: "first", text: "mine" }])
    signInAs(secondAccount)
    expect(takeShelvedChats("deckone", shelf)).toEqual([{ id: "second", text: "theirs" }])
  })

  it("go when an account's device copy is dropped, for that account only", async () => {
    const held = new Map<string, string>()
    const shelf = memoryShelf(held)
    await writeChat("deckone", { id: "first" })
    shelveChats("deckone", [{ id: "first" }], shelf)
    signInAs(secondAccount)
    await writeChat("deckone", { id: "second" })
    shelveChats("deckone", [{ id: "second" }], shelf)
    await dropAccount(secondAccount, shelf)
    expect([...held.keys()]).toEqual([`airdesign:chats:${firstAccount}:deckone`])
    signInAs(firstAccount)
    expect(await readChats("deckone")).toEqual([{ id: "first" }])
    expect(takeShelvedChats("deckone", shelf)).toEqual([{ id: "first" }])
  })

  it("go with the deck's device copy when it is removed, for this account only", async () => {
    const held = new Map<string, string>()
    const shelf = memoryShelf(held)
    shelveChats("deckone", [{ id: "a" }], shelf)
    shelveChats("decktwo", [{ id: "b" }], shelf)
    signInAs(secondAccount)
    shelveChats("deckone", [{ id: "c" }], shelf)
    await dropDeck("deckone", shelf)
    expect([...held.keys()].sort()).toEqual(
      [`airdesign:chats:${firstAccount}:deckone`, `airdesign:chats:${firstAccount}:decktwo`].sort(),
    )
  })
})
