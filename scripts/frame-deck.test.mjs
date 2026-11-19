import assert from "node:assert/strict"
import fs from "node:fs"
import { frameDeck } from "./pptx-fixtures/frame-deck.mjs"

const first = frameDeck()
assert.deepEqual(frameDeck(), first)
assert.deepEqual(fs.readFileSync(new URL("pptx-fixtures/frame.pptx", import.meta.url)), first)
console.log("frame deck bytes are reproducible")
