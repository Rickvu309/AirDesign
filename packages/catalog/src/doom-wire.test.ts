import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { doomRoutes, doomPaths } from "./index.js"

const field = { ok: false, refusal: "field" }
const payload = { ok: false, refusal: "payload" }
const deck = "d1"

const folded = (id: string) => ({
  rev: 1,
  nodes: { [id]: { id, rev: 1, type: "deck", name: "Deck" } },
  revs: { [id]: { type: 1, name: 1 } },
  onces: { first: 1 },
  runs: {},
})

it("names the doom paths the web worker forwards, apart from the deck paths", () => {
  expect(doomPaths).toEqual([
    "/doom/create",
    "/doom/open",
    "/doom/edit",
    "/doom/since",
    "/doom/screenshots",
    "/doom/run",
  ])
})

it("reads a deck, an edit for a deck, and a catch-up cursor, and nothing else", () => {
  for (const route of [doomRoutes.create, doomRoutes.open]) {
    expect(route.read({ deck })).toEqual({ ok: true, deck })
    expect(route.read({ deck, extra: 1 })).toEqual(field)
    expect(route.read({ deck: "bad id" })).toEqual({ ok: false, refusal: "deck" })
  }
  const edit = { once: "o", author: { kind: "person", id: "me" }, writes: [] }
  expect(doomRoutes.edit.read({ deck, edit })).toEqual({ ok: true, deck, edit })
  expect(doomRoutes.edit.read({ deck })).toEqual(field)
  expect(doomRoutes.edit.read({ deck, edit: [] })).toEqual(field)
  expect(doomRoutes.edit.read({ deck, edit, once: "o" })).toEqual(field)
  expect(doomRoutes.since.read({ deck, rev: 3 })).toEqual({ ok: true, deck, rev: 3 })
  expect(doomRoutes.since.read({ deck, rev: 3, wait: true })).toEqual({ ok: true, deck, rev: 3, wait: true })
  expect(doomRoutes.since.read({ deck, rev: 3, wait: true, screenshots: true })).toEqual({
    ok: true,
    deck,
    rev: 3,
    wait: true,
    screenshots: true,
  })
  expect(doomRoutes.since.read({ deck, rev: 3, screenshots: "yes" })).toEqual(field)
  expect(doomRoutes.since.read({ deck, rev: -1 })).toEqual(field)
  expect(doomRoutes.since.read({ deck, rev: 1.5 })).toEqual(field)
  expect(doomRoutes.since.read({ deck, rev: 3, wait: "yes" })).toEqual(field)
})

it("decodes an opened doom deck into its fold and refuses a fold it cannot read", () => {
  const answer = { ok: true, deck, rev: 1, fold: folded("t:1") }
  const decoded = doomRoutes.open.result(answer)
  if (!decoded.ok) throw new Error("open")
  expect(decoded.deck).toBe(deck)
  expect(decoded.rev).toBe(1)
  expect(decoded.fold.nodes.get(doom.nodeId("t:1"))).toMatchObject({ type: "deck", name: "Deck" })
  expect(doomRoutes.create.result(answer)).toEqual(decoded)
  expect(doomRoutes.open.result({ ...answer, fold: { ...folded("t:1"), rev: -1 } })).toEqual(payload)
  expect(doomRoutes.open.result({ ...answer, rev: 2 })).toEqual(payload)
  expect(doomRoutes.open.result({ ok: true, deck })).toEqual(payload)
  expect(doomRoutes.open.result({ ok: false, refusal: "owner" })).toEqual({ ok: false, refusal: "owner" })
})

it("decodes the revision an edit landed at, or the doom's own refusal with the node and property", () => {
  expect(doomRoutes.edit.result({ ok: true, deck, rev: 4 })).toEqual({ ok: true, deck, rev: 4 })
  expect(doomRoutes.edit.result({ ok: true, deck, rev: -4 })).toEqual(payload)
  expect(doomRoutes.edit.result({ ok: true, deck })).toEqual(payload)
  const stale = { ok: false, refusal: "edit", refused: "stale", node: "t:1", prop: "text" }
  expect(doomRoutes.edit.result(stale)).toEqual(stale)
  expect(doomRoutes.edit.result({ ok: false, refusal: "edit", refused: "cycle" })).toEqual({
    ok: false,
    refusal: "edit",
    refused: "cycle",
  })
  expect(doomRoutes.edit.result({ ok: false, refusal: "edit", refused: "unknown" })).toEqual(payload)
  expect(doomRoutes.edit.result({ ok: false, refusal: "nonsense" })).toEqual(payload)
})

