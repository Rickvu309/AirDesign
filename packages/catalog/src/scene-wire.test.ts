import { scene } from "@airdesign/document"
import { expect, it } from "vitest"
import { sceneRoutes, scenePaths } from "./index.js"

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

it("names the scene paths the web worker forwards, apart from the deck paths", () => {
  expect(scenePaths).toEqual(["/scenes/create", "/scenes/open", "/scenes/edit", "/scenes/since", "/scenes/pictures"])
})

it("reads a deck, an edit for a deck, and a catch-up cursor, and nothing else", () => {
  for (const route of [sceneRoutes.create, sceneRoutes.open]) {
    expect(route.read({ deck })).toEqual({ ok: true, deck })
    expect(route.read({ deck, extra: 1 })).toEqual(field)
    expect(route.read({ deck: "bad id" })).toEqual({ ok: false, refusal: "deck" })
  }
  const edit = { once: "o", author: { kind: "person", id: "me" }, writes: [] }
  expect(sceneRoutes.edit.read({ deck, edit })).toEqual({ ok: true, deck, edit })
  expect(sceneRoutes.edit.read({ deck })).toEqual(field)
  expect(sceneRoutes.edit.read({ deck, edit: [] })).toEqual(field)
  expect(sceneRoutes.edit.read({ deck, edit, once: "o" })).toEqual(field)
  expect(sceneRoutes.since.read({ deck, rev: 3 })).toEqual({ ok: true, deck, rev: 3 })
  expect(sceneRoutes.since.read({ deck, rev: 3, wait: true })).toEqual({ ok: true, deck, rev: 3, wait: true })
  expect(sceneRoutes.since.read({ deck, rev: -1 })).toEqual(field)
  expect(sceneRoutes.since.read({ deck, rev: 1.5 })).toEqual(field)
  expect(sceneRoutes.since.read({ deck, rev: 3, wait: "yes" })).toEqual(field)
})

it("decodes an opened scene deck into its fold and refuses a fold it cannot read", () => {
  const answer = { ok: true, deck, rev: 1, fold: folded("t:1") }
  const decoded = sceneRoutes.open.result(answer)
  if (!decoded.ok) throw new Error("open")
  expect(decoded.deck).toBe(deck)
  expect(decoded.rev).toBe(1)
  expect(decoded.fold.nodes.get(scene.nodeId("t:1"))).toMatchObject({ type: "deck", name: "Deck" })
  expect(sceneRoutes.create.result(answer)).toEqual(decoded)
  expect(sceneRoutes.open.result({ ...answer, fold: { ...folded("t:1"), rev: -1 } })).toEqual(payload)
  expect(sceneRoutes.open.result({ ...answer, rev: 2 })).toEqual(payload)
  expect(sceneRoutes.open.result({ ok: true, deck })).toEqual(payload)
  expect(sceneRoutes.open.result({ ok: false, refusal: "owner" })).toEqual({ ok: false, refusal: "owner" })
})

it("decodes the revision an edit landed at, or the scene's own refusal with the node and property", () => {
  expect(sceneRoutes.edit.result({ ok: true, deck, rev: 4 })).toEqual({ ok: true, deck, rev: 4 })
  expect(sceneRoutes.edit.result({ ok: true, deck, rev: -4 })).toEqual(payload)
  expect(sceneRoutes.edit.result({ ok: true, deck })).toEqual(payload)
  const stale = { ok: false, refusal: "edit", refused: "stale", node: "t:1", prop: "text" }
  expect(sceneRoutes.edit.result(stale)).toEqual(stale)
  expect(sceneRoutes.edit.result({ ok: false, refusal: "edit", refused: "cycle" })).toEqual({
    ok: false,
    refusal: "edit",
    refused: "cycle",
  })
  expect(sceneRoutes.edit.result({ ok: false, refusal: "edit", refused: "unknown" })).toEqual(payload)
  expect(sceneRoutes.edit.result({ ok: false, refusal: "nonsense" })).toEqual(payload)
})

it("decodes a catch-up into the head and the landed edits as sent, left for the reader of the scene they land on", () => {
  const edit = { once: "o", author: { kind: "person", id: "me" }, writes: [], rev: 2 }
  expect(sceneRoutes.since.result({ ok: true, deck, rev: 2, edits: [edit] })).toEqual({
    ok: true,
    deck,
    rev: 2,
    edits: [edit],
  })
  expect(sceneRoutes.since.result({ ok: true, deck, rev: 2, edits: "none" })).toEqual(payload)
  expect(sceneRoutes.since.result({ ok: true, deck, edits: [] })).toEqual(payload)
})

it("reads the slide keys and slide pictures an open tab sends for a scene deck, and the slides still missing", () => {
  const key = "a".repeat(64)
  const pictures = { keys: [{ slide: "t:3", key }], images: [{ slide: "t:3", key, type: "image/jpeg", data: "QUFB" }] }
  expect(sceneRoutes.pictures.read({ deck, rev: 4, pictures })).toEqual({ ok: true, deck, rev: 4, pictures })
  expect(sceneRoutes.pictures.read({ deck, rev: 4, pictures: { keys: [], images: [] } })).toMatchObject({ ok: true })
  expect(sceneRoutes.pictures.read({ deck, rev: 4 })).toEqual(field)
  expect(
    sceneRoutes.pictures.read({ deck, rev: 4, pictures: { ...pictures, keys: [{ slide: "no id", key }] } }),
  ).toEqual(field)
  expect(sceneRoutes.pictures.read({ deck, rev: -1, pictures })).toEqual(field)
  expect(sceneRoutes.pictures.result({ ok: true, deck, missing: ["t:3"] })).toEqual({
    ok: true,
    deck,
    missing: ["t:3"],
  })
  expect(sceneRoutes.pictures.result({ ok: true, deck, missing: [3] })).toEqual(payload)
  expect(sceneRoutes.pictures.result({ ok: false, refusal: "stale" })).toEqual({ ok: false, refusal: "stale" })
})
