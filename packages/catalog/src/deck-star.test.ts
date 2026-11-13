import { expect, it } from "vitest"
import { deckPaths, deckRoutes, readStar } from "./index.js"

const field = { ok: false, refusal: "field" }
const payload = { ok: false, refusal: "payload" }

it("reads a star or its removal for one deck", () => {
  expect(readStar({ deck: "d", starred: true })).toEqual({ ok: true, deck: "d", starred: true })
  expect(readStar({ deck: "d", starred: false })).toEqual({ ok: true, deck: "d", starred: false })
})

it("refuses a star without a yes or no, with more fields, or for a bad deck id", () => {
  expect(readStar({ deck: "d" })).toEqual(field)
  expect(readStar({ starred: true })).toEqual(field)
  expect(readStar({ deck: "d", starred: "true" })).toEqual(field)
  expect(readStar({ deck: "d", starred: 1 })).toEqual(field)
  expect(readStar({ deck: "d", starred: true, name: "x" })).toEqual(field)
  expect(readStar([])).toEqual(field)
  expect(readStar({ deck: "bad id", starred: true })).toEqual({ ok: false, refusal: "deck" })
})

it("decodes the star answer and refuses one without the deck or the star", () => {
  const starred = { ok: true, deck: "deck", starred: true }
  expect(deckRoutes.star.result(starred)).toEqual(starred)
  expect(deckRoutes.star.result({ ok: true, deck: "deck" })).toEqual(payload)
  expect(deckRoutes.star.result({ ...starred, starred: null })).toEqual(payload)
  expect(deckRoutes.star.result({ ...starred, deck: "bad deck" })).toEqual(payload)
  expect(deckRoutes.star.result({ ok: false, refusal: "owner" })).toEqual({ ok: false, refusal: "owner" })
})

it("lists whether each deck is starred and refuses a star that is not yes or no", () => {
  const row = { deck: "deck", name: "", edited: "2026-11-11", created: "2026-11-10", starred: true }
  const listed = { ok: true, account: { email: "wire@example.com" }, decks: [row], trash: [] }
  expect(deckRoutes.list.result(listed)).toEqual(listed)
  expect(deckRoutes.list.result({ ...listed, decks: [{ ...row, starred: "yes" }] })).toEqual(payload)
})

it("puts the star path among the deck paths the web worker forwards", () => {
  expect(deckRoutes.star.path).toBe("/decks/star")
  expect(deckPaths).toContain("/decks/star")
})
