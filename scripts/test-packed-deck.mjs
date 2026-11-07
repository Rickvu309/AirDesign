import { spawnSync } from "node:child_process"
import assert from "node:assert/strict"
import { fromJsx, toJsx } from "../packages/deck/dist/jsx.js"
import { isShapeGeometry, shapeGeometry } from "../packages/deck/dist/index.js"
assert.ok(Object.keys(shapeGeometry).length > 0)
for (const geometry of Object.keys(shapeGeometry)) assert.equal(isShapeGeometry(geometry), true)
assert.equal(isShapeGeometry("unsupported"), false)
const { fixtureDeck } = await import("../packages/deck/src/fixture.ts")
const deck = fixtureDeck(3)
const adapter = { toJsx: value => ({ type: "Deck", props: { value } }), fromJsx: node => node.props.value }
assert.deepEqual(fromJsx(toJsx(deck, adapter), adapter), deck)
assert.throws(() => fromJsx({ type: "Deck", props: { value: {} } }, adapter), /Invalid canonical deck/)
const result = spawnSync("node", ["scripts/probe-deck.mjs"], { input: JSON.stringify({ deck, changeSets: [{ changes: [{ kind: "remove", target: "s0e2" }] }] }), encoding: "utf8" })
assert.equal(result.status, 0, result.stderr)
const observed = JSON.parse(result.stdout)
assert.equal(observed.results[0].ok, true)
assert.equal(observed.deck.slides[0].elements.length, 2)
assert.equal(observed.results[0].inverse.changes[0].value.slides[0].elements.length, 3)
process.stdout.write("Packed dependency-free consumer: PASS\n")
