import { readDeckId } from "@airdesign/catalog"
import {
  changedTable,
  decide,
  slideId,
  elementId,
  openingTable,
  readTableValue,
  writeTableValue,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

const person = { actor: "person" } as const
const file = ["256"]
const node = elementId("256.9")
const opening = writeTableValue(openingTable(3, 3))
const element = { node, kind: "table", value: opening, box: { x: 1, y: 2, cx: 3000, cy: 900 }, grouped: false }

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function saved(value: string): Deck {
  const deck = opened()
  const added = decide(deck.register, {
    command: "slide",
    file: [slideId("256")],
    edit: {
      slide: "element-add",
      id: slideId("256"),
      element: { ...element, kind: "table" },
    },
  })
  if (added.decision !== "apply") throw new Error(added.code)
  const openedNode = decide(added.register, { command: "add", node, floor: opening, route: "" })
  if (openedNode.decision !== "apply") throw new Error(openedNode.code)
  const edited = decide(openedNode.register, { command: "person", node, value })
  if (edited.decision !== "apply") throw new Error(edited.code)
  return { ...deck, register: edited.register }
}

it("refuses new table creation and edits while keeping saved tables removable as objects", () => {
  expect(
    call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [{ slide: "element-add", id: "256", element, file }],
    }),
  ).toMatchObject({ ok: false })
  const typed = changedTable(openingTable(3, 3), { change: "cell", row: 0, column: 0, text: "Region" })!
  const grown = writeTableValue(changedTable(typed, { change: "row", row: 0, place: "below" })!)
  const added = saved(grown)
  expect(call("commit_edits", added, person, { deck: "deck", batch: [{ node, value: opening }] })).toMatchObject({
    ok: false,
  })
  const shown = readDeckPage(added, { runId: null }).elements
  expect(shown).toMatchObject([{ node, kind: "table", box: element.box }])
  expect(readTableValue(shown[0]?.value ?? "")?.rows.map((row) => row.from)).toEqual([0, -1, 1, 2])
  const removed = landed(
    call("commit_edits", added, person, { deck: "deck", batch: [{ slide: "element-remove", id: "256", node, file }] }),
  )
  expect(readDeckPage(removed, { runId: null }).elements).toEqual([])
})

it("refuses a table added with text already in it", () => {
  const filled = writeTableValue(changedTable(openingTable(1, 1), { change: "cell", row: 0, column: 0, text: "x" })!)
  expect(
    call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [{ slide: "element-add", id: "256", element: { ...element, value: filled }, file }],
    }),
  ).toMatchObject({ ok: false })
})

it("keeps the columns previously added and deleted in the table's value", () => {
  const grown = changedTable(openingTable(3, 3), { change: "column", column: 0, place: "before" })!
  const value = writeTableValue(changedTable(grown, { change: "remove-column", column: 2 })!)
  const added = saved(value)
  const shown = readDeckPage(added, { runId: null }).elements[0]?.value ?? ""
  expect(readTableValue(shown)?.columns).toEqual([-1, 0, 2])
})
