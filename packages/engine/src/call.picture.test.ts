import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

const person = { actor: "person" } as const
const file = ["256"]
const node = elementId("256.9")
const media = { sha256: "e".repeat(64), type: "image/gif" }
const picture = { node, kind: "picture", value: null, box: { x: 1, y: 2, cx: 300, cy: 200 }, grouped: false }

function added(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const result = call("commit_edits", openDeck(id.deck), person, {
    deck: "deck",
    batch: [{ slide: "element-add", id: "256", element: picture, media, file }],
  })
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

it("lets a person add a picture by its hash and media type, and a read lists it with its box", () => {
  expect(readDeckPage(added(), { runId: null }).elements).toMatchObject([{ node, kind: "picture", box: picture.box }])
})

it.fails("refuses text typed into a picture, which export cannot write", () => {
  expect(call("commit_edits", added(), person, { deck: "deck", batch: [{ node, value: "Typed" }] })).toMatchObject({
    ok: false,
  })
})
