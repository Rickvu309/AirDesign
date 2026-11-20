import assert from "node:assert/strict"
import fs from "node:fs"
import { groupDeck } from "./pptx-fixtures/group-deck.mjs"

const first = groupDeck()
assert.deepEqual(groupDeck(), first)
assert.deepEqual(fs.readFileSync(new URL("pptx-fixtures/nested-groups.pptx", import.meta.url)), first)
console.log("group deck bytes are reproducible")
