import { readDeckId } from "@airdesign/catalog"
import { changedTable, elementId, openingTable, readTableValue, writeTableValue } from "@airdesign/document"
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

it("lets a person add a table, type in a cell and add a row as edits of its value, and removes it whole", () => {
  const typed = changedTable(openingTable(3, 3), { change: "cell", row: 0, column: 0, text: "Region" })!
  const grown = writeTableValue(changedTable(typed, { change: "row", row: 0, place: "below" })!)
  const added = landed(
    call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [
        { slide: "element-add", id: "256", element, file },
        { node, value: grown },
      ],
    }),
  )
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

it("keeps the columns a person added and deleted in the table's value", () => {
  const grown = changedTable(openingTable(3, 3), { change: "column", column: 0, place: "before" })!
  const value = writeTableValue(changedTable(grown, { change: "remove-column", column: 2 })!)
  const added = landed(
    call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [
        { slide: "element-add", id: "256", element, file },
        { node, value },
      ],
    }),
  )
  const shown = readDeckPage(added, { runId: null }).elements[0]?.value ?? ""
  expect(readTableValue(shown)?.columns).toEqual([-1, 0, 2])
})
