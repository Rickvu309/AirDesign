import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { browserShares, designScans } from "./check-steps.mjs"
import {
  foldedSeconds,
  measuredSeconds,
  narrowedRun,
  readSpecSeconds,
  specFiles,
  unrecordedSeconds,
  weightedShares,
} from "./spec-seconds.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const placedOnce = (shares, keys) => {
  const placed = shares.flat()
  assert.deepEqual(placed.toSorted(), [...new Set(keys)].toSorted(), "the shares together hold every key")
  assert.equal(new Set(placed).size, placed.length, "no key sits in two shares")
}

const seconds = { "a.spec.ts": 40, "b.spec.ts": 30, "c.spec.ts": 20, "d.spec.ts": 10, "e.spec.ts": 10 }
const keys = [...Object.keys(seconds), "new.spec.ts"]
const split = weightedShares({ keys, seconds, total: 2 })
placedOnce(split.shares, keys)
assert.equal(unrecordedSeconds(seconds)("new.spec.ts"), 20, "a file with no record weighs the median")
assert.deepEqual(split.loads, [70, 60])
assert.deepEqual(split.shares, [
  ["a.spec.ts", "e.spec.ts", "new.spec.ts"],
  ["b.spec.ts", "c.spec.ts", "d.spec.ts"],
])
assert.deepEqual(weightedShares({ keys: keys.toReversed(), seconds, total: 2 }), split, "order of discovery is ignored")
const many = weightedShares({ keys: ["x.spec.ts", "y.spec.ts"], seconds: {}, total: 3 })
placedOnce(many.shares, ["x.spec.ts", "y.spec.ts"])
assert.deepEqual(many.shares[2], [], "more shares than keys leaves a share empty, which the browser part refuses")

const browserFiles = specFiles(root).filter((name) => !designScans.includes(`tests/browser/${name}`))
for (const total of [1, 2, 4, 6, 8]) {
  const { shares, loads } = browserShares(root, total)
  placedOnce(shares, browserFiles)
  const heaviest = Math.max(...Object.values(readSpecSeconds(root).seconds))
  const elapsed = loads.map((load, index) => (shares[index].includes("editor-speed.spec.ts") ? load : load / 2))
  assert.ok(Math.max(...elapsed) - Math.min(...elapsed) <= heaviest, `${total} browser shares account for worker count`)
}

const scheduled = new Map([
  ["kept.spec.ts", 1],
  ["slower.spec.ts", 1],
  ["new.spec.ts", 2],
  ["partial.spec.ts", 2],
  ["red.spec.ts", 1],
])
const test = (file, duration, more = {}) => ({
  file,
  duration,
  status: "passed",
  expectedStatus: "passed",
  ...more,
})
const measured = measuredSeconds({
  scheduled,
  tests: [
    test("kept.spec.ts", 15_000),
    test("slower.spec.ts", 25_000),
    test("new.spec.ts", 3_000),
    test("new.spec.ts", 1_000),
    test("partial.spec.ts", 1_000),
    test("red.spec.ts", 1_000, { status: "failed" }),
  ],
})
assert.deepEqual(
  measured,
  {
    seconds: { "kept.spec.ts": 15, "slower.spec.ts": 25, "new.spec.ts": 4 },
  },
  "only files that ran whole and passed are measured",
)
const refreshed = foldedSeconds({
  record: {
    seconds: { "kept.spec.ts": 10, "slower.spec.ts": 10, "partial.spec.ts": 10, "red.spec.ts": 10, "gone.spec.ts": 5 },
  },
  measured,
  exists: (name) => name !== "gone.spec.ts",
})
assert.deepEqual(refreshed, {
  seconds: { "kept.spec.ts": 10, "new.spec.ts": 4, "partial.spec.ts": 10, "red.spec.ts": 10, "slower.spec.ts": 25 },
})

for (const argv of [["test"], ["test", "tests/browser/home.spec.ts"], ["test", "--workers=2"]]) {
  assert.equal(narrowedRun(argv), false, `${argv.join(" ")} runs whole files`)
}
for (const argv of [
  ["test", "-g", "export"],
  ["test", "--grep=export"],
  ["test", "--grep-invert", "x"],
  ["test", "--shard=1/2"],
  ["test", "--last-failed"],
  ["test", "--only-changed"],
  ["test", "home.spec.ts:12"],
]) {
  assert.equal(narrowedRun(argv), true, `${argv.join(" ")} runs part of a file`)
}

console.log("spec-seconds: shards hold every spec once, weighted by recorded seconds, and the record refreshes itself")
