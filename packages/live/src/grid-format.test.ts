import { format, slideId } from "@airdesign/document"
import { readDeckId } from "@airdesign/catalog"
import { expect, it } from "vitest"
import type { StoredRow } from "./store.js"
import { newerRow, split } from "./deck-view.js"
import { memoryShelf } from "./browser-fixtures.js"
import { recoverUnsaved } from "./unsaved.js"

it("refuses an unknown structural envelope before splitting confirmed or pending rows", () => {
  const parsed = readDeckId("a".repeat(32))
  if (!parsed.ok) throw new Error("deck")
  const deck = parsed.deck
  for (const kind of ["confirmed", "pending"] as const) {
    const row: StoredRow =
      kind === "confirmed"
        ? { kind, deck, revision: 0, value: "", format: format + 1 }
        : {
            kind,
            deck,
            order: 0,
            base: 0,
            value: "",
            format: format + 1,
            slideFile: [slideId("256")],
            slideEdit: { slide: "move-many", grid: 1, ids: [slideId("256")], after: null, row: "keep" },
          }
    expect(newerRow(row)).toBe(true)
    expect(() => split([row])).toThrow("newer")
  }
})
it("keeps a newer structural journal entry without replaying or releasing it", async () => {
  const shelf = memoryShelf()
  const key = "airdesign:unsaved:account:deck"
  const bytes = JSON.stringify([
    {
      kind: "slide",
      id: "one",
      format: format + 1,
      file: ["256"],
      edit: { slide: "move-many", grid: 1, row: "keep", ids: ["256"], after: null },
    },
  ])
  shelf.setItem(key, bytes)
  let called = false
  await recoverUnsaved(shelf, "account", "deck", async () => {
    called = true
  })
  expect(called).toBe(false)
  expect(shelf.getItem(key)).toBe(bytes)
})
