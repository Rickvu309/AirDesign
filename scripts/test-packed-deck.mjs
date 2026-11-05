import { spawnSync } from "node:child_process"
import assert from "node:assert/strict"
const { fixtureDeck } = await import("../packages/deck/src/fixture.ts")
const deck = fixtureDeck(3)
const result = spawnSync("node", ["scripts/probe-deck.mjs"], { input: JSON.stringify({ deck, changeSets: [{ changes: [{ kind: "remove", target: "s0e2" }] }] }), encoding: "utf8" })
assert.equal(result.status, 0, result.stderr)
const observed = JSON.parse(result.stdout)
assert.equal(observed.results[0].ok, true)
assert.equal(observed.deck.slides[0].elements.length, 2)
assert.equal(observed.results[0].inverse.changes[0].value.slides[0].elements.length, 3)
process.stdout.write("Packed dependency-free consumer: PASS\n")
