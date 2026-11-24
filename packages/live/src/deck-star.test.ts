import { deckRoutes } from "@airdesign/catalog"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { firstAccount, installIndexedDb, signInAs } from "./browser-fixtures.js"
import { secondAccount } from "./testing/browser-shelf.js"
import { deleteDatabase, sendQueued, starDeck } from "./index.js"

type Sent = { deck: string; starred: boolean }

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function answering(sent: Sent[]) {
  return async (path: string, init: RequestInit) => {
    expect(path).toBe(deckRoutes.star.path)
    const body: Sent = JSON.parse(String(init.body))
    sent.push(body)
    return new Response(JSON.stringify({ ok: true, deck: body.deck, starred: body.starred }))
  }
}

async function queuedStars(decks: string[]): Promise<[string, boolean][]> {
  return [...(await sendQueued(decks))]
}

it("sends a star to the server and keeps nothing queued once it lands", async () => {
  const sent: Sent[] = []
  vi.stubGlobal("fetch", answering(sent))
  await expect(starDeck("deck-one", true)).resolves.toEqual({ ok: true })
  expect(sent).toEqual([{ deck: "deck-one", starred: true }])
  expect(await queuedStars(["deck-one"])).toEqual([])
})

it("keeps a star the server did not take, shows it on Home and sends it from there once", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  await expect(starDeck("deck-one", true)).resolves.toEqual({ ok: false })
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, refusal: "server" }), { status: 500 }))
  expect(await queuedStars(["deck-one", "deck-two"])).toEqual([["deck-one", true]])
  const sent: Sent[] = []
  vi.stubGlobal("fetch", answering(sent))
  expect(await queuedStars(["deck-one", "deck-two"])).toEqual([["deck-one", true]])
  await expect.poll(() => sent).toEqual([{ deck: "deck-one", starred: true }])
  await expect.poll(() => queuedStars(["deck-one"])).toEqual([])
  expect(sent).toHaveLength(1)
})

it("sends only the last choice when a deck was starred and the star removed while offline", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  await starDeck("deck-one", true)
  await starDeck("deck-one", false)
  expect(await queuedStars(["deck-one"])).toEqual([["deck-one", false]])
  const sent: Sent[] = []
  vi.stubGlobal("fetch", answering(sent))
  await expect.poll(() => queuedStars(["deck-one"])).toEqual([])
  expect(sent).toEqual([{ deck: "deck-one", starred: false }])
})

it("never has two stars of one deck in flight, so the last choice is the one the server keeps", async () => {
  let open = 0
  let most = 0
  const sent: boolean[] = []
  vi.stubGlobal("fetch", async (_path: string, init: RequestInit) => {
    const body: Sent = JSON.parse(String(init.body))
    open++
    most = Math.max(most, open)
    await new Promise((resolve) => setTimeout(resolve, 20))
    open--
    sent.push(body.starred)
    return new Response(JSON.stringify({ ok: true, deck: body.deck, starred: body.starred }))
  })
  await Promise.all([starDeck("deck-one", true), starDeck("deck-one", false)])
  expect(most).toBe(1)
  expect(sent.at(-1)).toBe(false)
})

it("shows a queued star only to the account that starred the deck, and to no one signed out", async () => {
  vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
  signInAs(firstAccount)
  await starDeck("deck-one", true)
  signInAs(secondAccount)
  expect(await queuedStars(["deck-one"])).toEqual([])
  signInAs(undefined)
  expect(await queuedStars(["deck-one"])).toEqual([])
  signInAs(firstAccount)
  expect(await queuedStars(["deck-one"])).toEqual([["deck-one", true]])
})
