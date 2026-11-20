import assert from "node:assert/strict"
import path from "node:path"
import fc from "fast-check"
import { commitVariable, propertyParameters, propertyReplay, propertySeed, replayVariable } from "./property-seed.mjs"
import { root } from "./red-main-replay.mjs"

const file = path.join(root, "packages/document/src/connector.property.test.ts")
const test = "puts every bound end on its site, whatever the shapes' places, turns, flips and presets"
const first = "ee5ab7748b4f858c90cbd015c213e3aa78e8e15b"
const second = "f5d76511041572d19949cf08bcda3572898ece39"
const at = (commit, index = 0) =>
  propertyParameters({ env: { [commitVariable]: commit }, parameters: { numRuns: 20 }, file, test, index })

assert.deepEqual(
  at(first),
  { numRuns: 20, seed: propertySeed({ commit: first, file: path.relative(root, file), test, index: 0 }) },
  "the seed comes from the commit, the test's file and name, and which assert of the test it is",
)
assert.equal(at(first).seed, at(first).seed, "one commit gives every rerun the same seed")
assert.notEqual(at(first).seed, at(second).seed, "the next commit explores a new seed")
assert.notEqual(at(first, 0).seed, at(first, 1).seed, "two asserts in one test explore apart")
assert.equal(Number.isInteger(at(first).seed) && Math.abs(at(first).seed) < 2 ** 31, true)

const drawn = (parameters) => {
  const seen = []
  fc.assert(
    fc.property(fc.integer(), (value) => {
      seen.push(value)
    }),
    parameters,
  )
  return seen
}
assert.deepEqual(drawn(at(first)), drawn(at(first)), "fast-check draws the same values for the same commit")
assert.notDeepEqual(drawn(at(first)), drawn(at(second)), "and other values for another commit")

assert.deepEqual(
  propertyParameters({ env: {}, parameters: { numRuns: 5 }, file, test, index: 0 }),
  { numRuns: 5 },
  "with no commit fast-check keeps its own random seed",
)
assert.deepEqual(
  propertyParameters({ env: { [commitVariable]: first }, parameters: { seed: 7 }, file, test, index: 0 }),
  { seed: 7 },
  "a seed the test names wins",
)
const replay = { seed: -1896601759, path: "90:0:0:0:0:0:2:2:2:2:3:4:4:4:2:2:1:2:1:1:3:3:1:1:1" }
assert.deepEqual(
  propertyParameters({
    env: { [commitVariable]: first, [replayVariable]: JSON.stringify(replay) },
    parameters: { numRuns: 200 },
    file,
    test,
    index: 0,
  }),
  { numRuns: 200, ...replay, endOnFailure: true },
  "a replay runs the printed seed and path, whatever the commit",
)
assert.deepEqual(
  propertyReplay(
    'Error: Property failed after 91 tests\n{ seed: -1896601759, path: "90:0:0:0:0:0:2:2:2:2:3:4:4:4:2:2:1:2:1:1:3:3:1:1:1", endOnFailure: true }\nCounterexample: []',
  ),
  replay,
  "the seed and path are read from fast-check's failure",
)
assert.equal(propertyReplay("Error: expected 1 to be 2"), undefined)
