import { readDeckId } from "@airdesign/catalog"
import { currentBox, elementId, writeTextValue } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { expect, it } from "vitest"
import { callTool, emptyLog, memoryTurns, type Session } from "./index.js"

const node = elementId("258.7")
const box = { x: 914400, y: 457200, cx: 1828800, cy: 914400 }
const floor = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hello" }] }])

function session(): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const deck: Deck = openDeck(id.deck)
  return { caller: { actor: "agent", runId: "run" }, deck, log: emptyLog(), now: 0, turns: memoryTurns() }
}

it("lands an agent box on an element whose file text is a JSON text value and answers with the box", () => {
  const held = session()
  const result = callTool(
    "airdesign_edit_deck",
    {
      deck: "deck",
      base: 0,
      changes: [
        { node: "258.7", readAt: 0, value: floor, floor },
        { node: "258.7", readAt: 0, property: "box", value: box },
      ],
    },
    held,
  )
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(String(result.refusal))
  expect(result.answer?.elements).toEqual([{ node, value: floor, version: 2, box }])
  const body = result.deck.register.elements[node]
  if (body === undefined) throw new Error("missing node")
  expect(currentBox(body)).toEqual(box)
})

it("refuses a box change that names no whole box before a run opens", () => {
  const held = session()
  const result = callTool(
    "airdesign_edit_deck",
    { deck: "deck", base: 0, changes: [{ node: "258.7", readAt: 0, property: "box", value: { ...box, cx: -1 } }] },
    held,
  )
  expect(result).toMatchObject({ ok: false, refusal: "field" })
  expect(result.deck).toBe(held.deck)
})
