import assert from "node:assert/strict"
import fs from "node:fs"
import { officeChartDeck } from "./pptx-fixtures/office-chart-deck.mjs"

const first = officeChartDeck()
assert.deepEqual(officeChartDeck(), first)
assert.deepEqual(fs.readFileSync(new URL("pptx-fixtures/office-chart.pptx", import.meta.url)), first)
console.log("office chart deck bytes are reproducible")
