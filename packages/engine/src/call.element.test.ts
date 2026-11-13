import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

const person = { actor: "person" } as const
const agent = { actor: "agent", runId: "run" } as const
const file = ["256"]
const node = elementId("256.9")
const element = { node, kind: "shape", value: "", box: { x: 1, y: 2, cx: 300, cy: 100 }, grouped: false }

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

it("lets a person add a text box, type in it and remove it, and hides it from a read once removed", () => {
  const added = landed(
    call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [
        { slide: "element-add", id: "256", element, file },
        { node, value: "Hello" },
      ],
    }),
  )
  expect(readDeckPage(added, { runId: null }).elements).toMatchObject([{ node, value: "Hello", box: element.box }])
  const removed = landed(
    call("commit_edits", added, person, { deck: "deck", batch: [{ slide: "element-remove", id: "256", node, file }] }),
  )
  expect(readDeckPage(removed, { runId: null }).elements).toEqual([])
  expect(call("commit_edits", removed, person, { deck: "deck", batch: [{ node, value: "Late" }] })).toEqual({
    ok: false,
    refusal: "dead",
  })
  expect(
    call("edit_deck", removed, agent, { deck: "deck", base: 2, changes: [{ node, value: "Late", readAt: 1 }] }),
  ).toMatchObject({ ok: false })
})

it("stores a stacking order from a person's commit and leaves the element showing", () => {
  const added = landed(
    call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [{ slide: "element-add", id: "256", element, file }],
    }),
  )
  const ordered = landed(
    call("commit_edits", added, person, {
      deck: "deck",
      batch: [
        {
          slide: "element-order",
          id: "256",
          node: "256.2",
          before: null,
          among: ["256.2", node],
          file,
        },
      ],
    }),
  )
  expect(ordered.register.order.at(-1)).toMatchObject({
    slide: "element-order",
    node: "256.2",
    before: null,
    among: ["256.2", node],
  })
  expect(readDeckPage(ordered, { runId: null }).elements).toMatchObject([{ node }])
})

it("shows a removed text box in a read again once a restore brings it back", () => {
  const added = landed(
    call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [{ slide: "element-add", id: "256", element, file }],
    }),
  )
  const removed = landed(
    call("commit_edits", added, person, { deck: "deck", batch: [{ slide: "element-remove", id: "256", node, file }] }),
  )
  const restored = landed(
    call("commit_edits", removed, person, {
      deck: "deck",
      batch: [{ slide: "element-restore", id: "256", node, file }],
    }),
  )
  expect(readDeckPage(restored, { runId: null }).elements).toMatchObject([{ node }])
})
