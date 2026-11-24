import { deckRoutes } from "@airdesign/catalog"
import { afterEach, expect, it, vi } from "vitest"
import { discardOpening } from "./discard-opening"
import { clearOpeningDeck, noteOpeningDeck, openingDeck } from "@/lib/first-request"

afterEach(() => {
  clearOpeningDeck()
  vi.unstubAllGlobals()
})

it("trashes and deletes the opening deck, then forgets it", async () => {
  const request = vi.fn(async (path: string) =>
    Response.json(path === deckRoutes.delete.path ? { ok: true, deleted: ["deck"] } : { ok: true }),
  )
  vi.stubGlobal("fetch", request)
  noteOpeningDeck("deck")
  expect(await discardOpening("deck")).toBe(true)
  expect(openingDeck()).toBeUndefined()
  expect(request).toHaveBeenCalledWith(
    deckRoutes.trash.path,
    expect.objectContaining({ body: JSON.stringify({ deck: "deck" }) }),
  )
  expect(request).toHaveBeenCalledWith(
    deckRoutes.delete.path,
    expect.objectContaining({ body: JSON.stringify({ decks: ["deck"] }) }),
  )
})

it("keeps the note when the deck is not there yet", async () => {
  const request = vi.fn(async () => Response.json({ ok: false }))
  vi.stubGlobal("fetch", request)
  noteOpeningDeck("deck")
  expect(await discardOpening("deck")).toBe(false)
  expect(openingDeck()).toBe("deck")
  expect(request).toHaveBeenCalledOnce()
})

it("keeps the note when the delete does not include the deck", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      Response.json(path === deckRoutes.delete.path ? { ok: true, deleted: [] } : { ok: true }),
    ),
  )
  noteOpeningDeck("deck")
  expect(await discardOpening("deck")).toBe(false)
  expect(openingDeck()).toBe("deck")
})

it("keeps the note when the network fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
  noteOpeningDeck("deck")
  expect(await discardOpening("deck")).toBe(false)
  expect(openingDeck()).toBe("deck")
})

it("does not forget a different deck that is still opening", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      Response.json(path === deckRoutes.delete.path ? { ok: true, deleted: ["deck"] } : { ok: true }),
    ),
  )
  noteOpeningDeck("other")
  expect(await discardOpening("deck")).toBe(true)
  expect(openingDeck()).toBe("other")
})
