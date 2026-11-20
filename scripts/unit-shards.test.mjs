import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { moduleSeconds, recordUnitSeconds } from "./vitest-metrics.mjs"
import LongestFirst from "./vitest-longest-first.mjs"
import { readUnitSeconds, testFilesByProject, unitSecondsFile } from "./unit-test-files.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const files = Object.values(testFilesByProject(root)).flat().sort()
const recorded = readUnitSeconds(root)

const shardOf = async (total, index, folder = root, among = files) =>
  (
    await new LongestFirst({ config: { root: folder, shard: { index, count: total } } }).shard(
      among.map((file) => ({ moduleId: path.join(folder, file) })),
    )
  ).map((spec) => path.relative(folder, spec.moduleId))

for (const total of [1, 2, 3, 4, 6]) {
  const shares = await Promise.all(Array.from({ length: total }, (_, index) => shardOf(total, index + 1)))
  assert.deepEqual(shares.flat().toSorted(), files, `${total} shards run every unit test file exactly once`)
  assert.ok(
    shares.every((share) => share.length > 0),
    `${total} shards leave no shard empty`,
  )
  const seconds = (share) => share.reduce((sum, file) => sum + (recorded[file] ?? 0), 0)
  const loads = shares.map(seconds)
  const mean = loads.reduce((sum, load) => sum + load, 0) / total
  assert.ok(
    Math.max(...loads) <= mean * 1.05 + Math.max(...Object.values(recorded)),
    `${total} shards balance by recorded seconds: ${loads}`,
  )
}

const staleRecords = Object.keys(recorded).filter((file) => !files.includes(file))
assert.deepEqual(staleRecords, [], `${unitSecondsFile} holds only unit test files that exist`)

assert.deepEqual(
  await shardOf(2, 1, root, files.toReversed()),
  await shardOf(2, 1),
  "the order the files arrive in does not change a shard",
)

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "unit-seconds-"))
try {
  const modules = (entries) =>
    entries.map(([file, seconds, state = "passed"]) => ({
      moduleId: path.join(folder, file),
      state: () => state,
      diagnostic: () => ({ collectDuration: seconds * 800, duration: seconds * 200 }),
    }))
  assert.equal(moduleSeconds(modules([["a.test.ts", 2]])[0]), 2000, "a module weighs its imports, setup and tests")
  fs.mkdirSync(path.join(folder, "tests"))
  for (const file of ["kept.test.ts", "drifted.test.ts", "added.test.ts", "failed.test.ts"])
    fs.writeFileSync(path.join(folder, file), "")
  fs.writeFileSync(
    path.join(folder, unitSecondsFile),
    JSON.stringify({ "kept.test.ts": 10, "drifted.test.ts": 10, "gone.test.ts": 5, "failed.test.ts": 1 }),
  )
  recordUnitSeconds(
    folder,
    modules([
      ["kept.test.ts", 12],
      ["drifted.test.ts", 25],
      ["added.test.ts", 3],
      ["failed.test.ts", 40, "failed"],
    ]),
  )
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(folder, unitSecondsFile), "utf8")),
    { "added.test.ts": 3, "drifted.test.ts": 25, "failed.test.ts": 1, "kept.test.ts": 10 },
    "a whole passing run records a new file, refreshes one that moved past double, and drops one that is gone",
  )
  assert.equal(
    fs.readFileSync(path.join(folder, unitSecondsFile), "utf8").endsWith("}\n"),
    true,
    "the record ends with a newline like the browser record",
  )
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}

console.log("unit shards: every file runs in one shard, balanced by recorded seconds")
