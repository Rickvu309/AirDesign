import { deckRoutes } from "@airdesign/catalog"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { firstAccount, installIndexedDb, signInAs } from "./browser-fixtures.js"
import { secondAccount } from "./testing/browser-shelf.js"
import { answeringServer } from "./testing/answering-server.js"
import { deleteDatabase, sendQueued, starDeck } from "./index.js"

const star = (deck: string, starred: boolean) => ({ path: deckRoutes.star.path, body: { deck, starred } })

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

async function queuedStars(decks: string[]): Promise<[string, boolean][]> {
  return [...(await sendQueued(decks))]
}

it("sends a star to the server and keeps nothing queued once it lands", async () => {
  const server = answeringServer()
  vi.stubGlobal("fetch", server.fetch)
  await expect(starDeck("deck-one", true)).resolves.toEqual({ ok: true })
  expect(server.sent).toEqual([star("deck-one", true)])
  expect(await queuedStars(["deck-one"])).toEqual([])
})

it("keeps a star the server did not take, shows it on Home and sends it from there once", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  await expect(starDeck("deck-one", true)).resolves.toEqual({ ok: false })
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, refusal: "server" }), { status: 500 }))
  expect(await queuedStars(["deck-one", "deck-two"])).toEqual([["deck-one", true]])
  const server = answeringServer()
  vi.stubGlobal("fetch", server.fetch)
  expect(await queuedStars(["deck-one", "deck-two"])).toEqual([["deck-one", true]])
  expect(await server.drained(() => queuedStars(["deck-one"]))).toEqual([star("deck-one", true)])
})

it("sends only the last choice when a deck was starred and the star removed while offline", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  await starDeck("deck-one", true)
  await starDeck("deck-one", false)
  expect(await queuedStars(["deck-one"])).toEqual([["deck-one", false]])
  const server = answeringServer()
  vi.stubGlobal("fetch", server.fetch)
  expect(await server.drained(() => queuedStars(["deck-one"]))).toEqual([star("deck-one", false)])
})

it("never has two stars of one deck in flight, so the last choice is the one the server keeps", async () => {
  let open = 0
  let most = 0
  const sent: boolean[] = []
  vi.stubGlobal("fetch", async (_path: string, init: RequestInit) => {
    const body: { deck: string; starred: boolean } = JSON.parse(String(init.body))
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