it("decodes a catch-up into the head and the landed edits as sent, left for the reader of the doom they land on", () => {
  const edit = { once: "o", author: { kind: "person", id: "me" }, writes: [], rev: 2 }
  expect(doomRoutes.since.result({ ok: true, deck, rev: 2, edits: [edit] })).toEqual({
    ok: true,
    deck,
    rev: 2,
    edits: [edit],
  })
  expect(doomRoutes.since.result({ ok: true, deck, rev: 2, edits: [], screenshots: true })).toEqual({
    ok: true,
    deck,
    rev: 2,
    edits: [],
    screenshots: true,
  })
  expect(doomRoutes.since.result({ ok: true, deck, rev: 2, edits: [], screenshots: "yes" })).toEqual({
    ok: true,
    deck,
    rev: 2,
    edits: [],
  })
  expect(doomRoutes.since.result({ ok: true, deck, rev: 2, edits: "none" })).toEqual(payload)
  expect(doomRoutes.since.result({ ok: true, deck, edits: [] })).toEqual(payload)
})

it("reads the slide keys and slide screenshots an open tab sends for a doom deck, and the slides still missing", () => {
  const key = "a".repeat(64)
  const screenshots = {
    keys: [{ slide: "t:3", key }],
    images: [{ slide: "t:3", key, type: "image/jpeg", data: "QUFB" }],
  }
  expect(doomRoutes.screenshots.read({ deck, rev: 4, screenshots })).toEqual({ ok: true, deck, rev: 4, screenshots })
  expect(doomRoutes.screenshots.read({ deck, rev: 4, screenshots: { keys: [], images: [] } })).toMatchObject({
    ok: true,
  })
  expect(doomRoutes.screenshots.read({ deck, rev: 4 })).toEqual(field)
  expect(
    doomRoutes.screenshots.read({ deck, rev: 4, screenshots: { ...screenshots, keys: [{ slide: "no id", key }] } }),
  ).toEqual(field)
  expect(doomRoutes.screenshots.read({ deck, rev: -1, screenshots })).toEqual(field)
  expect(doomRoutes.screenshots.result({ ok: true, deck, missing: ["t:3"] })).toEqual({
    ok: true,
    deck,
    missing: ["t:3"],
  })
  expect(doomRoutes.screenshots.result({ ok: true, deck, missing: [3] })).toEqual(payload)
  expect(doomRoutes.screenshots.result({ ok: false, refusal: "stale" })).toEqual({ ok: false, refusal: "stale" })
})

it("reads a run's id for a deck, and answers the run's edits with the values each one replaced", () => {
  expect(doomRoutes.run.read({ deck, run: "run-1" })).toEqual({ ok: true, deck, run: "run-1" })
  expect(doomRoutes.run.read({ deck, run: "" })).toEqual(field)
  expect(doomRoutes.run.read({ deck })).toEqual(field)
  expect(doomRoutes.run.read({ deck, run: "r", wait: true })).toEqual(field)
  const replaced = [[{ node: "s:4", key: "box", value: null, rev: null }]]
  const answer = { ok: true, deck, rev: 4, edits: [{ once: "a", rev: 3 }], replaced }
  expect(doomRoutes.run.result(answer)).toEqual(answer)
  expect(doomRoutes.run.result({ ...answer, replaced: {} })).toEqual(payload)
  expect(doomRoutes.run.result({ ...answer, replaced: [] })).toEqual(payload)
  expect(doomRoutes.run.result({ ...answer, edits: "none" })).toEqual(payload)
  expect(doomRoutes.run.result({ ok: false, refusal: "size" })).toEqual({ ok: false, refusal: "size" })
})
