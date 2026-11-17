import { readDeckId } from "@airdesign/catalog"
import { rowKey } from "./store.js"
import { currentValue, elementId, format, openingTable, slideId, writeTableValue } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, writeRows } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote } from "./index.js"

beforeEach(() => installIndexedDb())
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("refuses table authoring before it enters the device queue", async () => {
  const link = connect(memoryRemote())
  const node = elementId("258.7")
  const value = writeTableValue(openingTable(2, 2))
  expect(await link.enqueue("deck", value, node, value)).toMatchObject({ ok: false })
  expect(
    await link.enqueueRow("deck", { v: format, patch: { table: { value: { set: value } } } }, node, value),
  ).toMatchObject({ ok: false })
  expect(
    await link.enqueueSlide("deck", [slideId("258")], {
      slide: "element-add",
      id: slideId("258"),
      element: {
        node,
        kind: "table",
        value,
        grouped: false,
        box: { x: 0, y: 0, cx: 914400, cy: 914400 },
      },
    }),
  ).toMatchObject({ ok: false })
  expect(await link.pending("deck")).toEqual([])
})

it("replays a saved table row on the device without applying authoring restrictions", async () => {
  const parsed = readDeckId("saved-table")
  if (!parsed.ok) throw new Error(parsed.refusal)
  const node = elementId("258.7")
  const value = writeTableValue(openingTable(2, 2))
  await writeRows(
    [
      {
        key: rowKey(parsed.deck, "confirmed", 0),
        row: {
          kind: "confirmed",
          deck: parsed.deck,
          revision: 0,
          node,
          floor: value,
          v: format,
          patch: { table: { value: { set: value } } },
        },
      },
    ],
    [],
  )
  const opened = await connect(memoryRemote()).openDeck(parsed.deck)
  if (!opened.ok) throw new Error(opened.refusal)
  const body = opened.register.elements[node]
  expect(body).toBeDefined()
  if (body === undefined) throw new Error("table")
  expect(currentValue(body)).toBe(value)
})
