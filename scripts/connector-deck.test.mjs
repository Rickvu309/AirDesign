import assert from "node:assert/strict"
import fs from "node:fs"
import { connectorDeck } from "./pptx-fixtures/connector-deck.mjs"

const first = connectorDeck()
assert.deepEqual(connectorDeck(), first)
assert.deepEqual(fs.readFileSync(new URL("pptx-fixtures/connectors.pptx", import.meta.url)), first)
console.log("connector deck bytes are reproducible")
