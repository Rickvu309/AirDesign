import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"

import { changeCall } from "./call-fixtures.js"
import { indexDeck, openDeck, readDeckPage } from "./index.js"

const actor = { actor: "agent", runId: "run" } as const
const placed = { x: 609_600, y: 381_000, cx: 10_972_800, cy: 762_000 }
const row = (node: string, role: "title" | "body") =>
  ({ node: elementId(node), kind: "shape", value: "", box: null, grouped: false, role, placed }) as const
const title = { role: "title", box: { x: 48, y: 30, w: 864, h: 60 } }
const body = { role: "body", box: { x: 48, y: 30, w: 864, h: 60 } }

function opened() {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const result = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 0,
      layouts: [
        { part: "ppt/slideLayouts/slideLayout1.xml", name: "Title Only", floor: [row("256.2", "title")] },
        {
          part: "ppt/slideLayouts/slideLayout2.xml",
          name: "Two Content",
          floor: [row("256.2", "title"), row("256.3", "body"), row("256.4", "body")],
        },
        { part: "ppt/slideLayouts/slideLayout3.xml", name: "Blank", floor: [] },
      ],
      slides: [{ id: "256", position: 0, layout: [] }],
      elements: [],
    },
  )
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

it("reads the deck's layouts with an id, a name and the placeholders each gives a slide", () => {
  expect(readDeckPage(opened(), { runId: null }).layouts).toEqual([
    { id: "L1", name: "Title Only", placeholders: [title] },
    { id: "L2", name: "Two Content", placeholders: [title, body, body] },
    { id: "L3", name: "Blank", placeholders: [] },
  ])
  expect(readDeckPage(opened(), { runId: null, cursor: "256.1" }).layouts).toBeUndefined()
})

it("adds a slide on the layout an agent names, with that layout's placeholders", () => {
  const result = changeCall("add_slide", opened(), actor, { deck: "deck", base: 0, layout: "L2" })
  if (!result.ok) throw new Error(result.refusal)
  expect(result.deck.register.order.at(-1)).toMatchObject({
    slide: "add",
    id: "257",
    after: "256",
    layout: "256",
    layoutPart: "ppt/slideLayouts/slideLayout2.xml",
    floor: [
      { node: "257.2", role: "title" },
      { node: "257.3", role: "body" },
      { node: "257.4", role: "body" },
    ],
  })
  const read = readDeckPage(result.deck, { runId: "run", slide: "257" })
  expect(read.elements.map((element) => [element.node, element.role, element.box])).toEqual([
    ["257.2", "title", title.box],
    ["257.3", "body", body.box],
    ["257.4", "body", body.box],
  ])
})

it("refuses a layout id the deck does not have", () => {
  expect(changeCall("add_slide", opened(), actor, { deck: "deck", base: 0, layout: "L4" })).toMatchObject({
    ok: false,
    refusal: "dead",
  })
})
