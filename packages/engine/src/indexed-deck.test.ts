import { describe, expect, it } from "vitest"
import { elementId } from "@airdesign/document"
import { readDeckId } from "@airdesign/catalog"
import { call, indexDeck, openDeck, readDeckPage } from "./index.js"

const node = elementId("258.7")
const box = { x: 10, y: 20, cx: 30, cy: 40 }
const parsed = readDeckId("indexed")
if (!parsed.ok) throw new Error("deck")
const initial = openDeck(parsed.deck)
const page = {
  deck: initial.id,
  once: "first",
  offset: 0,
  total: 1,
  slides: [{ id: "258", position: 0 }],
  elements: [{ node, kind: "shape", value: "Title", box, grouped: false }],
}

it("reads untouched floors at revision and version zero then edits with readAt zero", () => {
  const indexed = indexDeck(initial, { actor: "person" }, page)
  if (!indexed.ok) throw new Error(indexed.refusal)
  expect(indexed.deck.revision).toBe(0)
  expect(indexed.deck.register.nodes).toEqual(initial.register.nodes)
  expect(readDeckPage(indexed.deck, { runId: null })).toMatchObject({
    revision: 0,
    index: "ready",
    slides: page.slides,
    elements: [{ node, slide: "258", kind: "shape", value: "Title", box, version: 0 }],
  })
  const start = call(
    "start_run",
    indexed.deck,
    { actor: "agent", runId: "run" },
    { deck: initial.id, runId: "run", elements: [{ node }] },
  )
  if (!start.ok) throw new Error(start.refusal)
  const edit = call(
    "edit_deck",
    start.deck,
    { actor: "agent", runId: "run" },
    { deck: initial.id, base: start.deck.revision, changes: [{ node, value: "After", readAt: 0 }] },
  )
  if (!edit.ok) throw new Error(edit.refusal)
  expect(readDeckPage(edit.deck, { runId: "run" }).elements).toMatchObject([{ value: "After", box, version: 1 }])
})

describe("index access and group boxes", () => {
  it("refuses an agent upload", () => {
    expect(indexDeck(initial, { actor: "agent", runId: "run" }, page)).toEqual({ ok: false, refusal: "field" })
  })
  it("refuses box edits to group children but keeps text editable", () => {
    const indexed = indexDeck(
      initial,
      { actor: "person" },
      { ...page, elements: [{ ...page.elements[0], grouped: true }] },
    )
    if (!indexed.ok) throw new Error(indexed.refusal)
    expect(
      call(
        "commit_edits",
        indexed.deck,
        { actor: "person" },
        { deck: initial.id, batch: [{ node, property: "box", value: box }] },
      ),
    ).toEqual({ ok: false, refusal: "group-box" })
    expect(
      call("commit_edits", indexed.deck, { actor: "person" }, { deck: initial.id, batch: [{ node, value: "After" }] })
        .ok,
    ).toBe(true)
  })
})
