import assert from "node:assert/strict"
import fs from "node:fs"
import { blankDeck } from "./pptx-fixtures/blank-deck.mjs"

const first = blankDeck()
assert.deepEqual(blankDeck(), first)
assert.ok(first.length < 32_768)
for (const file of ["scripts/pptx-fixtures/blank.pptx", "apps/web/src/decks/blank.pptx"]) {
  assert.deepEqual(fs.readFileSync(new URL(`../${file}`, import.meta.url)), first, file)
}
console.log("blank deck bytes are reproducible")
