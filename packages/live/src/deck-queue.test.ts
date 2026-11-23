import { deckRoutes } from "@airdesign/catalog"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  firstAccount,
  installSlowIndexedDb,
  memoryShelf,
  secondAccount,
  signInAs,
  slowStore,
} from "./browser-fixtures.js"
import { deleteDatabase, dropAccount, dropDeck, sendQueued, starDeck } from "./index.js"

const slow = slowStore()
let shelf = new Map<string, string>()

type Sent = { readonly path: string; readonly body: Record<string, unknown> }

function answering(sent: Sent[]) {
  return async (path: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    sent.push({ path, body })
    return new Response(JSON.stringify({ ok: true, ...body }))
  }
}

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function leftBeforeTheDeviceWrite(change: () => Promise<unknown>) {
  slow.hold()
  void change().catch(() => undefined)
  await tick()
  slow.drop()
}

async function stars(decks: string[]): Promise<[string, boolean][]> {
  return [...(await sendQueued(decks))]
}

beforeEach(async () => {
  installSlowIndexedDb(slow)
  shelf = new Map()
  vi.stubGlobal("window", {})
  vi.stubGlobal("localStorage", memoryShelf(shelf))
  vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")))
})

afterEach(async () => {
  slow.drop()
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("keeps a star whose device write never landed and sends it once from the next page", async () => {
  await leftBeforeTheDeviceWrite(() => starDeck("deck-one", true))
  expect(shelf.size).toBe(1)
  const sent: Sent[] = []
  vi.stubGlobal("fetch", answering(sent))
  expect(await stars(["deck-one"])).toEqual([["deck-one", true]])
  await expect.poll(() => sent).toEqual([{ path: deckRoutes.star.path, body: { deck: "deck-one", starred: true } }])
  expect(shelf.size).toBe(0)
  expect(await stars(["deck-one"])).toEqual([])
  expect(sent).toHaveLength(1)
})

it("keeps the newest choice when several never reached the device, and over an older one that did", async () => {
  await starDeck("deck-one", true)
  await leftBeforeTheDeviceWrite(async () => {
    void starDeck("deck-one", false)
    void starDeck("deck-one", true)
    await starDeck("deck-one", false)
  })
  expect(await stars(["deck-one"])).toEqual([["deck-one", false]])
})

it("applies a shelved change that also reached the device once", async () => {
  await starDeck("deck-one", true)
  expect(shelf.size).toBe(0)
  shelf.set(`airdesign:queued:${firstAccount}:deck-one\u0003star`, "starred")
  const sent: Sent[] = []
  vi.stubGlobal("fetch", answering(sent))
  expect(await stars(["deck-one"])).toEqual([["deck-one", true]])
  await expect.poll(() => sent).toHaveLength(1)
  expect(await stars(["deck-one"])).toEqual([])
  await tick()
  expect(sent).toHaveLength(1)
  expect(shelf.size).toBe(0)
})

it("gives a shelved change only to the account that made it, and to no one signed out", async () => {
  await leftBeforeTheDeviceWrite(() => starDeck("deck-one", true))
  signInAs(secondAccount)
  expect(await stars(["deck-one"])).toEqual([])
  signInAs(undefined)
  expect(await stars(["deck-one"])).toEqual([])
  expect(shelf.size).toBe(1)
  signInAs(firstAccount)
  expect(await stars(["deck-one"])).toEqual([["deck-one", true]])
})

it("drops a deck's shelved changes with the deck, and an account's with the account", async () => {
  await leftBeforeTheDeviceWrite(async () => {
    void starDeck("deck-one", true)
    await starDeck("deck-two", true)
  })
  signInAs(secondAccount)
  await leftBeforeTheDeviceWrite(() => starDeck("deck-one", true))
  signInAs(firstAccount)
  await dropDeck("deck-one")
  expect([...shelf.keys()].sort()).toEqual([
    `airdesign:queued:${firstAccount}:deck-two\u0003star`,
    `airdesign:queued:${secondAccount}:deck-one\u0003star`,
  ])
  await dropAccount(firstAccount)
  expect([...shelf.keys()]).toEqual([`airdesign:queued:${secondAccount}:deck-one\u0003star`])
})
